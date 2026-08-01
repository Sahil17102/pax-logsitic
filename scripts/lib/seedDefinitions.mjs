import { isDeepStrictEqual } from "node:util";
import { passwordMatches, hashPassword } from "../../server/passwords.js";

export const BASIC_PLAN_ID = "PLAN-BASIC";
export const SUPER_ADMIN_ID = "ADM-SUPER-001";

const DEFAULT_LOCATIONS = {
  countries: [
    { id: "COUNTRY-IN", code: "IN", iso2: "IN", name: "India", phoneCode: "+91", enabled: true },
  ],
  states: [
    ["STATE-IN-TS", "TS", "Telangana"],
    ["STATE-IN-MH", "MH", "Maharashtra"],
    ["STATE-IN-KA", "KA", "Karnataka"],
    ["STATE-IN-DL", "DL", "Delhi"],
    ["STATE-IN-TN", "TN", "Tamil Nadu"],
    ["STATE-IN-AP", "AP", "Andhra Pradesh"],
  ].map(([id, code, name]) => ({ id, code, name, countryId: "COUNTRY-IN", enabled: true })),
  cities: [
    ["CITY-IN-TS-HYD", "Hyderabad", "STATE-IN-TS"],
    ["CITY-IN-MH-BOM", "Mumbai", "STATE-IN-MH"],
    ["CITY-IN-MH-PNQ", "Pune", "STATE-IN-MH"],
    ["CITY-IN-KA-BLR", "Bengaluru", "STATE-IN-KA"],
    ["CITY-IN-DL-DEL", "New Delhi", "STATE-IN-DL"],
    ["CITY-IN-TN-MAA", "Chennai", "STATE-IN-TN"],
    ["CITY-IN-AP-VTZ", "Visakhapatnam", "STATE-IN-AP"],
    ["CITY-IN-AP-VGA", "Vijayawada", "STATE-IN-AP"],
  ].map(([id, name, stateId]) => ({ id, name, stateId, countryId: "COUNTRY-IN", enabled: true })),
};

function recordsEqual(left, right) {
  return isDeepStrictEqual(left, right);
}

function mergeMissing(existing, defaults) {
  const merged = { ...defaults, ...existing };
  for (const [key, value] of Object.entries(defaults)) {
    if (existing[key] === undefined || existing[key] === null || existing[key] === "") merged[key] = value;
  }
  return merged;
}

function upsertDefaults(existingRecords, defaultRecords, timestamp) {
  const records = Array.isArray(existingRecords) ? [...existingRecords] : [];
  let created = 0;
  let updated = 0;

  defaultRecords.forEach((defaultRecord) => {
    const index = records.findIndex((record) => record.id === defaultRecord.id
      || (defaultRecord.code && record.code === defaultRecord.code));
    if (index === -1) {
      records.push({ ...defaultRecord, createdAt: timestamp, updatedAt: timestamp });
      created += 1;
      return;
    }
    const merged = mergeMissing(records[index], defaultRecord);
    if (!recordsEqual(merged, records[index])) {
      records[index] = { ...merged, updatedAt: timestamp };
      updated += 1;
    }
  });

  return { records, created, updated, changed: created > 0 || updated > 0 };
}

export function resolveAdminSeedOptions(environment = process.env) {
  const isProduction = environment.NODE_ENV === "production";
  return {
    id: String(environment.SEED_ADMIN_ID || SUPER_ADMIN_ID).trim(),
    username: String(environment.SEED_ADMIN_USERNAME || environment.ADMIN_USERNAME || "admin").trim(),
    name: String(environment.SEED_ADMIN_NAME || "Pax Super Admin").trim(),
    email: String(environment.SEED_ADMIN_EMAIL || "").trim().toLowerCase(),
    password: String(environment.SEED_ADMIN_PASSWORD || environment.ADMIN_PASSWORD || (isProduction ? "" : "Pax@1234")),
  };
}

export async function seedAdminState(state, options = resolveAdminSeedOptions()) {
  state.admins = Array.isArray(state.admins) ? state.admins : [];
  const normalizedUsername = options.username.toLowerCase();
  const index = state.admins.findIndex((admin) => admin.id === options.id
    || String(admin.username || "").toLowerCase() === normalizedUsername
    || (options.email && String(admin.email || "").toLowerCase() === options.email));
  const existing = index >= 0 ? state.admins[index] : null;

  if (!existing && !options.password) {
    throw new Error("A password is required to create the Super Admin. Set SEED_ADMIN_PASSWORD or ADMIN_PASSWORD.");
  }

  const timestamp = new Date().toISOString();
  const next = {
    ...(existing || {}),
    id: existing?.id || options.id,
    username: options.username,
    name: options.name,
    role: "super_admin",
    disabled: false,
    createdAt: existing?.createdAt || timestamp,
  };
  if (options.email) next.email = options.email;

  if (options.password && !(existing && await passwordMatches(options.password, existing))) {
    const credentials = await hashPassword(options.password);
    next.passwordHash = credentials.hash;
    next.salt = credentials.salt;
  }

  const changed = !existing || !recordsEqual(existing, next);
  if (changed) next.updatedAt = timestamp;
  if (index >= 0) state.admins[index] = next;
  else state.admins.push(next);

  return {
    changed,
    message: changed ? `Super Admin ${next.username} seeded.` : `Super Admin ${next.username} already matches the seed.`,
    summary: { id: next.id, username: next.username, role: next.role },
  };
}

export function seedBasicPlanState(state) {
  const timestamp = new Date().toISOString();
  const resources = state.configuration.resources;
  const plans = Array.isArray(resources.plans) ? [...resources.plans] : [];
  const index = plans.findIndex((plan) => plan.id === BASIC_PLAN_ID
    || String(plan.code || plan.slug || "").toLowerCase() === "basic"
    || String(plan.cells?.[0] || "").toLowerCase() === "basic");
  const existing = index >= 0 ? plans[index] : null;
  const defaults = {
    id: BASIC_PLAN_ID,
    code: "basic",
    slug: "basic",
    name: "Basic",
    monthlyFee: 0,
    currency: "INR",
    shipmentLimit: 100,
    status: "Active",
    enabled: true,
    cells: ["Basic", "₹0/month", "100 shipments/month", "Active"],
  };
  const next = existing
    ? { ...mergeMissing(existing, defaults), cells: Array.isArray(existing.cells) && existing.cells.length === 4 ? existing.cells : defaults.cells }
    : { ...defaults, createdAt: timestamp, updatedAt: timestamp };
  const changed = !existing || !recordsEqual(existing, next);

  if (changed && existing) next.updatedAt = timestamp;
  if (index >= 0) plans[index] = next;
  else plans.unshift(next);
  if (changed) {
    state.configuration.resources = { ...resources, plans };
    state.configuration.revision = Number(state.configuration.revision || 0) + 1;
    state.configuration.updatedAt = timestamp;
  }

  return {
    changed,
    message: changed ? "Basic subscription plan seeded." : "Basic subscription plan already matches the seed.",
    summary: { id: next.id, name: next.name, monthlyFee: next.monthlyFee, shipmentLimit: next.shipmentLimit },
  };
}

export function assignBasicPlanState(state, options = resolveAdminSeedOptions()) {
  const plans = state.configuration?.resources?.plans || [];
  const plan = plans.find((record) => record.id === BASIC_PLAN_ID
    || String(record.code || record.slug || "").toLowerCase() === "basic"
    || String(record.cells?.[0] || "").toLowerCase() === "basic");
  if (!plan) throw new Error("Basic plan not found. Run npm run seedBasicPlan first.");

  const normalizedUsername = options.username.toLowerCase();
  const admin = (state.admins || []).find((record) => record.id === options.id
    || String(record.username || "").toLowerCase() === normalizedUsername)
    || (state.admins || []).find((record) => record.role === "super_admin" && !record.disabled);
  if (!admin) throw new Error("Super Admin not found. Run npm run seedAdmin first.");

  const timestamp = new Date().toISOString();
  const existingSubscription = admin.subscription && typeof admin.subscription === "object" ? admin.subscription : {};
  const nextSubscription = {
    ...existingSubscription,
    planId: plan.id,
    status: "active",
    assignedAt: existingSubscription.assignedAt || timestamp,
  };
  const changed = admin.planId !== plan.id || !recordsEqual(existingSubscription, nextSubscription);
  if (changed) {
    admin.planId = plan.id;
    admin.subscription = nextSubscription;
    admin.updatedAt = timestamp;
  }

  return {
    changed,
    message: changed ? `Basic plan assigned to ${admin.username}.` : `Basic plan is already assigned to ${admin.username}.`,
    summary: { adminId: admin.id, username: admin.username, planId: plan.id, status: nextSubscription.status },
  };
}

export function seedLocationsState(state) {
  const timestamp = new Date().toISOString();
  const existing = state.configuration.locations || { countries: [], states: [], cities: [] };
  const countries = upsertDefaults(existing.countries, DEFAULT_LOCATIONS.countries, timestamp);
  const states = upsertDefaults(existing.states, DEFAULT_LOCATIONS.states, timestamp);
  const cities = upsertDefaults(existing.cities, DEFAULT_LOCATIONS.cities, timestamp);
  const changed = countries.changed || states.changed || cities.changed;

  if (changed) {
    state.configuration.locations = {
      countries: countries.records,
      states: states.records,
      cities: cities.records,
    };
    state.configuration.revision = Number(state.configuration.revision || 0) + 1;
    state.configuration.updatedAt = timestamp;
  }

  return {
    changed,
    message: changed ? "Default service locations seeded." : "Default service locations already match the seed.",
    summary: {
      countries: countries.records.length,
      states: states.records.length,
      cities: cities.records.length,
      created: countries.created + states.created + cities.created,
      updated: countries.updated + states.updated + cities.updated,
    },
  };
}
