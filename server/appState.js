import pg from "pg";
import { cloneDefaultControlState } from "../src/data/defaultControlState.js";

const { Pool } = pg;

export const APP_STATE_SCHEMA_VERSION = 3;
export const APP_STATE_ROW_ID = 1;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createInitialAppState() {
  return {
    schemaVersion: APP_STATE_SCHEMA_VERSION,
    configuration: cloneDefaultControlState(),
    admins: [],
    customers: [],
    users: [],
    shipments: [],
    activities: [],
    updatedAt: new Date().toISOString(),
  };
}

export function migrateAppState(value) {
  const initial = createInitialAppState();
  const state = value && typeof value === "object" ? clone(value) : initial;
  const storedVersion = Number(state.schemaVersion || 0);

  if (storedVersion < 2) {
    const sampleCustomerIds = new Set(["CUS-1048", "CUS-1042", "CUS-1039", "CUS-1033"]);
    const sampleShipmentIds = new Set(["PAX-260731", "PAX-260728", "PAX-260724", "PAX-260719", "PAX-260714", "PAX-260709"]);
    const sampleActivitySignatures = new Set([
      "PAX-260728 is out for delivery|Bengaluru delivery centre",
      "New customer account created|Aarav Retail",
      "Weight exception needs review|PAX-260714",
      "COD remittance processed|₹18,420",
    ]);
    state.customers = (Array.isArray(state.customers) ? state.customers : []).filter((item) => !sampleCustomerIds.has(item.id));
    state.shipments = (Array.isArray(state.shipments) ? state.shipments : []).filter((item) => !sampleShipmentIds.has(item.id));
    state.activities = (Array.isArray(state.activities) ? state.activities : []).filter((item) => !sampleActivitySignatures.has(`${item.title}|${item.detail}`));

    const legacyResourcePrefixes = new Set(["PLAN", "CRR", "KEY", "PRV", "B2B", "B2C", "INV", "COD", "WAL", "WGT", "DSP", "SUP"]);
    const existingResources = state.configuration?.resources || {};
    state.configuration = {
      ...cloneDefaultControlState(),
      ...(state.configuration || {}),
      resources: Object.fromEntries(Object.entries({
        ...cloneDefaultControlState().resources,
        ...existingResources,
      }).map(([key, records]) => [key, (Array.isArray(records) ? records : []).filter((record) => {
        const [prefix, sequence] = String(record.id || "").split("-");
        return !(legacyResourcePrefixes.has(prefix) && /^00[1-3]$/.test(sequence));
      })])),
    };
  }

  const defaults = cloneDefaultControlState();
  const configuration = state.configuration && typeof state.configuration === "object" ? state.configuration : {};
  state.configuration = {
    ...defaults,
    ...configuration,
    resources: { ...defaults.resources, ...(configuration.resources || {}) },
    settings: { ...defaults.settings, ...(configuration.settings || {}) },
    content: { ...defaults.content, ...(configuration.content || {}) },
    locations: {
      ...defaults.locations,
      ...(configuration.locations || {}),
      countries: Array.isArray(configuration.locations?.countries) ? configuration.locations.countries : [],
      states: Array.isArray(configuration.locations?.states) ? configuration.locations.states : [],
      cities: Array.isArray(configuration.locations?.cities) ? configuration.locations.cities : [],
    },
  };

  state.schemaVersion = APP_STATE_SCHEMA_VERSION;
  state.admins = Array.isArray(state.admins) ? state.admins : [];
  state.customers = Array.isArray(state.customers) ? state.customers : [];
  state.users = Array.isArray(state.users) ? state.users : [];
  state.shipments = Array.isArray(state.shipments) ? state.shipments : [];
  state.activities = Array.isArray(state.activities) ? state.activities : [];

  const customerEmails = new Set(state.customers.map((customer) => String(customer.email || "").toLowerCase()));
  state.users.forEach((user) => {
    const email = String(user.email || "").toLowerCase();
    if (!email || customerEmails.has(email)) return;
    state.customers.push({
      id: user.id,
      name: user.fullName || "Pax customer",
      business: user.businessName || "Individual account",
      email,
      phone: user.phone || "",
      city: user.city || "",
      shipments: state.shipments.filter((shipment) => shipment.ownerEmail === email || shipment.customerId === user.id).length,
      joinedAt: user.joinedAt || user.createdAt || state.updatedAt || new Date().toISOString(),
      status: user.disabled ? "Disabled" : "Active",
    });
    customerEmails.add(email);
  });

  return state;
}

function resolveSsl(connectionString) {
  if (process.env.DATABASE_SSL === "false") return false;
  if (process.env.DATABASE_SSL === "true") return { rejectUnauthorized: false };
  try {
    const hostname = new URL(connectionString).hostname;
    if (["localhost", "127.0.0.1", "::1"].includes(hostname)) return false;
  } catch {
    // Let pg report malformed connection strings with its normal error.
  }
  return { rejectUnauthorized: false };
}

export function createAppStatePool(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) throw new Error("DATABASE_URL is required for persistent app-state access.");
  return new Pool({ connectionString, ssl: resolveSsl(connectionString) });
}

export async function ensureAppStateSchema(database) {
  await database.query("CREATE TABLE IF NOT EXISTS pax_app_state (id INTEGER PRIMARY KEY, payload JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
  await database.query(
    "INSERT INTO pax_app_state (id, payload) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO NOTHING",
    [APP_STATE_ROW_ID, JSON.stringify(createInitialAppState())],
  );
}

export async function readAppState(database, { ensure = true } = {}) {
  if (ensure) await ensureAppStateSchema(database);
  const result = await database.query("SELECT payload FROM pax_app_state WHERE id = $1", [APP_STATE_ROW_ID]);
  const stored = result.rows[0]?.payload || createInitialAppState();
  const migrated = migrateAppState(stored);
  if (Number(stored.schemaVersion || 0) < APP_STATE_SCHEMA_VERSION) {
    await database.query(
      "UPDATE pax_app_state SET payload = $1::jsonb, updated_at = NOW() WHERE id = $2",
      [JSON.stringify(migrated), APP_STATE_ROW_ID],
    );
  }
  return migrated;
}

export async function writeAppState(database, nextState, { ensure = true } = {}) {
  const next = migrateAppState({ ...nextState, updatedAt: new Date().toISOString() });
  if (ensure) await ensureAppStateSchema(database);
  await database.query(
    "UPDATE pax_app_state SET payload = $1::jsonb, updated_at = NOW() WHERE id = $2",
    [JSON.stringify(next), APP_STATE_ROW_ID],
  );
  return clone(next);
}

export async function updateAppState(database, mutate) {
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    await ensureAppStateSchema(client);
    const result = await client.query("SELECT payload FROM pax_app_state WHERE id = $1 FOR UPDATE", [APP_STATE_ROW_ID]);
    const stored = result.rows[0]?.payload || createInitialAppState();
    const migrationRequired = Number(stored.schemaVersion || 0) < APP_STATE_SCHEMA_VERSION;
    const state = migrateAppState(stored);
    const mutation = await mutate(state);
    const seedChanged = Boolean(mutation?.changed);

    if (migrationRequired || seedChanged) {
      const next = migrateAppState({ ...state, updatedAt: new Date().toISOString() });
      await client.query(
        "UPDATE pax_app_state SET payload = $1::jsonb, updated_at = NOW() WHERE id = $2",
        [JSON.stringify(next), APP_STATE_ROW_ID],
      );
    }

    await client.query("COMMIT");
    return { ...mutation, changed: seedChanged, migrationApplied: migrationRequired };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
