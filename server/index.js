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
const adminPassword = process.env.ADMIN_PASSWORD || "Pax@1234";
const tokenSecret = process.env.JWT_SECRET || "replace-this-pax-preview-secret";
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
  configuration: cloneDefaultControlState(),
  customers: [
    { id: "CUS-1048", name: "Aarav Sharma", business: "Aarav Retail", email: "aarav@retail.in", phone: "+91 98765 41048", city: "Hyderabad", shipments: 18, joinedAt: "28 Jul 2026", status: "Active" },
    { id: "CUS-1042", name: "Nila Reddy", business: "Nila Studios", email: "hello@nilastudios.in", phone: "+91 98490 22117", city: "Secunderabad", shipments: 12, joinedAt: "24 Jul 2026", status: "Active" },
    { id: "CUS-1039", name: "Rohan Mehta", business: "Mehta Home", email: "rohan@mehtahome.in", phone: "+91 97012 84530", city: "Hyderabad", shipments: 7, joinedAt: "19 Jul 2026", status: "Review" },
    { id: "CUS-1033", name: "Kavya Rao", business: "Kite Office", email: "ops@kiteoffice.in", phone: "+91 99596 31022", city: "Warangal", shipments: 22, joinedAt: "12 Jul 2026", status: "Active" },
  ],
  users: [],
  shipments: [
    { id: "PAX-260731", customer: "Aarav Retail", destination: "Mumbai, MH", amount: 1240, payment: "Prepaid", status: "In transit", date: "31 Jul 2026" },
    { id: "PAX-260728", customer: "Nila Studios", destination: "Bengaluru, KA", amount: 860, payment: "COD", status: "Out for delivery", date: "30 Jul 2026" },
    { id: "PAX-260724", customer: "Kite Office", destination: "Pune, MH", amount: 590, payment: "Prepaid", status: "Delivered", date: "29 Jul 2026" },
    { id: "PAX-260719", customer: "Rohan Mehta", destination: "Chennai, TN", amount: 1720, payment: "COD", status: "Pickup scheduled", date: "28 Jul 2026" },
    { id: "PAX-260714", customer: "Veda Foods", destination: "Vijayawada, AP", amount: 940, payment: "COD", status: "Exception", date: "27 Jul 2026" },
    { id: "PAX-260709", customer: "Mint Bazaar", destination: "Delhi, DL", amount: 1480, payment: "Prepaid", status: "Delivered", date: "26 Jul 2026" },
  ],
  activities: [
    { title: "PAX-260728 is out for delivery", detail: "Bengaluru delivery centre", tone: "blue" },
    { title: "New customer account created", detail: "Aarav Retail", tone: "green" },
    { title: "Weight exception needs review", detail: "PAX-260714", tone: "amber" },
  ],
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
  if (!pool) return clone(memoryState);
  const result = await pool.query("SELECT payload FROM pax_app_state WHERE id = 1");
  return result.rows[0]?.payload || clone(seedState);
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
  const payload = encode({ subject, role, expiresAt: Date.now() + (12 * 60 * 60 * 1000) });
  const signature = crypto.createHmac("sha256", tokenSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifyToken(token, expectedRole) {
  if (!token || !token.includes(".")) return null;
  const [payload, signature] = token.split(".");
  const expected = crypto.createHmac("sha256", tokenSecret).update(payload).digest("base64url");
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (decoded.expiresAt < Date.now() || (expectedRole && decoded.role !== expectedRole)) return null;
  return decoded;
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
  response.json({ ok: true, storage: pool ? "postgres" : "memory", service: "pax-logistic-api" });
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
  shipment.status = String(request.body?.status || shipment.status);
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

app.get("/api/client/bootstrap", async (_request, response) => {
  const state = await readState();
  response.json({ data: { configuration: state.configuration, shipments: state.shipments, updatedAt: state.updatedAt } });
});

app.post("/api/client/users", async (request, response) => {
  const email = String(request.body?.email || "").trim().toLowerCase();
  const password = String(request.body?.password || "");
  if (!email || password.length < 8) return response.status(400).json({ message: "A valid email and 8-character password are required." });
  const state = await readState();
  if (state.users.some((user) => user.email === email)) return response.status(409).json({ message: "An account already exists with this email." });
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
  const shipment = { ...request.body, id: request.body?.id || `PAX-${String(Date.now()).slice(-6)}`, status: "Pickup scheduled", date: new Date().toISOString() };
  state.shipments.unshift(shipment);
  await writeState(state, "shipment.created");
  response.status(201).json({ data: shipment });
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ message: "The Pax API could not complete this request." });
});

app.listen(port, () => console.log(`Pax Logistics API listening on port ${port}`));
