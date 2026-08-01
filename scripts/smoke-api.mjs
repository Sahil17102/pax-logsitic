import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { startDelhiveryStub } from "./lib/delhiveryStub.mjs";

const port = 3105;
const baseUrl = `http://127.0.0.1:${port}`;
const delhiveryStub = await startDelhiveryStub(3107, "contract-delhivery-token");
const server = spawn(process.execPath, ["server/index.js"], {
  cwd: new URL("..", import.meta.url),
  env: {
    ...process.env,
    PORT: String(port),
    ADMIN_PASSWORD: "",
    ADMIN_PASSWORD_SHA256: "a615a46a9f52e117dffce7d7235b464a910f74508dfb51a27ce8c63d0413d9a0",
    JWT_SECRET: "test-secret-for-contract-smoke",
    DELHIVERY_API_TOKEN: delhiveryStub.token,
    DELHIVERY_BASE_URL: delhiveryStub.baseUrl,
    DELHIVERY_ALLOW_INSECURE_HTTP: "true",
    DELHIVERY_PICKUP_LOCATION: "Pax Test Warehouse",
    DELHIVERY_CLIENT_NAME: "Pax Test Client",
  },
  stdio: "ignore",
});

async function request(path, options) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = await response.json();
  if (!response.ok) throw new Error(`${path}: ${body.message || response.status}`);
  return body;
}

try {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      await request("/health");
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  const register = await request("/api/client/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: "API Test User",
      businessName: "Contract Test",
      email: "contract@example.com",
      phone: "9876543210",
      password: "Secure123",
      address: "Test address",
      city: "Hyderabad",
      state: "Telangana",
      pincode: "500029",
    }),
  });
  const authorization = { Authorization: `Bearer ${register.token}` };
  const passwordByPhone = await request("/api/client/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "9876543210", password: "Secure123" }),
  });
  const otpRequest = await request("/api/client/auth/otp/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "9876543210" }),
  });
  const otpLogin = await request("/api/client/auth/otp/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ challengeId: otpRequest.data.challengeId, otp: otpRequest.data.previewCode }),
  });
  const before = await request("/api/client/bootstrap", { headers: authorization });
  const serviceability = await request("/api/client/serviceability/194103", { headers: authorization });
  const heavyServiceability = await request("/api/client/heavy-serviceability/400086", { headers: authorization });
  const expectedTat = await request("/api/client/expected-tat?originPin=122003&destinationPin=136118&mot=S&pdt=B2C", { headers: authorization });
  const created = await request("/api/client/shipments", {
    method: "POST",
    headers: { ...authorization, "Content-Type": "application/json" },
    body: JSON.stringify({
      customer: "Receiver Name",
      phone: "9123456789",
      address: "Delivery address & market #2",
      city: "Pune",
      pincode: "400086",
      weight: 2.5,
      productType: "Heavy",
      payment: "COD",
      amount: 750,
    }),
  });
  const tracked = await request(`/api/tracking/${created.data.id}`);
  const after = await request("/api/client/bootstrap", { headers: authorization });
  const secondRegister = await request("/api/client/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: "Second API User",
      businessName: "Second Contract Test",
      email: "second@example.com",
      phone: "9876543211",
      password: "Secure123",
      address: "Second test address",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400001",
    }),
  });
  const secondBootstrap = await request("/api/client/bootstrap", {
    headers: { Authorization: `Bearer ${secondRegister.token}` },
  });
  const adminLogin = await request("/api/admin/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "StrongPass123" }),
  });
  const dashboard = await request("/api/admin/dashboard", {
    headers: { Authorization: `Bearer ${adminLogin.token}` },
  });
  const adminExpectedTat = await request("/api/admin/expected-tat?origin_pin=122003&destination_pin=136118&mot=E&pdt=B2C", {
    headers: { Authorization: `Bearer ${adminLogin.token}` },
  });
  const adminAuthorization = { Authorization: `Bearer ${adminLogin.token}` };
  const fetchedWaybills = await request("/api/admin/delhivery/waybills/fetch", {
    method: "POST",
    headers: { ...adminAuthorization, "Content-Type": "application/json" },
    body: JSON.stringify({ count: 3 }),
  });
  const waybillInventory = await request("/api/admin/delhivery/waybills?status=stored&limit=10", { headers: adminAuthorization });
  const duplicateWaybills = await request("/api/admin/delhivery/waybills/fetch", {
    method: "POST",
    headers: { ...adminAuthorization, "Content-Type": "application/json" },
    body: JSON.stringify({ count: 3 }),
  });
  const singleWaybill = await request("/api/admin/delhivery/waybills/fetch-single", {
    method: "POST",
    headers: adminAuthorization,
  });
  const inventoryAfterSingle = await request("/api/admin/delhivery/waybills?status=stored&limit=10", { headers: adminAuthorization });
  const updated = await request(`/api/admin/shipments/${created.data.id}/status`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${adminLogin.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "Delivered" }),
  });

  assert.equal(before.data.shipments.length, 0);
  assert.equal(serviceability.data.serviceable, true);
  assert.equal(serviceability.data.cod, true);
  assert.equal(heavyServiceability.data.productType, "Heavy");
  assert.equal(heavyServiceability.data.serviceable, true);
  assert.equal(expectedTat.data.tatDays, 3);
  assert.equal(expectedTat.data.modeOfTransport, "Surface");
  assert.equal(adminExpectedTat.data.tatDays, 2);
  assert.equal(fetchedWaybills.data.storedCount, 3);
  assert.equal(fetchedWaybills.data.duplicateCount, 0);
  assert.equal(waybillInventory.data.summary.stored, 3);
  assert.equal(waybillInventory.data.items.length, 3);
  assert.equal(duplicateWaybills.data.storedCount, 0);
  assert.equal(duplicateWaybills.data.duplicateCount, 3);
  assert.equal(singleWaybill.data.receivedCount, 1);
  assert.equal(singleWaybill.data.storedCount, 1);
  assert.deepEqual(singleWaybill.data.preview, ["910000000001"]);
  assert.equal(inventoryAfterSingle.data.summary.stored, 4);
  assert.ok(passwordByPhone.token);
  assert.match(otpRequest.data.previewCode, /^\d{6}$/);
  assert.ok(otpLogin.token);
  assert.equal(after.data.shipments.length, 1);
  assert.equal(created.data.status, "Manifested");
  assert.match(created.data.waybill, /^\d{8,20}$/);
  assert.equal(created.data.packageCount, 1);
  assert.equal(secondBootstrap.data.shipments.length, 0);
  assert.equal(dashboard.data.shipments.length, 1);
  assert.equal(dashboard.data.customers.length, 2);
  assert.deepEqual(dashboard.data.customers.map((customer) => customer.name).sort(), ["API Test User", "Second API User"]);
  assert.equal(dashboard.data.customers.some((customer) => ["CUS-1048", "CUS-1042", "CUS-1039", "CUS-1033"].includes(customer.id)), false);
  assert.equal(dashboard.data.shipments.some((shipment) => ["PAX-260731", "PAX-260728", "PAX-260724", "PAX-260719", "PAX-260714", "PAX-260709"].includes(shipment.id)), false);
  assert.equal(updated.data.status, "Delivered");
  assert.equal(Object.hasOwn(tracked.data, "ownerEmail"), false);
  assert.equal(Object.hasOwn(tracked.data, "phone"), false);
  assert.equal(Object.hasOwn(tracked.data, "address"), false);
  assert.equal(Object.hasOwn(tracked.data, "pickupLocation"), false);

  console.log(JSON.stringify({
    initialShipments: before.data.shipments.length,
    phonePasswordLogin: Boolean(passwordByPhone.token),
    otpLogin: Boolean(otpLogin.token),
    createdId: created.data.id,
    trackedStatus: tracked.data.status,
    adminShipments: dashboard.data.shipments.length,
    adminCustomers: dashboard.data.customers.length,
    secondCustomerShipments: secondBootstrap.data.shipments.length,
    publicTrackingIsPrivate: !Object.hasOwn(tracked.data, "ownerEmail"),
    delhiveryServiceable: serviceability.data.serviceable,
    delhiveryHeavyServiceable: heavyServiceability.data.serviceable,
    expectedTatDays: expectedTat.data.tatDays,
    adminExpectedTatDays: adminExpectedTat.data.tatDays,
    storedWaybills: inventoryAfterSingle.data.summary.stored,
    duplicateWaybillsSkipped: duplicateWaybills.data.duplicateCount,
    singleWaybillStored: singleWaybill.data.storedCount,
  }));
} finally {
  server.kill();
  await delhiveryStub.close();
}

const productionPort = 3106;
const productionEnvironment = {
  ...process.env,
  PORT: String(productionPort),
  NODE_ENV: "production",
  REQUIRE_DATABASE: "true",
  ADMIN_PASSWORD: "StrongPass123",
  JWT_SECRET: "test-secret-for-production-health",
};
delete productionEnvironment.DATABASE_URL;
const productionServer = spawn(process.execPath, ["server/index.js"], {
  cwd: new URL("..", import.meta.url),
  env: productionEnvironment,
  stdio: "ignore",
});

try {
  let healthResponse;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      healthResponse = await fetch(`http://127.0.0.1:${productionPort}/health`);
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  assert.equal(healthResponse?.status, 503);
  const healthPayload = await healthResponse.json();
  assert.equal(healthPayload.storage, "unavailable");
  console.log(JSON.stringify({ productionWithoutDatabase: healthResponse.status }));
} finally {
  productionServer.kill();
}
