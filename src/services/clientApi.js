import { API_BASE_URL } from "../config.js";

const CLIENT_TOKEN_KEY = "pax-client-token";
const REQUEST_TIMEOUT = 6000;

async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
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
    if (!response.ok) throw new Error(payload.message || `Request failed (${response.status})`);
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

export async function registerClient(account) {
  const payload = await request("/api/client/users", { method: "POST", body: JSON.stringify(account) });
  saveToken(payload.token, true);
  return payload.data || payload;
}

export async function loginClient(email, password, remember) {
  const payload = await request("/api/client/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
  saveToken(payload.token, remember);
  return payload.data || payload;
}

export async function createClientShipment(shipment) {
  const payload = await request("/api/client/shipments", { method: "POST", body: JSON.stringify(shipment) });
  return payload.data || payload;
}
