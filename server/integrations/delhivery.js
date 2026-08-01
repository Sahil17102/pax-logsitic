const DEFAULT_BASE_URLS = {
  staging: "https://staging-express.delhivery.com",
  production: "https://track.delhivery.com",
};

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 2000;
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const DEFAULT_RATE_LIMIT_REQUESTS = 4000;

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
  if (["n", "no", "false", "0", "unavailable", "non-serviceable"].includes(normalized)) return false;
  return null;
}

function firstDefined(record, keys) {
  for (const key of keys) {
    if (record?.[key] !== undefined && record?.[key] !== null) return record[key];
  }
  return undefined;
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
  const cache = new Map();
  const pending = new Map();
  const rateWindow = { startedAt: Date.now(), requests: 0 };

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

  async function fetchServiceability(pincode) {
    const now = Date.now();
    if (now - rateWindow.startedAt >= RATE_LIMIT_WINDOW_MS) {
      rateWindow.startedAt = now;
      rateWindow.requests = 0;
    }
    if (rateWindow.requests >= rateLimitRequests) {
      throw new DelhiveryError("Delhivery serviceability rate limit has been reached. Try again shortly.", {
        code: "DELHIVERY_RATE_LIMITED",
        status: 429,
      });
    }
    rateWindow.requests += 1;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const endpoint = new URL("/c/api/pin-codes/json/", `${baseUrl}/`);
    endpoint.searchParams.set("filter_codes", pincode);

    try {
      const response = await fetchImpl(endpoint, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Token ${token}`,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new DelhiveryError(response.status === 429
          ? "Delhivery serviceability is temporarily rate limited."
          : "Delhivery rejected the serviceability request.", {
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
      return normalizeDelhiveryServiceability(payload, pincode);
    } catch (error) {
      if (error instanceof DelhiveryError) throw error;
      if (error?.name === "AbortError") {
        throw new DelhiveryError("Delhivery did not respond in time.", {
          code: "DELHIVERY_TIMEOUT",
          status: 504,
          cause: error,
        });
      }
      throw new DelhiveryError("Delhivery serviceability is temporarily unavailable.", {
        code: "DELHIVERY_UNAVAILABLE",
        status: 502,
        cause: error,
      });
    } finally {
      clearTimeout(timer);
    }
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

  return {
    environment,
    configured: Boolean(token),
    checkServiceability,
  };
}
