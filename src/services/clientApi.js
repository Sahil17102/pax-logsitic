import { API_BASE_URL } from "../config.js";
import { normalizeClientBootstrap, normalizePickupRequest, normalizeShipment, unwrapApiData } from "./apiData.js";

const CLIENT_TOKEN_KEY = "pax-client-token";
const REQUEST_TIMEOUT = 6000;
const LONG_PROVIDER_REQUEST_TIMEOUT = 70000;

async function request(path, options = {}, timeoutMs = REQUEST_TIMEOUT) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  const token = localStorage.getItem(CLIENT_TOKEN_KEY) || sessionStorage.getItem(CLIENT_TOKEN_KEY);
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
      const error = new Error(payload.message || payload.error || `Request failed (${response.status})`);
      error.status = response.status;
      throw error;
    }
    return payload;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("The Pax API did not respond in time.");
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

function saveToken(token, remember = true) {
  if (!token) return;
  localStorage.removeItem(CLIENT_TOKEN_KEY);
  sessionStorage.removeItem(CLIENT_TOKEN_KEY);
  (remember ? localStorage : sessionStorage).setItem(CLIENT_TOKEN_KEY, token);
}

export async function registerClient(account, remember = true) {
  const payload = await request("/api/client/users", { method: "POST", body: JSON.stringify(account) });
  saveToken(payload.token, remember);
  return unwrapApiData(payload);
}

export async function loginClient(identifier, password, remember) {
  const payload = await request("/api/client/auth/login", { method: "POST", body: JSON.stringify({ identifier, password }) });
  saveToken(payload.token, remember);
  return unwrapApiData(payload);
}

export async function requestClientOtp(identifier) {
  return unwrapApiData(await request("/api/client/auth/otp/request", {
    method: "POST",
    body: JSON.stringify({ identifier }),
  }));
}

export async function verifyClientOtp(challengeId, otp, remember) {
  const payload = await request("/api/client/auth/otp/verify", {
    method: "POST",
    body: JSON.stringify({ challengeId, otp }),
  });
  saveToken(payload.token, remember);
  return unwrapApiData(payload);
}

export async function createClientShipment(shipment) {
  const payload = await request("/api/client/shipments", { method: "POST", body: JSON.stringify(shipment) });
  return normalizeShipment(unwrapApiData(payload));
}

export async function getClientServiceability(pincode) {
  return unwrapApiData(await request(`/api/client/serviceability/${encodeURIComponent(pincode)}`));
}

export async function getClientHeavyServiceability(pincode) {
  return unwrapApiData(await request(`/api/client/heavy-serviceability/${encodeURIComponent(pincode)}`));
}

export async function getClientExpectedTat({ originPin, destinationPin, mot, pdt = "B2C", expectedPickupDate = "" }) {
  const query = new URLSearchParams({ originPin, destinationPin, mot, pdt });
  if (expectedPickupDate) query.set("expectedPickupDate", expectedPickupDate);
  return unwrapApiData(await request(`/api/client/expected-tat?${query}`));
}

export async function getClientShippingCost({ md, cgm, originPin, destinationPin, status = "Delivered", paymentType, length, breadth, height, packageType }) {
  const query = new URLSearchParams({ md, cgm: String(cgm), o_pin: originPin, d_pin: destinationPin, ss: status, pt: paymentType });
  if (length !== undefined && length !== "") query.set("l", String(length));
  if (breadth !== undefined && breadth !== "") query.set("b", String(breadth));
  if (height !== undefined && height !== "") query.set("h", String(height));
  if (packageType) query.set("ipkg_type", packageType);
  return unwrapApiData(await request(`/api/client/shipping-cost?${query}`, {}, LONG_PROVIDER_REQUEST_TIMEOUT));
}

export async function getClientShippingLabel(shipmentId, { waybill = "", pdf = true, pdfSize = "A4" } = {}) {
  const query = new URLSearchParams({ pdf: String(pdf), pdf_size: pdfSize });
  if (waybill) query.set("waybill", waybill);
  return unwrapApiData(await request(`/api/client/shipments/${encodeURIComponent(shipmentId)}/label?${query}`, {}, LONG_PROVIDER_REQUEST_TIMEOUT));
}

export async function getClientShipmentDocument(shipmentId, { waybill = "", documentType } = {}) {
  const query = new URLSearchParams({ doc_type: documentType });
  if (waybill) query.set("waybill", waybill);
  return unwrapApiData(await request(`/api/client/shipments/${encodeURIComponent(shipmentId)}/document?${query}`, {}, LONG_PROVIDER_REQUEST_TIMEOUT));
}

export async function createClientPickupRequest({ pickupDate, pickupTime, pickupLocation = "", expectedPackageCount }) {
  const payload = await request("/api/client/pickup-requests", {
    method: "POST",
    body: JSON.stringify({
      pickup_date: pickupDate,
      pickup_time: pickupTime,
      ...(pickupLocation ? { pickup_location: pickupLocation } : {}),
      expected_package_count: Number(expectedPackageCount),
    }),
  });
  return normalizePickupRequest(unwrapApiData(payload));
}

export async function getClientPickupRequests() {
  const data = unwrapApiData(await request("/api/client/pickup-requests"));
  return Array.isArray(data) ? data.map(normalizePickupRequest).filter((item) => item.id) : [];
}

export async function getClientBootstrap() {
  return normalizeClientBootstrap(await request("/api/client/bootstrap"));
}

export async function trackShipment(reference) {
  const payload = await request(`/api/tracking/${encodeURIComponent(reference)}`);
  return normalizeShipment(unwrapApiData(payload));
}

export function logoutClient() {
  localStorage.removeItem(CLIENT_TOKEN_KEY);
  sessionStorage.removeItem(CLIENT_TOKEN_KEY);
}
