import crypto from "node:crypto";
import { promisify } from "node:util";
import express from "express";
import pg from "pg";
import { cloneDefaultControlState } from "../src/data/defaultControlState.js";

const { Pool } = pg;
const scrypt = promisify(crypto.scrypt);
const app = express();
const port = Number(process.env.PORT || 3000);
const adminUsername = process.env.ADMIN_USERNAME || "admin";
const isProduction = process.env.NODE_ENV === "production";
const adminPassword = process.env.ADMIN_PASSWORD || (isProduction ? "" : "Pax@1234");
const tokenSecret = process.env.JWT_SECRET || (isProduction ? "" : "pax-local-development-secret");
const schemaVersion = 2;
const configuredOrigins = String(process.env.FRONTEND_URLS || process.env.FRONTEND_URL || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const defaultOrigins = [
  "https://paxlogistic.onrender.com",
  "https://pax-logsiticadmin.onrender.com",
  "http://127.0.0.1:4173",
  "http://localhost:4173",
];
const allowedOrigins = new Set([...defaultOrigins, ...configuredOrigins]);

const seedState = {
  schemaVersion,
  configuration: cloneDefaultControlState(),
  customers: [],
  users: [],
  shipments: [],
  activities: [],
  updatedAt: new Date().toISOString(),
};

let memoryState = JSON.parse(JSON.stringify(seedState));
let pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }) : null;
let databaseReady = false;
const eventClients = new Set();

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

function migrateState(value) {
  const state = value && typeof value === "object" ? clone(value) : clone(seedState);
  if (Number(state.schemaVersion || 0) < schemaVersion) {
    const sampleCustomerIds = new Set(["CUS-1048", "CUS-1042", "CUS-1039", "CUS-1033"]);
    const sampleShipmentIds = new Set(["PAX-260731", "PAX-260728", "PAX-260724", "PAX-260719", "PAX-260714", "PAX-260709"]);
    state.customers = (Array.isArray(state.customers) ? state.customers : []).filter((item) => !sampleCustomerIds.has(item.id));
    state.shipments = (Array.isArray(state.shipments) ? state.shipments : []).filter((item) => !sampleShipmentIds.has(item.id));
    state.activities = [];
    const legacyResourcePrefixes = new Set(["PLAN", "CRR", "KEY", "PRV", "B2B", "B2C", "INV", "COD", "WAL", "WGT", "DSP", "SUP"]);
    const existingResources = state.configuration?.resources || {};
    const migratedResources = Object.fromEntries(Object.entries({
      ...cloneDefaultControlState().resources,
      ...existingResources,
    }).map(([key, records]) => [key, (Array.isArray(records) ? records : []).filter((record) => {
      const [prefix, sequence] = String(record.id || "").split("-");
      return !(legacyResourcePrefixes.has(prefix) && /^00[1-3]$/.test(sequence));
    })]));
    state.configuration = {
      ...cloneDefaultControlState(),
      ...(state.configuration || {}),
      resources: migratedResources,
    };
  }
  state.schemaVersion = schemaVersion;
  state.customers = Array.isArray(state.customers) ? state.customers : [];
  state.users = Array.isArray(state.users) ? state.users : [];
  state.shipments = Array.isArray(state.shipments) ? state.shipments : [];
  state.activities = Array.isArray(state.activities) ? state.activities : [];
  state.configuration = state.configuration && typeof state.configuration === "object"
    ? state.configuration
    : cloneDefaultControlState();
  return state;
}

async function initializeDatabase() {
  if (!pool || databaseReady) return;
  try {
    await pool.query("CREATE TABLE IF NOT EXISTS pax_app_state (id INTEGER PRIMARY KEY, payload JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
    await pool.query("INSERT INTO pax_app_state (id, payload) VALUES (1, $1::jsonb) ON CONFLICT (id) DO NOTHING", [JSON.stringify(seedState)]);
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
    memoryState = migrateState(memoryState);
    return clone(memoryState);
  }
  const result = await pool.query("SELECT payload FROM pax_app_state WHERE id = 1");
  const stored = result.rows[0]?.payload || clone(seedState);
  const migrated = migrateState(stored);
  if (Number(stored.schemaVersion || 0) < schemaVersion) {
    await pool.query("UPDATE pax_app_state SET payload = $1::jsonb, updated_at = NOW() WHERE id = 1", [JSON.stringify(migrated)]);
  }
  return migrated;
}

async function writeState(nextState, event = "state.updated") {
  const next = { ...nextState, updatedAt: new Date().toISOString() };
  await initializeDatabase();
  if (pool) await pool.query("UPDATE pax_app_state SET payload = $1::jsonb, updated_at = NOW() WHERE id = 1", [JSON.stringify(next)]);
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

async function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const derived = await scrypt(password, salt, 64);
  return { salt, hash: Buffer.from(derived).toString("hex") };
}

async function passwordMatches(password, record) {
  const candidate = await hashPassword(password, record.salt);
  return crypto.timingSafeEqual(Buffer.from(candidate.hash, "hex"), Buffer.from(record.passwordHash, "hex"));
}

function broadcast(event, state) {
  const packet = `event: ${event}\ndata: ${JSON.stringify({ revision: state.configuration?.revision, updatedAt: state.updatedAt })}\n\n`;
  eventClients.forEach((client) => client.write(packet));
}

app.get("/health", async (_request, response) => {
  await initializeDatabase();
  response.json({ ok: true, storage: pool ? "postgres" : "memory", service: "pax-logistic-api", schemaVersion });
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

app.post("/api/admin/auth/login", (request, response) => {
  if (!adminPassword || !tokenSecret) return response.status(503).json({ message: "Admin authentication is not configured." });
  const username = String(request.body?.username || "").trim();
  const password = String(request.body?.password || "");
  if (username !== adminUsername || password !== adminPassword) return response.status(401).json({ message: "Incorrect administrator username or password." });
  response.json({ token: issueToken(username, "admin"), admin: { name: "Pax Administrator", username } });
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
  const allowedStatuses = new Set(["Pickup scheduled", "In transit", "Out for delivery", "Delivered", "Exception", "RTO"]);
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

app.post("/api/client/auth/login", async (request, response) => {
  const email = String(request.body?.email || "").trim().toLowerCase();
  const state = await readState();
  const user = state.users.find((item) => item.email === email);
  if (!user || !(await passwordMatches(String(request.body?.password || ""), user))) return response.status(401).json({ message: "Incorrect email or password." });
  if (user.disabled) return response.status(403).json({ message: "This account is disabled by the Pax administrator." });
  const { passwordHash, salt, ...safeUser } = user;
  response.json({ data: safeUser, token: issueToken(email, "customer") });
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
  if (!customer || !/^\d{10}$/.test(phone) || !address || !city || !/^[1-9]\d{5}$/.test(pincode) || !Number.isFinite(weight) || weight <= 0) {
    return response.status(400).json({ message: "Valid receiver, phone, address, PIN code and parcel weight are required." });
  }
  const shipment = {
    id: `PAX-${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(2).toString("hex").toUpperCase()}`,
    customer,
    phone,
    address,
    city,
    pincode,
    destination: `${city}, ${pincode}`,
    weight,
    amount: Number(body.amount) || 0,
    payment: body.payment === "COD" ? "COD" : "Prepaid",
    ownerEmail: request.session.subject,
    customerId: user.id,
    status: "Pickup scheduled",
    date: new Date().toISOString(),
  };
  state.shipments.unshift(shipment);
  const customerRecord = state.customers.find((item) => item.id === user.id);
  if (customerRecord) customerRecord.shipments = Number(customerRecord.shipments || 0) + 1;
  state.activities.unshift({ title: `${shipment.id} created`, detail: user.businessName || user.email, tone: "green", createdAt: shipment.date });
  state.activities = state.activities.slice(0, 50);
  await writeState(state, "shipment.created");
  response.status(201).json({ data: shipment });
});

app.get("/api/tracking/:id", async (request, response) => {
  const reference = String(request.params.id || "").trim().toUpperCase();
  if (!/^PAX-[A-Z0-9]{6,20}$/.test(reference)) return response.status(400).json({ message: "Enter a valid Pax shipment reference." });
  const state = await readState();
  const shipment = state.shipments.find((item) => String(item.id).toUpperCase() === reference);
  if (!shipment) return response.status(404).json({ message: "Shipment not found." });
  const { ownerEmail, customerId, phone, address, ...publicShipment } = shipment;
  response.json({ data: publicShipment });
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ message: "The Pax API could not complete this request." });
});

app.listen(port, () => console.log(`Pax Logistics API listening on port ${port}`));
