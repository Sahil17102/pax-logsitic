import { API_BASE_URL } from "../config.js";
import { DEFAULT_CONTROL_STATE, cloneDefaultControlState } from "../data/defaultControlState.js";

export { DEFAULT_CONTROL_STATE };

export const CONTROL_KEY = "pax-shared-control-v1";
export const CONTROL_EVENT = "pax:control-updated";

function cloneDefaults() {
  return cloneDefaultControlState();
}

export function readControlState() {
  try {
    const saved = JSON.parse(localStorage.getItem(CONTROL_KEY) || "null");
    if (!saved || typeof saved !== "object") return cloneDefaults();
    return {
      ...cloneDefaults(),
      ...saved,
      resources: { ...cloneDefaults().resources, ...(saved.resources || {}) },
      settings: { ...cloneDefaults().settings, ...(saved.settings || {}) },
      content: { ...cloneDefaults().content, ...(saved.content || {}) },
    };
  } catch {
    return cloneDefaults();
  }
}

export function writeControlState(nextState) {
  const next = { ...nextState, revision: Number(nextState.revision || 0) + 1, updatedAt: new Date().toISOString() };
  return cacheControlState(next);
}

export function cacheControlState(nextState) {
  const next = { ...cloneDefaults(), ...nextState };
  localStorage.setItem(CONTROL_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(CONTROL_EVENT, { detail: next }));
  return next;
}

export function subscribeToLocalControl(handler) {
  const onStorage = (event) => {
    if (event.key === CONTROL_KEY) handler(readControlState());
  };
  const onControl = (event) => handler(event.detail || readControlState());
  window.addEventListener("storage", onStorage);
  window.addEventListener(CONTROL_EVENT, onControl);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CONTROL_EVENT, onControl);
  };
}

export function subscribeToRemoteUpdates(handler) {
  if (typeof EventSource === "undefined") return () => undefined;
  const source = new EventSource(`${API_BASE_URL}/api/events`);
  ["configuration.updated", "shipment.updated", "shipment.created", "customer.updated", "customer.created"].forEach((eventName) => {
    source.addEventListener(eventName, handler);
  });
  return () => source.close();
}
