import crypto from "node:crypto";
import express from "express";
import {
  APP_STATE_SCHEMA_VERSION,
  createAppStatePool,
  createInitialAppState,
  ensureAppStateSchema,
  migrateAppState,
  readAppState,
  writeAppState,
} from "./appState.js";
import { createDelhiveryClient, DelhiveryError } from "./integrations/delhivery.js";
import { hashPassword, passwordMatches } from "./passwords.js";
const app = express();
const port = Number(process.env.PORT || 3000);
const adminUsername = process.env.ADMIN_USERNAME || "admin";
const isProduction = process.env.NODE_ENV === "production";
const adminPassword = process.env.ADMIN_PASSWORD !== undefined ? process.env.ADMIN_PASSWORD : (isProduction ? "" : "Pax@1234");
const bundledAdminPasswordSha256 = "d3471dde926ef8d5d96a61f5fe9e43627b5fb1b433ddd39f4b03739f3a7485cd";
const adminPasswordSha256 = String(process.env.ADMIN_PASSWORD_SHA256 || (isProduction ? bundledAdminPasswordSha256 : "")).trim().toLowerCase();
const configuredTokenSecret = String(process.env.JWT_SECRET || "").trim();
const tokenSecret = configuredTokenSecret || (isProduction ? crypto.randomBytes(32).toString("hex") : "pax-local-development-secret");
const otpDeliveryMode = String(process.env.OTP_DELIVERY_MODE || "onscreen").trim().toLowerCase();
const databaseRequired = isProduction && process.env.REQUIRE_DATABASE === "true";
const schemaVersion = APP_STATE_SCHEMA_VERSION;
const configuredOrigins = String(process.env.FRONTEND_URLS || process.env.FRONTEND_URL || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const defaultOrigins = [
  "https://paxlogistic.onrender.com",
  "https://pax-logsiticadmin-utus.onrender.com",
  "http://127.0.0.1:4173",
  "http://localhost:4173",
];
const allowedOrigins = new Set([...defaultOrigins, ...configuredOrigins]);

let memoryState = createInitialAppState();
let pool = process.env.DATABASE_URL ? createAppStatePool() : null;
const memoryWaybills = new Map();
let databaseReady = false;
const eventClients = new Set();
const otpChallenges = new Map();
const environmentAdminAuthenticationConfigured = Boolean(adminPassword || /^[a-f0-9]{64}$/.test(adminPasswordSha256));
const delhivery = createDelhiveryClient();

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.use((request, response, next) => {
  const origin = request.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
    response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  }
  if (request.method === "OPTIONS") return response.sendStatus(204);
  next();
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function secureEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function isAdminPasswordValid(password) {
  if (adminPassword) return secureEqual(password, adminPassword);
  if (!/^[a-f0-9]{64}$/.test(adminPasswordSha256)) return false;
  const suppliedHash = crypto.createHash("sha256").update(String(password)).digest("hex");
  return secureEqual(suppliedHash, adminPasswordSha256);
}

async function initializeDatabase() {
  if (!pool || databaseReady) return;
  try {
    await ensureAppStateSchema(pool);
    databaseReady = true;
  } catch (error) {
    console.error("Postgres unavailable; using in-memory state:", error.message);
    await pool.end().catch(() => undefined);
    pool = null;
  }
}

async function readState() {
  await initializeDatabase();
  if (!pool) {
    memoryState = migrateAppState(memoryState);
    return clone(memoryState);
  }
  return readAppState(pool, { ensure: false });
}

async function writeState(nextState, event = "state.updated") {
  const next = { ...nextState, updatedAt: new Date().toISOString() };
  await initializeDatabase();
  if (pool) await writeAppState(pool, next, { ensure: false });
  else memoryState = clone(next);
  broadcast(event, next);
  return clone(next);
}

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function issueToken(subject, role) {
  if (!tokenSecret) throw new Error("JWT_SECRET is not configured.");
  const payload = encode({ subject, role, expiresAt: Date.now() + (12 * 60 * 60 * 1000) });
  const signature = crypto.createHmac("sha256", tokenSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifyToken(token, expectedRole) {
  try {
    if (!tokenSecret || !token || !token.includes(".")) return null;
    const [payload, signature] = token.split(".");
    const expected = crypto.createHmac("sha256", tokenSecret).update(payload).digest("base64url");
    if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (decoded.expiresAt < Date.now() || (expectedRole && decoded.role !== expectedRole)) return null;
    return decoded;
  } catch {
    return null;
  }
}

function requireRole(role) {
  return (request, response, next) => {
    const token = String(request.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const session = verifyToken(token, role);
    if (!session) return response.status(401).json({ message: "A valid access token is required." });
    request.session = session;
    next();
  };
}

function normalizeLoginIdentifier(value) {
  const identifier = String(value || "").trim();
  return identifier.includes("@") ? identifier.toLowerCase() : identifier.replace(/\D/g, "");
}

function waybillInventorySummary(records) {
  const summary = { total: 0, stored: 0, reserved: 0, used: 0 };
  records.forEach((record) => {
    summary.total += 1;
    if (Object.hasOwn(summary, record.status)) summary[record.status] += 1;
  });
  return summary;
}

async function storeWaybillBatch(waybills) {
  await initializeDatabase();
  const batchId = `WB-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  if (pool) {
    const result = await pool.query(`
      INSERT INTO delhivery_waybills (waybill, batch_id)
      SELECT DISTINCT source.waybill, $2
      FROM unnest($1::text[]) AS source(waybill)
      ON CONFLICT (waybill) DO NOTHING
      RETURNING waybill, status, batch_id, fetched_at
    `, [waybills, batchId]);
    return { batchId, inserted: result.rows, duplicateCount: waybills.length - result.rowCount };
  }

  const inserted = [];
  const fetchedAt = new Date().toISOString();
  waybills.forEach((waybill) => {
    if (memoryWaybills.has(waybill)) return;
    const record = { waybill, status: "stored", batchId, fetchedAt, reservedAt: null, usedAt: null, shipmentId: null };
    memoryWaybills.set(waybill, record);
    inserted.push(record);
  });
  return { batchId, inserted, duplicateCount: waybills.length - inserted.length };
}

async function readWaybillInventory({ status, limit, offset }) {
  await initializeDatabase();
  if (pool) {
    const [records, totals] = await Promise.all([
      pool.query(`
        SELECT waybill, status, batch_id AS "batchId", fetched_at AS "fetchedAt",
          reserved_at AS "reservedAt", used_at AS "usedAt", shipment_id AS "shipmentId"
        FROM delhivery_waybills
        WHERE ($1::text IS NULL OR status = $1)
        ORDER BY fetched_at ASC, waybill ASC
        LIMIT $2 OFFSET $3
      `, [status || null, limit, offset]),
      pool.query(`
        SELECT COUNT(*)::integer AS total,
          COUNT(*) FILTER (WHERE status = 'stored')::integer AS stored,
          COUNT(*) FILTER (WHERE status = 'reserved')::integer AS reserved,
          COUNT(*) FILTER (WHERE status = 'used')::integer AS used
        FROM delhivery_waybills
      `),
    ]);
    return { items: records.rows, summary: totals.rows[0] || { total: 0, stored: 0, reserved: 0, used: 0 } };
  }

  const all = [...memoryWaybills.values()].sort((left, right) => left.fetchedAt.localeCompare(right.fetchedAt) || left.waybill.localeCompare(right.waybill));
  const filtered = status ? all.filter((record) => record.status === status) : all;
  return { items: filtered.slice(offset, offset + limit), summary: waybillInventorySummary(all) };
}

async function sendStoredWaybillResponse(response, fetched) {
  const stored = await storeWaybillBatch(fetched.waybills);
  const inventory = await readWaybillInventory({ status: "", limit: 1, offset: 0 });
  response.status(stored.inserted.length ? 201 : 200).json({
    data: {
      batchId: stored.batchId,
      requestedCount: fetched.requestedCount,
      receivedCount: fetched.receivedCount,
      storedCount: stored.inserted.length,
      duplicateCount: stored.duplicateCount,
      preview: stored.inserted.slice(0, 10).map((record) => record.waybill),
      summary: inventory.summary,
    },
  });
}

async function markWaybillsUsed(waybills, shipmentId) {
  const uniqueWaybills = [...new Set(waybills.filter((waybill) => /^\d{8,20}$/.test(String(waybill))))];
  if (!uniqueWaybills.length) return;
  await initializeDatabase();
  if (pool) {
    await pool.query(`
      UPDATE delhivery_waybills
      SET status = 'used', used_at = NOW(), reserved_at = NULL, shipment_id = $2
      WHERE waybill = ANY($1::text[])
    `, [uniqueWaybills, shipmentId]);
    return;
  }
  uniqueWaybills.forEach((waybill) => {
    const record = memoryWaybills.get(waybill);
    if (!record) return;
    memoryWaybills.set(waybill, { ...record, status: "used", usedAt: new Date().toISOString(), reservedAt: null, shipmentId });
  });
}

async function reserveMpsWaybills(waybills, shipmentId) {
  const uniqueWaybills = [...new Set(waybills.map(String))];
  if (uniqueWaybills.length !== waybills.length || uniqueWaybills.some((waybill) => !/^\d{8,20}$/.test(waybill))) {
    throw new DelhiveryError("Every MPS box requires a distinct valid prefetched waybill.", { code: "INVALID_MPS_WAYBILLS", status: 400 });
  }
  await initializeDatabase();
  if (pool) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(`
        UPDATE delhivery_waybills
        SET status = 'reserved', reserved_at = NOW(), shipment_id = $2
        WHERE waybill = ANY($1::text[]) AND status = 'stored'
        RETURNING waybill
      `, [uniqueWaybills, shipmentId]);
      if (result.rowCount !== uniqueWaybills.length) {
        throw new DelhiveryError("Every MPS waybill must exist in stored inventory and be unused.", { code: "MPS_WAYBILL_UNAVAILABLE", status: 409 });
      }
      await client.query("COMMIT");
      return;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
  if (uniqueWaybills.some((waybill) => memoryWaybills.get(waybill)?.status !== "stored")) {
    throw new DelhiveryError("Every MPS waybill must exist in stored inventory and be unused.", { code: "MPS_WAYBILL_UNAVAILABLE", status: 409 });
  }
  const reservedAt = new Date().toISOString();
  uniqueWaybills.forEach((waybill) => memoryWaybills.set(waybill, { ...memoryWaybills.get(waybill), status: "reserved", reservedAt, shipmentId }));
}

async function releaseMpsWaybills(waybills, shipmentId) {
  if (!waybills.length) return;
  await initializeDatabase();
  if (pool) {
    await pool.query(`
      UPDATE delhivery_waybills
      SET status = 'stored', reserved_at = NULL, shipment_id = NULL
      WHERE waybill = ANY($1::text[]) AND status = 'reserved' AND shipment_id = $2
    `, [waybills, shipmentId]);
    return;
  }
  waybills.forEach((waybill) => {
    const record = memoryWaybills.get(waybill);
    if (record?.status !== "reserved" || record.shipmentId !== shipmentId) return;
    memoryWaybills.set(waybill, { ...record, status: "stored", reservedAt: null, shipmentId: null });
  });
}

function manifestPiece(body, piece, user, orderId, paymentMode) {
  const value = (key, fallback) => piece?.[key] ?? body?.[key] ?? fallback;
  const weightKg = Number(value("weight", 0));
  const explicitWeightGrams = Number(value("weightGrams", 0));
  return {
    name: value("customer", value("receiverName", "")),
    order: orderId,
    phone: value("phone", ""),
    address: value("address", ""),
    pin: value("pincode", ""),
    paymentMode,
    addressType: value("addressType"),
    ewbn: value("ewbn"),
    hsnCode: value("hsnCode"),
    shippingMode: value("shippingMode"),
    sellerInvoice: value("sellerInvoice"),
    city: value("city"),
    weightGrams: explicitWeightGrams > 0 ? explicitWeightGrams : Math.round(weightKg * 1000),
    returnName: value("returnName"),
    returnAddress: value("returnAddress"),
    returnCity: value("returnCity"),
    returnPhone: value("returnPhone"),
    returnState: value("returnState"),
    returnCountry: value("returnCountry"),
    returnPin: value("returnPincode"),
    sellerName: value("sellerName", user.businessName),
    fragileShipment: value("fragileShipment"),
    heightCm: value("heightCm"),
    widthCm: value("widthCm"),
    lengthCm: value("lengthCm"),
    codAmount: value("codAmount", value("amount", 0)),
    productsDescription: value("productsDescription"),
    state: value("state"),
    dangerousGood: value("dangerousGood"),
    waybill: value("waybill"),
    totalAmount: value("totalAmount", value("amount", 0)),
    sellerAddress: value("sellerAddress", user.address),
    country: value("country"),
    plasticPackaging: value("plasticPackaging"),
    quantity: value("quantity"),
    transportSpeed: value("transportSpeed"),
  };
}

function findUserByIdentifier(state, value) {
  const identifier = normalizeLoginIdentifier(value);
  return state.users.find((item) => item.email === identifier || item.phone === identifier);
}

function maskLoginIdentifier(value) {
  const identifier = normalizeLoginIdentifier(value);
  if (identifier.includes("@")) {
    const [name, domain] = identifier.split("@");
    return `${name.slice(0, 2)}${"*".repeat(Math.max(name.length - 2, 2))}@${domain}`;
  }
  return `${identifier.slice(0, 2)}******${identifier.slice(-2)}`;
}

function hashOtp(challengeId, otp) {
  return crypto.createHmac("sha256", tokenSecret).update(`${challengeId}:${otp}`).digest("hex");
}

function broadcast(event, state) {
  const packet = `event: ${event}\ndata: ${JSON.stringify({ revision: state.configuration?.revision, updatedAt: state.updatedAt })}\n\n`;
  eventClients.forEach((client) => client.write(packet));
}

app.get("/health", async (_request, response) => {
  await initializeDatabase();
  if (databaseRequired && !pool) {
    return response.status(503).json({ ok: false, storage: "unavailable", service: "pax-logistic-api", schemaVersion, message: "PostgreSQL is required in production." });
  }
  const state = await readState();
  const adminAuthenticationConfigured = environmentAdminAuthenticationConfigured
    || state.admins.some((admin) => !admin.disabled && admin.passwordHash && admin.salt);
  response.json({ ok: true, storage: pool ? "postgres" : "memory", service: "pax-logistic-api", schemaVersion, adminAuthenticationConfigured, persistentSigningKey: Boolean(configuredTokenSecret), delhiveryConfigured: delhivery.configured });
});

app.get("/api/events", (request, response) => {
  const origin = request.headers.origin;
  if (origin && !allowedOrigins.has(origin)) return response.status(403).end();
  response.setHeader("Content-Type", "text/event-stream");
  response.setHeader("Cache-Control", "no-cache");
  response.setHeader("Connection", "keep-alive");
  response.flushHeaders();
  response.write("event: connected\ndata: {}\n\n");
  eventClients.add(response);
  request.on("close", () => eventClients.delete(response));
});

app.post("/api/admin/auth/login", async (request, response) => {
  const username = String(request.body?.username || "").trim();
  const password = String(request.body?.password || "");
  const state = await readState();
  const normalizedUsername = username.toLowerCase();
  const seededAdmin = state.admins.find((admin) => String(admin.username || "").toLowerCase() === normalizedUsername
    || String(admin.email || "").toLowerCase() === normalizedUsername);
  const seededAdminMatches = Boolean(seededAdmin && !seededAdmin.disabled && await passwordMatches(password, seededAdmin));
  const environmentAdminMatches = environmentAdminAuthenticationConfigured
    && secureEqual(username, adminUsername)
    && isAdminPasswordValid(password);

  if (!environmentAdminAuthenticationConfigured && !state.admins.some((admin) => !admin.disabled && admin.passwordHash && admin.salt)) {
    return response.status(503).json({ message: "Admin authentication is not configured." });
  }
  if (!seededAdminMatches && !environmentAdminMatches) {
    return response.status(401).json({ message: "Incorrect administrator username or password." });
  }

  const authenticatedAdmin = seededAdminMatches ? seededAdmin : { name: "Pax Administrator", username, role: "super_admin" };
  response.json({
    token: issueToken(authenticatedAdmin.username || username, "admin"),
    admin: {
      id: authenticatedAdmin.id,
      name: authenticatedAdmin.name || "Pax Administrator",
      username: authenticatedAdmin.username || username,
      email: authenticatedAdmin.email || undefined,
      role: authenticatedAdmin.role || "super_admin",
      planId: authenticatedAdmin.planId || undefined,
    },
  });
});

app.get("/api/admin/dashboard", requireRole("admin"), async (_request, response) => {
  const state = await readState();
  response.json({ data: { shipments: state.shipments, customers: state.customers, activities: state.activities, configuration: state.configuration, updatedAt: state.updatedAt } });
});

app.put("/api/admin/configuration", requireRole("admin"), async (request, response) => {
  if (!request.body?.configuration || typeof request.body.configuration !== "object") return response.status(400).json({ message: "A configuration object is required." });
  const state = await readState();
  state.configuration = { ...request.body.configuration, revision: Number(state.configuration?.revision || 0) + 1 };
  const next = await writeState(state, "configuration.updated");
  response.json({ data: next.configuration });
});

app.patch("/api/admin/shipments/:id/status", requireRole("admin"), async (request, response) => {
  const state = await readState();
  const shipment = state.shipments.find((item) => item.id === request.params.id);
  if (!shipment) return response.status(404).json({ message: "Shipment not found." });
  const allowedStatuses = new Set(["Pending manifestation", "Manifested", "Pickup scheduled", "In transit", "Out for delivery", "Delivered", "Exception", "RTO"]);
  const status = String(request.body?.status || "");
  if (!allowedStatuses.has(status)) return response.status(400).json({ message: "A valid shipment status is required." });
  shipment.status = status;
  state.activities.unshift({ title: `${shipment.id} status updated`, detail: shipment.status, tone: "blue", createdAt: new Date().toISOString() });
  state.activities = state.activities.slice(0, 50);
  await writeState(state, "shipment.updated");
  response.json({ data: shipment });
});

app.patch("/api/admin/customers/:id/access", requireRole("admin"), async (request, response) => {
  const state = await readState();
  const customer = state.customers.find((item) => item.id === request.params.id);
  if (!customer) return response.status(404).json({ message: "Customer not found." });
  customer.status = request.body?.enabled ? "Active" : "Disabled";
  const user = state.users.find((item) => item.email === customer.email);
  if (user) user.disabled = !request.body.enabled;
  await writeState(state, "customer.updated");
  response.json({ data: customer });
});

async function handleServiceability(request, response) {
  const data = await delhivery.checkServiceability(request.params.pincode);
  response.json({ data });
}

async function handleHeavyServiceability(request, response) {
  const data = await delhivery.checkHeavyServiceability(request.params.pincode);
  response.json({ data });
}

async function handleExpectedTat(request, response) {
  const data = await delhivery.getExpectedTat(request.query);
  response.json({ data });
}

app.get("/api/admin/serviceability/:pincode", requireRole("admin"), handleServiceability);
app.get("/api/client/serviceability/:pincode", requireRole("customer"), handleServiceability);
app.get("/api/admin/heavy-serviceability/:pincode", requireRole("admin"), handleHeavyServiceability);
app.get("/api/client/heavy-serviceability/:pincode", requireRole("customer"), handleHeavyServiceability);
app.get("/api/admin/expected-tat", requireRole("admin"), handleExpectedTat);
app.get("/api/client/expected-tat", requireRole("customer"), handleExpectedTat);

app.post("/api/admin/delhivery/waybills/fetch", requireRole("admin"), async (request, response) => {
  const fetched = await delhivery.fetchWaybills(request.body?.count);
  await sendStoredWaybillResponse(response, fetched);
});

app.post("/api/admin/delhivery/waybills/fetch-single", requireRole("admin"), async (_request, response) => {
  const fetched = await delhivery.fetchSingleWaybill();
  await sendStoredWaybillResponse(response, fetched);
});

app.get("/api/admin/delhivery/waybills", requireRole("admin"), async (request, response) => {
  const status = String(request.query.status || "").trim().toLowerCase();
  const limit = Number(request.query.limit || 100);
  const offset = Number(request.query.offset || 0);
  if (status && !["stored", "reserved", "used"].includes(status)) {
    return response.status(400).json({ message: "Waybill status must be stored, reserved or used." });
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 200 || !Number.isInteger(offset) || offset < 0) {
    return response.status(400).json({ message: "Waybill pagination requires limit 1-200 and a non-negative offset." });
  }
  const inventory = await readWaybillInventory({ status, limit, offset });
  response.json({ data: { ...inventory, pagination: { limit, offset, returned: inventory.items.length } } });
});

app.get("/api/client/bootstrap", requireRole("customer"), async (request, response) => {
  const state = await readState();
  const user = state.users.find((item) => item.email === request.session.subject);
  if (!user || user.disabled) return response.status(403).json({ message: "This customer account is not available." });
  const { passwordHash, salt, ...safeUser } = user;
  const shipments = state.shipments.filter((item) => item.ownerEmail === request.session.subject || item.customerId === user.id);
  response.json({ data: { configuration: state.configuration, shipments, user: safeUser, updatedAt: state.updatedAt } });
});

app.post("/api/client/users", async (request, response) => {
  const email = String(request.body?.email || "").trim().toLowerCase();
  const password = String(request.body?.password || "");
  const fullName = String(request.body?.fullName || "").trim();
  const businessName = String(request.body?.businessName || "").trim();
  const phone = String(request.body?.phone || "").trim();
  if (!email || !fullName || !businessName || !/^\d{10}$/.test(phone) || password.length < 8) {
    return response.status(400).json({ message: "Name, business, valid email, 10-digit phone and 8-character password are required." });
  }
  const state = await readState();
  if (state.users.some((user) => user.email === email || user.phone === phone)) return response.status(409).json({ message: "An account already exists with this email or phone." });
  const credentials = await hashPassword(password);
  const id = `CUS-${String(Date.now()).slice(-6)}`;
  const user = { ...request.body, id, email, passwordHash: credentials.hash, salt: credentials.salt, disabled: false };
  delete user.password;
  state.users.push(user);
  state.customers.unshift({ id, name: user.fullName, business: user.businessName, email, phone: user.phone, city: user.city, shipments: 0, joinedAt: new Date().toISOString(), status: "Active" });
  await writeState(state, "customer.created");
  const { passwordHash, salt, ...safeUser } = user;
  response.status(201).json({ data: safeUser, token: issueToken(email, "customer") });
});

app.post("/api/client/auth/otp/request", async (request, response) => {
  const identifier = normalizeLoginIdentifier(request.body?.identifier);
  if (!(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier) || /^[6-9]\d{9}$/.test(identifier))) {
    return response.status(400).json({ message: "Enter a valid email address or 10-digit mobile number." });
  }

  const state = await readState();
  const user = findUserByIdentifier(state, identifier);
  if (!user) return response.status(404).json({ message: "No Pax account was found with these details." });
  if (user.disabled) return response.status(403).json({ message: "This account is disabled by the Pax administrator." });

  const now = Date.now();
  for (const [id, challenge] of otpChallenges.entries()) {
    if (challenge.expiresAt <= now || challenge.userEmail === user.email) otpChallenges.delete(id);
  }

  const challengeId = crypto.randomBytes(24).toString("base64url");
  const otp = String(crypto.randomInt(100000, 1000000));
  const expiresAt = now + (5 * 60 * 1000);
  otpChallenges.set(challengeId, { userEmail: user.email, otpHash: hashOtp(challengeId, otp), expiresAt, attempts: 0 });

  response.json({
    data: {
      challengeId,
      expiresAt: new Date(expiresAt).toISOString(),
      destination: maskLoginIdentifier(identifier),
      deliveryMethod: otpDeliveryMode,
      ...(otpDeliveryMode === "onscreen" ? { previewCode: otp } : {}),
    },
  });
});

app.post("/api/client/auth/otp/verify", async (request, response) => {
  const challengeId = String(request.body?.challengeId || "").trim();
  const otp = String(request.body?.otp || "").trim();
  const challenge = otpChallenges.get(challengeId);
  if (!challenge || challenge.expiresAt <= Date.now()) {
    if (challenge) otpChallenges.delete(challengeId);
    return response.status(400).json({ message: "This OTP has expired. Request a new one." });
  }
  challenge.attempts += 1;
  if (challenge.attempts > 5) {
    otpChallenges.delete(challengeId);
    return response.status(429).json({ message: "Too many incorrect attempts. Request a new OTP." });
  }
  if (!/^\d{6}$/.test(otp) || !secureEqual(hashOtp(challengeId, otp), challenge.otpHash)) {
    return response.status(401).json({ message: "Incorrect OTP. Check the code and try again." });
  }

  otpChallenges.delete(challengeId);
  const state = await readState();
  const user = state.users.find((item) => item.email === challenge.userEmail);
  if (!user || user.disabled) return response.status(403).json({ message: "This customer account is not available." });
  const { passwordHash, salt, ...safeUser } = user;
  response.json({ data: safeUser, token: issueToken(user.email, "customer") });
});

app.post("/api/client/auth/login", async (request, response) => {
  const identifier = normalizeLoginIdentifier(request.body?.identifier || request.body?.email);
  const state = await readState();
  const user = findUserByIdentifier(state, identifier);
  if (!user || !(await passwordMatches(String(request.body?.password || ""), user))) return response.status(401).json({ message: "Incorrect email, mobile number or password." });
  if (user.disabled) return response.status(403).json({ message: "This account is disabled by the Pax administrator." });
  const { passwordHash, salt, ...safeUser } = user;
  response.json({ data: safeUser, token: issueToken(user.email, "customer") });
});

app.post("/api/client/shipments", requireRole("customer"), async (request, response) => {
  const state = await readState();
  const user = state.users.find((item) => item.email === request.session.subject);
  if (!user || user.disabled) return response.status(403).json({ message: "This customer account is not available." });
  const body = request.body || {};
  const customer = String(body.customer || body.receiverName || "").trim();
  const phone = String(body.phone || "").trim();
  const address = String(body.address || "").trim();
  const city = String(body.city || "").trim();
  const pincode = String(body.pincode || "").trim();
  const weight = Number(body.weight);
  const requestedProductType = String(body.productType || body.product_type || "Parcel").trim().toLowerCase();
  if (!["parcel", "heavy"].includes(requestedProductType)) {
    return response.status(400).json({ message: "Product type must be Parcel or Heavy." });
  }
  const productType = requestedProductType === "heavy" ? "Heavy" : "Parcel";
  if (!customer || !/^\d{10}$/.test(phone) || !address || !city || !/^[1-9]\d{5}$/.test(pincode) || !Number.isFinite(weight) || weight <= 0) {
    return response.status(400).json({ message: "Valid receiver, phone, address, PIN code and parcel weight are required." });
  }
  const serviceability = productType === "Heavy"
    ? await delhivery.checkHeavyServiceability(pincode)
    : await delhivery.checkServiceability(pincode);
  if (!serviceability.serviceable) {
    const reason = serviceability.embargoed ? "temporarily embargoed" : "not serviceable";
    return response.status(422).json({
      code: serviceability.embargoed ? "PINCODE_EMBARGOED" : "PINCODE_NOT_SERVICEABLE",
      message: `PIN code ${pincode} is ${reason} by Delhivery.`,
      data: serviceability,
    });
  }
  const paymentLookup = { prepaid: "Prepaid", "pre-paid": "Prepaid", cod: "COD", pickup: "Pickup", repl: "REPL" };
  const payment = paymentLookup[String(body.paymentMode || body.payment || "Prepaid").trim().toLowerCase()];
  if (!payment) return response.status(400).json({ code: "INVALID_PAYMENT_MODE", message: "Payment mode must be Prepaid, COD, Pickup or REPL." });
  if (productType === "Heavy" && ["Pickup", "REPL"].includes(payment)) {
    return response.status(400).json({ code: "UNSUPPORTED_HEAVY_FLOW", message: "Heavy reverse and replacement manifestation are not available in the current Delhivery Heavy contract." });
  }
  if (payment === "COD" && !serviceability.cod) {
    return response.status(422).json({ code: "COD_NOT_SERVICEABLE", message: `Cash on delivery is unavailable for PIN code ${pincode}.`, data: serviceability });
  }
  if (payment === "Prepaid" && !serviceability.prepaid) {
    return response.status(422).json({ code: "PREPAID_NOT_SERVICEABLE", message: `Prepaid delivery is unavailable for PIN code ${pincode}.`, data: serviceability });
  }
  if (["Pickup", "REPL"].includes(payment) && !serviceability.pickup) {
    return response.status(422).json({ code: "PICKUP_NOT_SERVICEABLE", message: `Reverse pickup is unavailable for PIN code ${pincode}.`, data: serviceability });
  }
  const pickupLocation = String(process.env.DELHIVERY_PICKUP_LOCATION || "").trim();
  const clientName = String(process.env.DELHIVERY_CLIENT_NAME || "").trim();
  if (!pickupLocation || !clientName) {
    throw new DelhiveryError("Delhivery pickup location and client name are not configured.", { code: "DELHIVERY_MANIFEST_NOT_CONFIGURED", status: 503 });
  }
  const id = `PAX-${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
  const inputPieces = Array.isArray(body.pieces) && body.pieces.length ? body.pieces : [body];
  if (inputPieces.length > 100) return response.status(400).json({ code: "TOO_MANY_PIECES", message: "A multi-piece shipment cannot contain more than 100 boxes." });
  const providerPieces = inputPieces.map((piece) => manifestPiece(body, piece, user, id, payment));
  const mpsWaybills = inputPieces.length > 1 ? providerPieces.map((piece) => String(piece.waybill || "")) : [];
  if (mpsWaybills.length) await reserveMpsWaybills(mpsWaybills, id);
  let manifestation;
  try {
    manifestation = await delhivery.createShipment({
      pickupLocation,
      clientName,
      shipments: providerPieces,
      masterWaybill: body.masterWaybill,
      mpsAmount: payment === "COD" ? Number(body.codAmount ?? body.amount ?? 0) : 0,
    });
  } catch (error) {
    if (mpsWaybills.length && Number(error?.status) < 500) {
      await releaseMpsWaybills(mpsWaybills, id).catch((releaseError) => console.error("Unable to release rejected MPS waybills:", releaseError.message));
    }
    throw error;
  }
  const waybills = manifestation.packages.map((item) => item.waybill);
  const latestState = await readState();
  const shipment = {
    id,
    customer,
    phone,
    address,
    city,
    pincode,
    destination: `${city}, ${pincode}`,
    weight,
    amount: Number(body.amount) || 0,
    payment,
    productType,
    courier: "Delhivery",
    serviceabilityCheckedAt: new Date().toISOString(),
    ownerEmail: request.session.subject,
    customerId: user.id,
    status: "Manifested",
    waybill: waybills[0],
    waybills,
    packageCount: manifestation.packageCount,
    shipmentType: mpsWaybills.length ? "MPS" : "SPS",
    ...(mpsWaybills.length ? {
      masterWaybill: String(body.masterWaybill || mpsWaybills[0]),
      mpsAmount: payment === "COD" ? Number(body.codAmount ?? body.amount ?? 0) : 0,
    } : {}),
    providerStatus: "Manifested",
    manifestedAt: new Date().toISOString(),
    pickupLocation,
    date: new Date().toISOString(),
  };
  latestState.shipments.unshift(shipment);
  const customerRecord = latestState.customers.find((item) => item.id === user.id);
  if (customerRecord) customerRecord.shipments = Number(customerRecord.shipments || 0) + 1;
  latestState.activities.unshift({ title: `${shipment.id} manifested`, detail: user.businessName || user.email, tone: "green", createdAt: shipment.date });
  latestState.activities = latestState.activities.slice(0, 50);
  await writeState(latestState, "shipment.created");
  await markWaybillsUsed(waybills, shipment.id);
  response.status(201).json({ data: shipment });
});

app.get("/api/tracking/:id", async (request, response) => {
  const reference = String(request.params.id || "").trim().toUpperCase();
  if (!/^PAX-[A-Z0-9]{6,20}$/.test(reference)) return response.status(400).json({ message: "Enter a valid Pax shipment reference." });
  const state = await readState();
  const shipment = state.shipments.find((item) => String(item.id).toUpperCase() === reference);
  if (!shipment) return response.status(404).json({ message: "Shipment not found." });
  const { ownerEmail, customerId, phone, address, pickupLocation: _pickupLocation, ...publicShipment } = shipment;
  response.json({ data: publicShipment });
});

app.use((error, _request, response, _next) => {
  if (error instanceof DelhiveryError) {
    return response.status(error.status).json({ code: error.code, message: error.message });
  }
  console.error(error);
  response.status(500).json({ message: "The Pax API could not complete this request." });
});

app.listen(port, () => console.log(`Pax Logistics API listening on port ${port}`));
