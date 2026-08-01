import assert from "node:assert/strict";
import { createDelhiveryClient, DelhiveryError, normalizeDelhiveryHeavyServiceability, normalizeDelhiveryServiceability } from "../server/integrations/delhivery.js";

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
      assert.equal(options.headers.Authorization, "Token test-token");
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
  assert.equal(requestCount, 2, "parcel and Heavy responses should use independent caches");
  await assert.rejects(() => client.checkServiceability("123"), (error) => error instanceof DelhiveryError && error.status === 400);
} finally {
  if (originalToken === undefined) delete process.env.DELHIVERY_API_TOKEN; else process.env.DELHIVERY_API_TOKEN = originalToken;
  if (originalBaseUrl === undefined) delete process.env.DELHIVERY_BASE_URL; else process.env.DELHIVERY_BASE_URL = originalBaseUrl;
  if (originalInsecure === undefined) delete process.env.DELHIVERY_ALLOW_INSECURE_HTTP; else process.env.DELHIVERY_ALLOW_INSECURE_HTTP = originalInsecure;
}

console.log(JSON.stringify({ serviceable: serviceable.pincode, embargoed: embargo.pincode, nsz: nsz.pincode, heavy: heavy.pincode, heavyNsz: heavyNsz.pincode, cacheVerified: true }));
