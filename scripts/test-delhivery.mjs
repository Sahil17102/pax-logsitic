import assert from "node:assert/strict";
import { buildDelhiveryShipmentPayload, createDelhiveryClient, DelhiveryError, normalizeDelhiveryExpectedTat, normalizeDelhiveryHeavyServiceability, normalizeDelhiveryServiceability, normalizeDelhiveryShipmentCreation, normalizeDelhiveryWaybills } from "../server/integrations/delhivery.js";

assert.deepEqual(normalizeDelhiveryWaybills({ waybills: ["900000000001", "900000000002", "900000000001"] }), ["900000000001", "900000000002"]);
assert.deepEqual(normalizeDelhiveryWaybills({ data: { awb_numbers: "900000000003, 900000000004" } }), ["900000000003", "900000000004"]);

const manifestInput = {
  pickupLocation: "Pax Test Warehouse",
  clientName: "Pax Test Client",
  shipments: [{ name: "Receiver", order: "PAX-ORDER-1", phone: "9123456789", address: "House & Market #2", pin: "194103", paymentMode: "COD", weightGrams: 1250, totalAmount: 999, codAmount: 999, productsDescription: "Shoes; shampoo", quantity: "2", shippingMode: "Surface", transportSpeed: "D" }],
};
const manifestPayload = buildDelhiveryShipmentPayload(manifestInput);
assert.equal(manifestPayload.pickup_location.name, "Pax Test Warehouse");
assert.equal(manifestPayload.shipments[0].add, "House & Market #2");
assert.equal(manifestPayload.shipments[0].payment_mode, "COD");
assert.equal(manifestPayload.shipments[0].cod_amount, 999);
assert.throws(() => buildDelhiveryShipmentPayload({ ...manifestInput, shipments: [{ ...manifestInput.shipments[0], totalAmount: 50000 }] }), (error) => error instanceof DelhiveryError && error.code === "EWAYBILL_REQUIRED");
assert.throws(() => buildDelhiveryShipmentPayload({ ...manifestInput, shipments: [manifestInput.shipments[0], { ...manifestInput.shipments[0], order: "PAX-ORDER-2" }] }), (error) => error instanceof DelhiveryError && error.code === "MPS_WAYBILL_REQUIRED");
assert.throws(() => buildDelhiveryShipmentPayload({ ...manifestInput, shipments: [{ ...manifestInput.shipments[0], waybill: "900000000001" }, { ...manifestInput.shipments[0], order: "PAX-ORDER-2", waybill: "900000000001" }] }), (error) => error instanceof DelhiveryError && error.code === "DUPLICATE_MPS_WAYBILL");
const normalizedManifest = normalizeDelhiveryShipmentCreation({ packages: [{ status: "Success", waybill: "920000000001", refnum: "PAX-ORDER-1" }], upload_wbn: "UP-1" }, 1);
assert.equal(normalizedManifest.manifested, true);
assert.equal(normalizedManifest.packages[0].waybill, "920000000001");
const mpsManifestInput = {
  pickupLocation: "Pax Test Warehouse",
  clientName: "Pax Test Client",
  masterWaybill: "900000000002",
  mpsAmount: 2400,
  shipments: [
    { ...manifestInput.shipments[0], order: "PAX-MPS-1", waybill: "900000000001", codAmount: 1200, totalAmount: 1200 },
    { ...manifestInput.shipments[0], order: "PAX-MPS-1", waybill: "900000000002", codAmount: 1200, totalAmount: 1200 },
  ],
};
const mpsManifestPayload = buildDelhiveryShipmentPayload(mpsManifestInput);
assert.equal(mpsManifestPayload.shipments[0].shipment_type, "MPS");
assert.equal(mpsManifestPayload.shipments[0].master_id, "900000000002");
assert.equal(mpsManifestPayload.shipments[1].mps_children, 2);
assert.equal(mpsManifestPayload.shipments[1].mps_amount, 2400);

const serviceable = normalizeDelhiveryServiceability({
  delivery_codes: [{ postal_code: { pin: 194103, cod: "Y", pre_paid: "Y", pickup: "N", reverse_pickup: "Y", remarks: "", district: "Leh", state_code: "LA" } }],
}, "194103");
assert.deepEqual(serviceable, {
  provider: "delhivery",
  pincode: "194103",
  status: "serviceable",
  serviceable: true,
  embargoed: false,
  remark: "",
  cod: true,
  prepaid: true,
  reversePickup: true,
  pickup: false,
  city: "",
  district: "Leh",
  stateCode: "LA",
});

const embargo = normalizeDelhiveryServiceability({
  delivery_codes: [{ postal_code: { pin: 110001, cod: "Y", pre_paid: "Y", remark: "Embargo" } }],
}, "110001");
assert.equal(embargo.status, "embargoed");
assert.equal(embargo.serviceable, false);
assert.equal(embargo.cod, false);

const nsz = normalizeDelhiveryServiceability({ delivery_codes: [] }, "999999");
assert.equal(nsz.status, "non_serviceable");
assert.equal(nsz.serviceable, false);

const heavy = normalizeDelhiveryHeavyServiceability({
  data: [{ pincode: 400086, product_type: "Heavy", payment_type: ["Pre-paid", "COD"], serviceability: "Serviceable", city: "Mumbai", state_code: "MH" }],
}, "400086");
assert.deepEqual(heavy, {
  provider: "delhivery",
  productType: "Heavy",
  pincode: "400086",
  status: "serviceable",
  serviceable: true,
  cod: true,
  prepaid: true,
  paymentTypes: ["Pre-paid", "COD"],
  remark: "",
  city: "Mumbai",
  district: "",
  stateCode: "MH",
});
const heavyNsz = normalizeDelhiveryHeavyServiceability({ pincode: 999999, payment_type: "NSZ", serviceability: "NSZ" }, "999999");
assert.equal(heavyNsz.status, "non_serviceable");
assert.equal(heavyNsz.cod, false);
assert.equal(heavyNsz.prepaid, false);

const tatRequest = { originPin: "122003", destinationPin: "136118", mot: "S", pdt: "B2C", expectedPickupDate: "2026-08-03 10:30" };
const tat = normalizeDelhiveryExpectedTat({ data: { origin_pin: 122003, destination_pin: 136118, tat: "3 Days", expected_delivery_date: "2026-08-06" } }, tatRequest);
assert.deepEqual(tat, {
  provider: "delhivery",
  originPin: "122003",
  destinationPin: "136118",
  mot: "S",
  modeOfTransport: "Surface",
  productType: "B2C",
  expectedPickupDate: "2026-08-03 10:30",
  status: "available",
  serviceable: true,
  tatDays: 3,
  expectedDeliveryDate: "2026-08-06",
  remark: "",
});
const tatNsz = normalizeDelhiveryExpectedTat({ data: { status: "NSZ", message: "NSZ" } }, { ...tatRequest, destinationPin: "999997" });
assert.equal(tatNsz.status, "non_serviceable");
assert.equal(tatNsz.tatDays, null);

const originalToken = process.env.DELHIVERY_API_TOKEN;
const originalBaseUrl = process.env.DELHIVERY_BASE_URL;
const originalInsecure = process.env.DELHIVERY_ALLOW_INSECURE_HTTP;
try {
  process.env.DELHIVERY_API_TOKEN = "test-token";
  process.env.DELHIVERY_BASE_URL = "http://127.0.0.1:9999";
  process.env.DELHIVERY_ALLOW_INSECURE_HTTP = "true";
  let requestCount = 0;
  const client = createDelhiveryClient({
    fetchImpl: async (url, options) => {
      requestCount += 1;
      const endpoint = new URL(url);
      if (endpoint.pathname === "/waybill/api/fetch/json/") {
        assert.equal(endpoint.searchParams.get("token"), "test-token");
        assert.equal(options.headers.Authorization, undefined);
        return new Response(JSON.stringify({ waybill: "910000000001" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      assert.equal(options.headers.Authorization, "Token test-token");
      if (endpoint.pathname === "/api/cmu/create.json") {
        assert.equal(options.method, "POST");
        if (options.headers["Content-Type"] === "application/json") {
          assert.deepEqual(JSON.parse(options.body), mpsManifestPayload);
          return new Response(JSON.stringify({ packages: [
            { status: "Success", waybill: "900000000001", refnum: "PAX-MPS-1" },
            { status: "Success", waybill: "900000000002", refnum: "PAX-MPS-1" },
          ] }), { status: 200, headers: { "Content-Type": "application/json" } });
        }
        assert.equal(options.headers["Content-Type"], "application/x-www-form-urlencoded");
        const form = new URLSearchParams(options.body);
        assert.equal(form.get("format"), "json");
        assert.deepEqual(JSON.parse(form.get("data")), manifestPayload);
        return new Response(JSON.stringify({ packages: [{ status: "Success", waybill: "920000000001", refnum: "PAX-ORDER-1" }], upload_wbn: "UP-1" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (endpoint.pathname === "/waybill/api/bulk/json/") {
        assert.equal(endpoint.searchParams.get("count"), "2");
        return new Response(JSON.stringify({ data: { waybills: ["900000000001", "900000000002"] } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (endpoint.pathname === "/api/dc/expected_tat") {
        assert.equal(endpoint.searchParams.get("origin_pin"), "122003");
        assert.equal(endpoint.searchParams.get("destination_pin"), "136118");
        assert.equal(endpoint.searchParams.get("mot"), "S");
        assert.equal(endpoint.searchParams.get("pdt"), "B2C");
        assert.equal(endpoint.searchParams.get("expected_pickup_date"), "2026-08-03 10:30");
        return new Response(JSON.stringify({ data: { tat: 3, expected_delivery_date: "2026-08-06" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (endpoint.pathname === "/api/dc/fetch/serviceability/pincode") {
        assert.equal(endpoint.searchParams.get("product_type"), "Heavy");
        assert.equal(endpoint.searchParams.get("pincode"), "400086");
        return new Response(JSON.stringify({ data: [{ pincode: 400086, payment_type: { COD: "Y", Prepaid: "Serviceable" }, serviceability: "Serviceable" }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      assert.equal(endpoint.searchParams.get("filter_codes"), "194103");
      return new Response(JSON.stringify({ delivery_codes: [{ postal_code: { pin: 194103, cod: "Y", pre_paid: "Y", remarks: "" } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });
  await client.checkServiceability("194103");
  await client.checkServiceability("194103");
  await client.checkHeavyServiceability("400086");
  await client.checkHeavyServiceability("400086");
  await client.getExpectedTat(tatRequest);
  await client.getExpectedTat(tatRequest);
  const fetchedWaybills = await client.fetchWaybills(2);
  assert.deepEqual(fetchedWaybills.waybills, ["900000000001", "900000000002"]);
  const fetchedSingleWaybill = await client.fetchSingleWaybill();
  assert.deepEqual(fetchedSingleWaybill.waybills, ["910000000001"]);
  const manifested = await client.createShipment(manifestInput);
  assert.equal(manifested.packages[0].waybill, "920000000001");
  const manifestedMps = await client.createShipment(mpsManifestInput);
  assert.equal(manifestedMps.packageCount, 2);
  assert.equal(requestCount, 7, "each Delhivery contract uses its independent provider request path");
  await assert.rejects(() => client.checkServiceability("123"), (error) => error instanceof DelhiveryError && error.status === 400);
  await assert.rejects(() => client.fetchWaybills(0), (error) => error instanceof DelhiveryError && error.code === "INVALID_WAYBILL_COUNT");
  await assert.rejects(() => client.fetchWaybills(10001), (error) => error instanceof DelhiveryError && error.code === "INVALID_WAYBILL_COUNT");
  await assert.rejects(() => client.getExpectedTat({ ...tatRequest, mot: "X" }), (error) => error instanceof DelhiveryError && error.code === "INVALID_TRANSPORT_MODE");
  await assert.rejects(() => client.getExpectedTat({ ...tatRequest, expectedPickupDate: "2026-02-30" }), (error) => error instanceof DelhiveryError && error.code === "INVALID_PICKUP_DATE");
} finally {
  if (originalToken === undefined) delete process.env.DELHIVERY_API_TOKEN; else process.env.DELHIVERY_API_TOKEN = originalToken;
  if (originalBaseUrl === undefined) delete process.env.DELHIVERY_BASE_URL; else process.env.DELHIVERY_BASE_URL = originalBaseUrl;
  if (originalInsecure === undefined) delete process.env.DELHIVERY_ALLOW_INSECURE_HTTP; else process.env.DELHIVERY_ALLOW_INSECURE_HTTP = originalInsecure;
}

console.log(JSON.stringify({ serviceable: serviceable.pincode, embargoed: embargo.pincode, nsz: nsz.pincode, heavy: heavy.pincode, heavyNsz: heavyNsz.pincode, tatDays: tat.tatDays, tatNsz: tatNsz.status, bulkWaybillVerified: true, singleWaybillVerified: true, manifestationVerified: true, mpsManifestationVerified: true, mpsJsonVerified: true, urlEncodingVerified: true, waybillParser: true, cacheVerified: true }));
