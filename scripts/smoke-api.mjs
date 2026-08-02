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
  const shippingCost = await request("/api/client/shipping-cost?md=S&cgm=1500&o_pin=122003&d_pin=136118&ss=Delivered&pt=Pre-paid&l=20&b=15&h=10&ipkg_type=box", { headers: authorization });
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
  const shippingLabel = await request(`/api/client/shipments/${created.data.id}/label?waybill=${created.data.waybill}&pdf=true&pdf_size=4R`, { headers: authorization });
  const pickupDate = new Date(Date.now() + (330 * 60 * 1000) + (24 * 60 * 60 * 1000)).toISOString().slice(0, 10);
  const pickupRequest = await request("/api/client/pickup-requests", {
    method: "POST",
    headers: { ...authorization, "Content-Type": "application/json" },
    body: JSON.stringify({ pickup_date: pickupDate, pickup_time: "11:00:00", expected_package_count: 1 }),
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
  const adminAuthorization = { Authorization: `Bearer ${adminLogin.token}` };
  const warehouse = await request("/api/admin/delhivery/warehouses", {
    method: "POST",
    headers: { ...adminAuthorization, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Kota Test Warehouse",
      registeredName: "Pax Test Client",
      phone: "9999999999",
      email: "warehouse@example.com",
      address: "Industrial Area, Kota",
      city: "Kota",
      pin: "324001",
      country: "India",
      returnAddress: "Industrial Area, Kota",
      returnCity: "Kota",
      returnPin: "324001",
      returnState: "Rajasthan",
      returnCountry: "India",
    }),
  });
  const updatedWarehouse = await request(`/api/admin/delhivery/warehouses/${warehouse.data.id}`, {
    method: "PATCH",
    headers: { ...adminAuthorization, "Content-Type": "application/json" },
    body: JSON.stringify({
      phone: "9888888888",
      address: "Updated Industrial Area, Kota",
      pin: "324002",
    }),
  });
  const warehouses = await request("/api/admin/delhivery/warehouses", { headers: adminAuthorization });
  const dashboard = await request("/api/admin/dashboard", {
    headers: adminAuthorization,
  });
  const adminExpectedTat = await request("/api/admin/expected-tat?origin_pin=122003&destination_pin=136118&mot=E&pdt=B2C", {
    headers: { Authorization: `Bearer ${adminLogin.token}` },
  });
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
  assert.equal(shippingCost.data.estimatedAmount, 160.48);
  assert.equal(shippingCost.data.chargedWeightGrams, 1500);
  assert.equal(adminExpectedTat.data.tatDays, 2);
  assert.equal(warehouse.data.name, "Kota Test Warehouse");
  assert.equal(warehouse.data.status, "Registered");
  assert.equal(updatedWarehouse.data.name, "Kota Test Warehouse");
  assert.equal(updatedWarehouse.data.phone, "9888888888");
  assert.equal(updatedWarehouse.data.address, "Updated Industrial Area, Kota");
  assert.equal(updatedWarehouse.data.pin, "324002");
  assert.ok(updatedWarehouse.data.updatedAt);
  assert.equal(warehouses.data.length, 1);
  assert.equal(warehouses.data[0].pin, "324002");
  assert.equal(dashboard.data.warehouses.length, 1);
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
  assert.equal(shippingLabel.data.format, "pdf");
  assert.match(shippingLabel.data.downloadUrl, /^https:\/\/labels\.test\.delhivery\.local\//);
  assert.equal(pickupRequest.data.status, "Scheduled");
  assert.equal(pickupRequest.data.expectedPackageCount, 1);
  assert.equal(Object.hasOwn(pickupRequest.data, "ownerEmail"), false);
  assert.equal(after.data.pickupRequests.length, 1);
  assert.equal(secondBootstrap.data.pickupRequests.length, 0);
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
  assert.equal(Object.hasOwn(tracked.data, "pickupRequestId"), false);

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
    estimatedShippingCost: shippingCost.data.estimatedAmount,
    shippingLabelFormat: shippingLabel.data.format,
    pickupRequestStatus: pickupRequest.data.status,
    registeredWarehouses: warehouses.data.length,
    updatedWarehousePin: updatedWarehouse.data.pin,
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
