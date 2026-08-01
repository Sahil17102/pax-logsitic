import { API_BASE_URL } from "../config.js";

const ADMIN_TOKEN_KEY = "pax-admin-token";
const REQUEST_TIMEOUT = 8000;

function getToken() {
  return sessionStorage.getItem(ADMIN_TOKEN_KEY) || localStorage.getItem(ADMIN_TOKEN_KEY) || "";
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
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
  const payload = await request("/api/admin/dashboard");
  return payload.data || payload;
}

export async function setShipmentStatus(shipmentId, status) {
  const payload = await request(`/api/admin/shipments/${encodeURIComponent(shipmentId)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  return payload.data || payload;
}

export { API_BASE_URL };
