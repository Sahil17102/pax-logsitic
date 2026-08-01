const DEFAULT_BASE_URLS = {
  staging: "https://staging-express.delhivery.com",
  production: "https://track.delhivery.com",
};

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 2000;
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const DEFAULT_RATE_LIMIT_REQUESTS = 4000;
const DEFAULT_HEAVY_RATE_LIMIT_REQUESTS = 2700;
const DEFAULT_TAT_RATE_LIMIT_REQUESTS = 675;
const DEFAULT_WAYBILL_RATE_LIMIT_REQUESTS = 5;
const DEFAULT_WAYBILL_WINDOW_COUNT = 50000;
const DEFAULT_SINGLE_WAYBILL_RATE_LIMIT_REQUESTS = 675;
const TRANSPORT_MODES = { S: "Surface", E: "Express", N: "Next Day Delivery" };

export class DelhiveryError extends Error {
  constructor(message, { code = "DELHIVERY_ERROR", status = 502, cause } = {}) {
    super(message, { cause });
    this.name = "DelhiveryError";
    this.code = code;
    this.status = status;
  }
}

function parseBooleanFlag(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["y", "yes", "true", "1", "available", "serviceable"].includes(normalized)) return true;
  if (["n", "no", "false", "0", "unavailable", "non-serviceable", "not serviceable", "nsz"].includes(normalized)) return false;
  return null;
}

function firstDefined(record, keys) {
  for (const key of keys) {
    if (record?.[key] !== undefined && record?.[key] !== null) return record[key];
  }
  return undefined;
}

function waybillValuesFrom(value) {
  if (Array.isArray(value)) return value.flatMap(waybillValuesFrom);
  if (value && typeof value === "object") {
    return waybillValuesFrom(firstDefined(value, ["waybills", "waybill", "waybill_number", "waybillNumber", "awbs", "awb", "awb_numbers", "awb_number", "number"]));
  }
  return String(value ?? "")
    .split(/[\s,|]+/)
    .map((item) => item.trim())
    .filter((item) => /^\d{8,20}$/.test(item));
}

export function normalizeDelhiveryWaybills(payload) {
  const source = Array.isArray(payload)
    ? payload
    : firstDefined(payload, ["waybills", "waybill", "data", "results", "awb_numbers", "awbs"]);
  return [...new Set(waybillValuesFrom(source))];
}

export function normalizeDelhiveryServiceability(payload, requestedPincode) {
  const deliveryCodes = Array.isArray(payload?.delivery_codes) ? payload.delivery_codes : [];
  const wrapper = deliveryCodes[0];
  const postalCode = wrapper?.postal_code || wrapper?.postalCode || wrapper;

  if (!postalCode || typeof postalCode !== "object") {
    return {
      provider: "delhivery",
      pincode: requestedPincode,
      status: "non_serviceable",
      serviceable: false,
      embargoed: false,
      remark: "",
      cod: false,
      prepaid: false,
      reversePickup: false,
      pickup: false,
      city: "",
      district: "",
      stateCode: "",
    };
  }

  const remark = String(firstDefined(postalCode, ["remark", "remarks"]) ?? "").trim();
  const embargoed = /^embargo$/i.test(remark);
  const serviceable = !embargoed && remark === "";

  return {
    provider: "delhivery",
    pincode: String(firstDefined(postalCode, ["pin", "pincode", "postal_code"]) ?? requestedPincode),
    status: serviceable ? "serviceable" : embargoed ? "embargoed" : "non_serviceable",
    serviceable,
    embargoed,
    remark,
    cod: serviceable && (parseBooleanFlag(firstDefined(postalCode, ["cod", "cash", "cod_service"])) ?? false),
    prepaid: serviceable && (parseBooleanFlag(firstDefined(postalCode, ["pre_paid", "prepaid", "pre_paid_service"])) ?? false),
    reversePickup: serviceable && (parseBooleanFlag(firstDefined(postalCode, ["reverse_pickup", "reverse", "repl"])) ?? false),
    pickup: serviceable && (parseBooleanFlag(firstDefined(postalCode, ["pickup", "pickup_service"])) ?? false),
    city: String(firstDefined(postalCode, ["city", "city_name"]) ?? ""),
    district: String(firstDefined(postalCode, ["district", "district_name"]) ?? ""),
    stateCode: String(firstDefined(postalCode, ["state_code", "stateCode", "state"]) ?? ""),
  };
}

function heavyRecords(payload) {
  const source = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.serviceability)
        ? payload.serviceability
        : payload?.data && typeof payload.data === "object"
          ? [payload.data]
          : payload?.result && typeof payload.result === "object"
            ? [payload.result]
            : [payload];
  return source
    .map((record) => record?.postal_code || record?.postalCode || record)
    .filter((record) => record && typeof record === "object");
}

function paymentModesFrom(value) {
  if (Array.isArray(value)) return value.flatMap(paymentModesFrom);
  if (value && typeof value === "object") {
    const namedMode = firstDefined(value, ["type", "name", "mode", "payment_type", "paymentType"]);
    if (namedMode !== undefined) {
      const availability = firstDefined(value, ["serviceable", "available", "enabled", "status"]);
      return parseBooleanFlag(availability) === false || /\bNSZ\b|(?:non|not)[-_ ]?serviceable/i.test(String(availability ?? ""))
        ? []
        : paymentModesFrom(namedMode);
    }
    return Object.entries(value).flatMap(([mode, availability]) => {
      const enabled = parseBooleanFlag(availability);
      const status = String(availability ?? "").trim();
      return enabled === true || /serviceable|available|success/i.test(status) ? [mode] : [];
    });
  }
  return String(value ?? "")
    .split(/[,|/]+/)
    .map((mode) => mode.trim())
    .filter(Boolean);
}

function explicitHeavyServiceability(records) {
  for (const record of records) {
    const value = firstDefined(record, ["serviceable", "is_serviceable", "serviceability"]);
    const flag = parseBooleanFlag(value);
    if (flag !== null) return flag;
    if (/\bNSZ\b|(?:non|not)[-_ ]?serviceable/i.test(String(value ?? ""))) return false;
  }
  return null;
}

export function normalizeDelhiveryHeavyServiceability(payload, requestedPincode) {
  const records = heavyRecords(payload);
  const searchableResponse = [
    typeof payload === "string" ? payload : "",
    ...records.flatMap((record) => [
      firstDefined(record, ["status", "message", "remark", "remarks", "serviceability"]),
      firstDefined(record, ["payment_type", "paymentType", "payment_types"]),
    ]),
  ].map((value) => typeof value === "object" ? JSON.stringify(value) : String(value ?? "")).join(" ");
  const nsz = /\bNSZ\b|(?:non|not)[-_ ]?serviceable/i.test(searchableResponse);
  const paymentTypes = [...new Set(records.flatMap((record) => paymentModesFrom(
    firstDefined(record, ["payment_type", "paymentType", "payment_types"]),
  )))];
  const allPayments = paymentTypes.some((mode) => /^(all|both)$/i.test(mode));
  const cod = !nsz && (allPayments || paymentTypes.some((mode) => /\bcod\b|cash/i.test(mode)));
  const prepaid = !nsz && (allPayments || paymentTypes.some((mode) => /pre[-_ ]?paid/i.test(mode)));
  const explicitServiceable = explicitHeavyServiceability(records);
  const serviceable = !nsz && (cod || prepaid || explicitServiceable === true);
  const record = records[0] || {};

  return {
    provider: "delhivery",
    productType: "Heavy",
    pincode: String(firstDefined(record, ["pin", "pincode", "postal_code"]) ?? requestedPincode),
    status: serviceable ? "serviceable" : "non_serviceable",
    serviceable,
    cod,
    prepaid,
    paymentTypes,
    remark: String(firstDefined(record, ["remark", "remarks", "message"]) ?? (nsz ? "NSZ" : "")).trim(),
    city: String(firstDefined(record, ["city", "city_name"]) ?? ""),
    district: String(firstDefined(record, ["district", "district_name"]) ?? ""),
    stateCode: String(firstDefined(record, ["state_code", "stateCode", "state"]) ?? ""),
  };
}

function tatRecordFrom(payload) {
  if (Array.isArray(payload)) return payload[0] || {};
  if (Array.isArray(payload?.data)) return payload.data[0] || {};
  if (payload?.data && typeof payload.data === "object") return payload.data;
  if (payload?.result && typeof payload.result === "object") return payload.result;
  return payload && typeof payload === "object" ? payload : {};
}

function parseTatDays(value) {
  if (value === null || value === undefined || value === "") return null;
  const matched = String(value).match(/\d+(?:\.\d+)?/);
  if (!matched) return null;
  const days = Number(matched[0]);
  return Number.isFinite(days) && days >= 0 ? days : null;
}

export function normalizeDelhiveryExpectedTat(payload, request) {
  const record = tatRecordFrom(payload);
  const tatDays = parseTatDays(firstDefined(record, ["tat", "tat_days", "tatDays", "expected_tat", "expectedTat", "expected_tat_days", "days"]));
  const expectedDeliveryDate = String(firstDefined(record, [
    "expected_delivery_date",
    "expectedDeliveryDate",
    "estimated_delivery_date",
    "estimatedDeliveryDate",
    "edd",
  ]) ?? "").trim();
  const remark = String(firstDefined(record, ["message", "remark", "remarks", "error"])
    ?? firstDefined(payload, ["message", "remark", "remarks", "error"])
    ?? "").trim();
  const nsz = /\bNSZ\b|(?:non|not)[-_ ]?serviceable/i.test([
    remark,
    firstDefined(record, ["status", "serviceability"]),
  ].join(" "));
  const available = !nsz && tatDays !== null;

  return {
    provider: "delhivery",
    originPin: String(firstDefined(record, ["origin_pin", "originPin", "origin_pincode"]) ?? request.originPin),
    destinationPin: String(firstDefined(record, ["destination_pin", "destinationPin", "destination_pincode"]) ?? request.destinationPin),
    mot: request.mot,
    modeOfTransport: TRANSPORT_MODES[request.mot],
    productType: request.pdt,
    expectedPickupDate: request.expectedPickupDate || "",
    status: available ? "available" : nsz ? "non_serviceable" : "unavailable",
    serviceable: available,
    tatDays,
    expectedDeliveryDate,
    remark: remark || (nsz ? "NSZ" : ""),
  };
}

function validExpectedPickupDate(value) {
  if (!value) return true;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?: ([01]\d|2[0-3]):([0-5]\d))?$/);
  if (!match) return false;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return date.getUTCFullYear() === Number(year)
    && date.getUTCMonth() === Number(month) - 1
    && date.getUTCDate() === Number(day);
}

function normalizeTatRequest(input = {}) {
  const originPin = String(input.originPin || input.origin_pin || "").trim();
  const destinationPin = String(input.destinationPin || input.destination_pin || "").trim();
  const mot = String(input.mot || "").trim().toUpperCase();
  const pdt = String(input.pdt || "B2C").trim().toUpperCase() || "B2C";
  const expectedPickupDate = String(input.expectedPickupDate || input.expected_pickup_date || "").trim();

  if (!/^[1-9]\d{5}$/.test(originPin) || !/^[1-9]\d{5}$/.test(destinationPin)) {
    throw new DelhiveryError("Enter valid 6-digit origin and destination PIN codes.", { code: "INVALID_TAT_PINCODE", status: 400 });
  }
  if (!Object.hasOwn(TRANSPORT_MODES, mot)) {
    throw new DelhiveryError("Mode of transport must be S, E or N.", { code: "INVALID_TRANSPORT_MODE", status: 400 });
  }
  if (!["B2C", "B2B"].includes(pdt)) {
    throw new DelhiveryError("Product type must be B2C or B2B.", { code: "INVALID_TAT_PRODUCT_TYPE", status: 400 });
  }
  if (!validExpectedPickupDate(expectedPickupDate)) {
    throw new DelhiveryError("Expected pickup date must use YYYY-MM-DD or YYYY-MM-DD HH:mm.", { code: "INVALID_PICKUP_DATE", status: 400 });
  }
  return { originPin, destinationPin, mot, pdt, expectedPickupDate };
}

function validateBaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new DelhiveryError("DELHIVERY_BASE_URL is not a valid URL.", {
      code: "DELHIVERY_INVALID_CONFIGURATION",
      status: 503,
    });
  }
  const insecureAllowed = process.env.DELHIVERY_ALLOW_INSECURE_HTTP === "true";
  if (url.protocol !== "https:" && !(insecureAllowed && url.protocol === "http:")) {
    throw new DelhiveryError("DELHIVERY_BASE_URL must use HTTPS.", {
      code: "DELHIVERY_INVALID_CONFIGURATION",
      status: 503,
    });
  }
  return url.toString().replace(/\/$/, "");
}

function validateProviderPath(value, variableName) {
  const path = String(value).trim();
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new DelhiveryError(`${variableName} must be an absolute path on the configured Delhivery host.`, {
      code: "DELHIVERY_INVALID_CONFIGURATION",
      status: 503,
    });
  }
  return path;
}

export function createDelhiveryClient({ fetchImpl = globalThis.fetch } = {}) {
  const environment = String(process.env.DELHIVERY_ENV || "production").trim().toLowerCase();
  const token = String(process.env.DELHIVERY_API_TOKEN || "").trim();
  const baseUrl = validateBaseUrl(process.env.DELHIVERY_BASE_URL || DEFAULT_BASE_URLS[environment] || DEFAULT_BASE_URLS.production);
  const configuredTimeout = Number(process.env.DELHIVERY_REQUEST_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : DEFAULT_TIMEOUT_MS;
  const configuredRateLimit = Number(process.env.DELHIVERY_RATE_LIMIT_REQUESTS);
  const rateLimitRequests = Number.isInteger(configuredRateLimit) && configuredRateLimit > 0
    ? Math.min(configuredRateLimit, 4500)
    : DEFAULT_RATE_LIMIT_REQUESTS;
  const configuredHeavyRateLimit = Number(process.env.DELHIVERY_HEAVY_RATE_LIMIT_REQUESTS);
  const heavyRateLimitRequests = Number.isInteger(configuredHeavyRateLimit) && configuredHeavyRateLimit > 0
    ? Math.min(configuredHeavyRateLimit, 3000)
    : DEFAULT_HEAVY_RATE_LIMIT_REQUESTS;
  const configuredTatRateLimit = Number(process.env.DELHIVERY_TAT_RATE_LIMIT_REQUESTS);
  const tatRateLimitRequests = Number.isInteger(configuredTatRateLimit) && configuredTatRateLimit > 0
    ? Math.min(configuredTatRateLimit, 750)
    : DEFAULT_TAT_RATE_LIMIT_REQUESTS;
  const configuredWaybillRateLimit = Number(process.env.DELHIVERY_WAYBILL_RATE_LIMIT_REQUESTS);
  const waybillRateLimitRequests = Number.isInteger(configuredWaybillRateLimit) && configuredWaybillRateLimit > 0
    ? Math.min(configuredWaybillRateLimit, 5)
    : DEFAULT_WAYBILL_RATE_LIMIT_REQUESTS;
  const configuredWaybillWindowCount = Number(process.env.DELHIVERY_WAYBILL_WINDOW_COUNT);
  const waybillWindowCount = Number.isInteger(configuredWaybillWindowCount) && configuredWaybillWindowCount > 0
    ? Math.min(configuredWaybillWindowCount, 50000)
    : DEFAULT_WAYBILL_WINDOW_COUNT;
  const waybillPath = validateProviderPath(process.env.DELHIVERY_WAYBILL_PATH || "/waybill/api/bulk/json/", "DELHIVERY_WAYBILL_PATH");
  const configuredSingleWaybillRateLimit = Number(process.env.DELHIVERY_SINGLE_WAYBILL_RATE_LIMIT_REQUESTS);
  const singleWaybillRateLimitRequests = Number.isInteger(configuredSingleWaybillRateLimit) && configuredSingleWaybillRateLimit > 0
    ? Math.min(configuredSingleWaybillRateLimit, 750)
    : DEFAULT_SINGLE_WAYBILL_RATE_LIMIT_REQUESTS;
  const singleWaybillPath = validateProviderPath(process.env.DELHIVERY_SINGLE_WAYBILL_PATH || "/waybill/api/fetch/json/", "DELHIVERY_SINGLE_WAYBILL_PATH");
  const cache = new Map();
  const pending = new Map();
  const rateWindows = new Map();
  const waybillCountWindow = { startedAt: Date.now(), count: 0 };

  function ensureConfigured() {
    if (!token) {
      throw new DelhiveryError("Delhivery integration is not configured.", {
        code: "DELHIVERY_NOT_CONFIGURED",
        status: 503,
      });
    }
    if (typeof fetchImpl !== "function") {
      throw new DelhiveryError("This runtime cannot connect to Delhivery.", {
        code: "DELHIVERY_RUNTIME_UNAVAILABLE",
        status: 503,
      });
    }
  }

  function consumeRateLimit(key, limit) {
    const now = Date.now();
    const rateWindow = rateWindows.get(key) || { startedAt: now, requests: 0 };
    if (now - rateWindow.startedAt >= RATE_LIMIT_WINDOW_MS) {
      rateWindow.startedAt = now;
      rateWindow.requests = 0;
    }
    if (rateWindow.requests >= limit) {
      throw new DelhiveryError("Delhivery API rate limit has been reached. Try again shortly.", {
        code: "DELHIVERY_RATE_LIMITED",
        status: 429,
      });
    }
    rateWindow.requests += 1;
    rateWindows.set(key, rateWindow);
  }

  function consumeWaybillCount(count) {
    const now = Date.now();
    if (now - waybillCountWindow.startedAt >= RATE_LIMIT_WINDOW_MS) {
      waybillCountWindow.startedAt = now;
      waybillCountWindow.count = 0;
    }
    if (waybillCountWindow.count + count > waybillWindowCount) {
      throw new DelhiveryError("The 50,000-waybill generation window has been reached. Try again shortly.", {
        code: "DELHIVERY_WAYBILL_WINDOW_LIMIT",
        status: 429,
      });
    }
    waybillCountWindow.count += count;
  }

  async function requestJson(endpoint, rateLimitKey, limit, { includeAuthorization = true } = {}) {
    consumeRateLimit(rateLimitKey, limit);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(endpoint, {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...(includeAuthorization ? { Authorization: `Token ${token}` } : {}),
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new DelhiveryError(response.status === 429
          ? "Delhivery API is temporarily rate limited."
          : "Delhivery rejected the request.", {
          code: response.status === 429 ? "DELHIVERY_RATE_LIMITED" : "DELHIVERY_UPSTREAM_ERROR",
          status: response.status === 429 ? 429 : 502,
        });
      }

      let payload;
      try {
        payload = await response.json();
      } catch (error) {
        throw new DelhiveryError("Delhivery returned an invalid response.", {
          code: "DELHIVERY_INVALID_RESPONSE",
          status: 502,
          cause: error,
        });
      }
      return payload;
    } catch (error) {
      if (error instanceof DelhiveryError) throw error;
      if (error?.name === "AbortError") {
        throw new DelhiveryError("Delhivery did not respond in time.", {
          code: "DELHIVERY_TIMEOUT",
          status: 504,
          cause: error,
        });
      }
      throw new DelhiveryError("Delhivery API is temporarily unavailable.", {
        code: "DELHIVERY_UNAVAILABLE",
        status: 502,
        cause: error,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  async function fetchServiceability(pincode) {
    const endpoint = new URL("/c/api/pin-codes/json/", `${baseUrl}/`);
    endpoint.searchParams.set("filter_codes", pincode);
    const payload = await requestJson(endpoint, "parcel", rateLimitRequests);
    return normalizeDelhiveryServiceability(payload, pincode);
  }

  async function fetchHeavyServiceability(pincode) {
    const endpoint = new URL("/api/dc/fetch/serviceability/pincode", `${baseUrl}/`);
    endpoint.searchParams.set("product_type", "Heavy");
    endpoint.searchParams.set("pincode", pincode);
    const payload = await requestJson(endpoint, "heavy", heavyRateLimitRequests);
    return normalizeDelhiveryHeavyServiceability(payload, pincode);
  }

  async function fetchExpectedTat(request) {
    const endpoint = new URL("/api/dc/expected_tat", `${baseUrl}/`);
    endpoint.searchParams.set("origin_pin", request.originPin);
    endpoint.searchParams.set("destination_pin", request.destinationPin);
    endpoint.searchParams.set("mot", request.mot);
    endpoint.searchParams.set("pdt", request.pdt);
    if (request.expectedPickupDate) endpoint.searchParams.set("expected_pickup_date", request.expectedPickupDate);
    const payload = await requestJson(endpoint, "expected-tat", tatRateLimitRequests);
    return normalizeDelhiveryExpectedTat(payload, request);
  }

  async function fetchWaybills(inputCount) {
    ensureConfigured();
    const count = Number(inputCount);
    if (!Number.isInteger(count) || count < 1 || count > 10000) {
      throw new DelhiveryError("Waybill count must be an integer between 1 and 10,000.", {
        code: "INVALID_WAYBILL_COUNT",
        status: 400,
      });
    }
    consumeWaybillCount(count);
    const endpoint = new URL(waybillPath, `${baseUrl}/`);
    endpoint.searchParams.set("count", String(count));
    const payload = await requestJson(endpoint, "waybill", waybillRateLimitRequests);
    const waybills = normalizeDelhiveryWaybills(payload);
    if (!waybills.length) {
      throw new DelhiveryError("Delhivery returned no valid waybills.", {
        code: "DELHIVERY_INVALID_RESPONSE",
        status: 502,
      });
    }
    return { provider: "delhivery", requestedCount: count, receivedCount: waybills.length, waybills };
  }

  async function fetchSingleWaybill() {
    ensureConfigured();
    const endpoint = new URL(singleWaybillPath, `${baseUrl}/`);
    endpoint.searchParams.set("token", token);
    const payload = await requestJson(endpoint, "single-waybill", singleWaybillRateLimitRequests, { includeAuthorization: false });
    const waybills = normalizeDelhiveryWaybills(payload);
    if (waybills.length !== 1) {
      throw new DelhiveryError("Delhivery did not return exactly one valid waybill.", {
        code: "DELHIVERY_INVALID_RESPONSE",
        status: 502,
      });
    }
    return { provider: "delhivery", requestedCount: 1, receivedCount: 1, waybills };
  }

  async function checkServiceability(pincode) {
    ensureConfigured();
    const normalizedPincode = String(pincode || "").trim();
    if (!/^[1-9]\d{5}$/.test(normalizedPincode)) {
      throw new DelhiveryError("Enter a valid 6-digit Indian PIN code.", {
        code: "INVALID_PINCODE",
        status: 400,
      });
    }

    const cached = cache.get(normalizedPincode);
    if (cached && cached.expiresAt > Date.now()) return structuredClone(cached.data);
    if (pending.has(normalizedPincode)) return structuredClone(await pending.get(normalizedPincode));

    const request = fetchServiceability(normalizedPincode)
      .then((data) => {
        if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
        cache.set(normalizedPincode, { data, expiresAt: Date.now() + DEFAULT_CACHE_TTL_MS });
        return data;
      })
      .finally(() => pending.delete(normalizedPincode));
    pending.set(normalizedPincode, request);
    return structuredClone(await request);
  }

  async function checkHeavyServiceability(pincode) {
    ensureConfigured();
    const normalizedPincode = String(pincode || "").trim();
    if (!/^[1-9]\d{5}$/.test(normalizedPincode)) {
      throw new DelhiveryError("Enter a valid 6-digit Indian PIN code.", {
        code: "INVALID_PINCODE",
        status: 400,
      });
    }

    const cacheKey = `heavy:${normalizedPincode}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return structuredClone(cached.data);
    if (pending.has(cacheKey)) return structuredClone(await pending.get(cacheKey));

    const request = fetchHeavyServiceability(normalizedPincode)
      .then((data) => {
        if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
        cache.set(cacheKey, { data, expiresAt: Date.now() + DEFAULT_CACHE_TTL_MS });
        return data;
      })
      .finally(() => pending.delete(cacheKey));
    pending.set(cacheKey, request);
    return structuredClone(await request);
  }

  async function getExpectedTat(input) {
    ensureConfigured();
    const normalized = normalizeTatRequest(input);
    const cacheKey = `tat:${normalized.originPin}:${normalized.destinationPin}:${normalized.mot}:${normalized.pdt}:${normalized.expectedPickupDate}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return structuredClone(cached.data);
    if (pending.has(cacheKey)) return structuredClone(await pending.get(cacheKey));

    const request = fetchExpectedTat(normalized)
      .then((data) => {
        if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
        cache.set(cacheKey, { data, expiresAt: Date.now() + DEFAULT_CACHE_TTL_MS });
        return data;
      })
      .finally(() => pending.delete(cacheKey));
    pending.set(cacheKey, request);
    return structuredClone(await request);
  }

  return {
    environment,
    configured: Boolean(token),
    checkServiceability,
    checkHeavyServiceability,
    getExpectedTat,
    fetchWaybills,
    fetchSingleWaybill,
  };
}
