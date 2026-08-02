import assert from "node:assert/strict";
import { APP_STATE_SCHEMA_VERSION, createInitialAppState, migrateAppState } from "../server/appState.js";
import { passwordMatches } from "../server/passwords.js";
import {
  assignBasicPlanState,
  seedAdminState,
  seedBasicPlanState,
  seedLocationsState,
} from "./lib/seedDefinitions.mjs";

const state = migrateAppState(createInitialAppState());
const adminOptions = {
  id: "ADM-SUPER-001",
  username: "seed-test-admin",
  name: "Seed Test Admin",
  email: "seed-test@example.com",
  password: "SeedTestPassword123",
};

const firstRun = [
  await seedAdminState(state, adminOptions),
  seedBasicPlanState(state),
  assignBasicPlanState(state, adminOptions),
  seedLocationsState(state),
];
assert.ok(firstRun.every((result) => result.changed));
assert.equal(state.admins.length, 1);
assert.equal(state.admins[0].role, "super_admin");
assert.equal(await passwordMatches(adminOptions.password, state.admins[0]), true);
assert.equal(state.configuration.resources.plans.length, 1);
assert.equal(state.admins[0].planId, "PLAN-BASIC");
assert.equal(state.configuration.locations.countries.length, 1);
assert.equal(state.configuration.locations.states.length, 6);
assert.equal(state.configuration.locations.cities.length, 8);

const snapshot = JSON.stringify(state);
const secondRun = [
  await seedAdminState(state, adminOptions),
  seedBasicPlanState(state),
  assignBasicPlanState(state, adminOptions),
  seedLocationsState(state),
];
assert.ok(secondRun.every((result) => !result.changed));
assert.equal(JSON.stringify(state), snapshot);

const migratedLegacyState = migrateAppState({
  schemaVersion: 2,
  configuration: { resources: { plans: [] } },
  customers: [{ id: "CUS-REAL", email: "real@example.com" }],
  users: [],
  shipments: [],
  activities: [],
});
assert.equal(migratedLegacyState.schemaVersion, APP_STATE_SCHEMA_VERSION);
assert.equal(migratedLegacyState.customers[0].id, "CUS-REAL");
assert.deepEqual(migratedLegacyState.admins, []);
assert.deepEqual(migratedLegacyState.pickupRequests, []);
assert.deepEqual(migratedLegacyState.warehouses, []);
assert.deepEqual(migratedLegacyState.configuration.locations, { countries: [], states: [], cities: [] });

console.log(JSON.stringify({
  idempotent: true,
  admins: state.admins.length,
  plans: state.configuration.resources.plans.length,
  assignedPlan: state.admins[0].planId,
  locations: {
    countries: state.configuration.locations.countries.length,
    states: state.configuration.locations.states.length,
    cities: state.configuration.locations.cities.length,
  },
}));
