import { API_BASE_URL } from "../config.js";
import { normalizeAdminDashboard, normalizeCustomer, normalizeShipment, unwrapApiData } from "./apiData.js";

const ADMIN_TOKEN_KEY = "pax-admin-token";
const REQUEST_TIMEOUT = 8000;
const SHIPPING_COST_REQUEST_TIMEOUT = 70000;

function getToken() {
  return sessionStorage.getItem(ADMIN_TOKEN_KEY) || localStorage.getItem(ADMIN_TOKEN_KEY) || "";
}

async function request(path, options = {}, timeoutMs = REQUEST_TIMEOUT) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  const token = getToken();

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || payload.error || `Request failed (${response.status})`);
    }
    return payload;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("The Pax API did not respond in time.");
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

export function hasAdminToken() {
  return Boolean(getToken());
}

export async function loginAdmin({ username, password, remember }) {
  const payload = await request("/api/admin/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  if (!payload.token) throw new Error("The API did not return an admin access token.");
  const storage = remember ? localStorage : sessionStorage;
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  storage.setItem(ADMIN_TOKEN_KEY, payload.token);
  return payload.admin || { name: "Pax Administrator", username };
}

export function logoutAdmin() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
}

export async function getAdminDashboard() {
  return normalizeAdminDashboard(await request("/api/admin/dashboard"));
}

export async function getAdminServiceability(pincode) {
  return unwrapApiData(await request(`/api/admin/serviceability/${encodeURIComponent(pincode)}`));
}

export async function getAdminHeavyServiceability(pincode) {
  return unwrapApiData(await request(`/api/admin/heavy-serviceability/${encodeURIComponent(pincode)}`));
}

export async function getAdminExpectedTat({ originPin, destinationPin, mot, pdt = "B2C", expectedPickupDate = "" }) {
  const query = new URLSearchParams({ originPin, destinationPin, mot, pdt });
  if (expectedPickupDate) query.set("expectedPickupDate", expectedPickupDate);
  return unwrapApiData(await request(`/api/admin/expected-tat?${query}`));
}

export async function getAdminShippingCost({ md, cgm, originPin, destinationPin, status = "Delivered", paymentType, length, breadth, height, packageType }) {
  const query = new URLSearchParams({ md, cgm: String(cgm), o_pin: originPin, d_pin: destinationPin, ss: status, pt: paymentType });
  if (length !== undefined && length !== "") query.set("l", String(length));
  if (breadth !== undefined && breadth !== "") query.set("b", String(breadth));
  if (height !== undefined && height !== "") query.set("h", String(height));
  if (packageType) query.set("ipkg_type", packageType);
  return unwrapApiData(await request(`/api/admin/shipping-cost?${query}`, {}, SHIPPING_COST_REQUEST_TIMEOUT));
}

export async function fetchDelhiveryWaybills(count) {
  return unwrapApiData(await request("/api/admin/delhivery/waybills/fetch", {
    method: "POST",
    body: JSON.stringify({ count }),
  }));
}

export async function fetchDelhiverySingleWaybill() {
  return unwrapApiData(await request("/api/admin/delhivery/waybills/fetch-single", {
    method: "POST",
  }));
}

export async function getDelhiveryWaybills({ status = "", limit = 100, offset = 0 } = {}) {
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (status) query.set("status", status);
  return unwrapApiData(await request(`/api/admin/delhivery/waybills?${query}`));
}

export async function setShipmentStatus(shipmentId, status) {
  const payload = await request(`/api/admin/shipments/${encodeURIComponent(shipmentId)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  return normalizeShipment(unwrapApiData(payload));
}

export async function saveAdminConfiguration(configuration) {
  const payload = await request("/api/admin/configuration", {
    method: "PUT",
    body: JSON.stringify({ configuration }),
  });
  return unwrapApiData(payload);
}

export async function setCustomerAccess(customerId, enabled) {
  const payload = await request(`/api/admin/customers/${encodeURIComponent(customerId)}/access`, {
    method: "PATCH",
    body: JSON.stringify({ enabled }),
  });
  return normalizeCustomer(unwrapApiData(payload));
}

export { API_BASE_URL };
