import assert from "node:assert/strict";
import { createDelhiveryClient, DelhiveryError, normalizeDelhiveryServiceability } from "../server/integrations/delhivery.js";

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
      assert.equal(new URL(url).searchParams.get("filter_codes"), "194103");
      assert.equal(options.headers.Authorization, "Token test-token");
      return new Response(JSON.stringify({ delivery_codes: [{ postal_code: { pin: 194103, cod: "Y", pre_paid: "Y", remarks: "" } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });
  await client.checkServiceability("194103");
  await client.checkServiceability("194103");
  assert.equal(requestCount, 1, "serviceability responses should be cached");
  await assert.rejects(() => client.checkServiceability("123"), (error) => error instanceof DelhiveryError && error.status === 400);
} finally {
  if (originalToken === undefined) delete process.env.DELHIVERY_API_TOKEN; else process.env.DELHIVERY_API_TOKEN = originalToken;
  if (originalBaseUrl === undefined) delete process.env.DELHIVERY_BASE_URL; else process.env.DELHIVERY_BASE_URL = originalBaseUrl;
  if (originalInsecure === undefined) delete process.env.DELHIVERY_ALLOW_INSECURE_HTTP; else process.env.DELHIVERY_ALLOW_INSECURE_HTTP = originalInsecure;
}

console.log(JSON.stringify({ serviceable: serviceable.pincode, embargoed: embargo.pincode, nsz: nsz.pincode, cacheVerified: true }));
