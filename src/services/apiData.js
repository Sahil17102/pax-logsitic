import { cloneDefaultControlState } from "../data/defaultControlState.js";

export function unwrapApiData(payload) {
  if (!payload || typeof payload !== "object") return {};
  return payload.data && typeof payload.data === "object" ? payload.data : payload;
}

function firstValue(record, keys, fallback = "") {
  for (const key of keys) {
    const value = record?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
}

export function normalizeShipment(record = {}) {
  const city = firstValue(record, ["destinationCity", "destination_city", "city"]);
  const state = firstValue(record, ["destinationState", "destination_state", "state"]);
  const pincode = firstValue(record, ["destinationPincode", "destination_pincode", "pincode"]);
  const destination = firstValue(
    record,
    ["destination", "deliveryAddress", "delivery_address"],
    [city, state || pincode].filter(Boolean).join(", "),
  );

  return {
    ...record,
    id: String(firstValue(record, ["id", "reference", "trackingId", "tracking_id", "awb"])),
    customer: String(firstValue(record, ["customer", "receiverName", "receiver_name", "consigneeName", "consignee_name"], "Customer")),
    destination: String(destination || "—"),
    amount: Number(firstValue(record, ["amount", "orderValue", "order_value", "declaredValue", "declared_value"], 0)) || 0,
    payment: String(firstValue(record, ["payment", "paymentMode", "payment_mode"], "Prepaid")),
    status: String(firstValue(record, ["status", "shipmentStatus", "shipment_status"], "Pickup scheduled")),
    date: firstValue(record, ["date", "createdAt", "created_at", "bookedAt", "booked_at"], ""),
  };
}

export function normalizeCustomer(record = {}) {
  return {
    ...record,
    id: String(firstValue(record, ["id", "customerId", "customer_id"])),
    name: String(firstValue(record, ["name", "fullName", "full_name"], "Pax customer")),
    business: String(firstValue(record, ["business", "businessName", "business_name", "company"], "Individual account")),
    email: String(firstValue(record, ["email"], "—")),
    phone: String(firstValue(record, ["phone", "mobile"], "—")),
    city: String(firstValue(record, ["city"], "—")),
    shipments: Number(firstValue(record, ["shipments", "shipmentCount", "shipment_count"], 0)) || 0,
    joinedAt: firstValue(record, ["joinedAt", "joined_at", "createdAt", "created_at"], ""),
    status: String(firstValue(record, ["status"], "Active")),
  };
}

export function normalizeActivity(record = {}) {
  return {
    ...record,
    title: String(firstValue(record, ["title", "message"], "Activity updated")),
    detail: String(firstValue(record, ["detail", "description"], "")),
    tone: String(firstValue(record, ["tone", "type"], "blue")),
  };
}

export function normalizeConfiguration(configuration) {
  const defaults = cloneDefaultControlState();
  if (!configuration || typeof configuration !== "object") return defaults;
  return {
    ...defaults,
    ...configuration,
    resources: { ...defaults.resources, ...(configuration.resources || {}) },
    settings: { ...defaults.settings, ...(configuration.settings || {}) },
    content: { ...defaults.content, ...(configuration.content || {}) },
  };
}

export function normalizeAdminDashboard(payload) {
  const data = unwrapApiData(payload);
  return {
    shipments: Array.isArray(data.shipments) ? data.shipments.map(normalizeShipment).filter((item) => item.id) : [],
    customers: Array.isArray(data.customers) ? data.customers.map(normalizeCustomer).filter((item) => item.id) : [],
    activities: Array.isArray(data.activities) ? data.activities.map(normalizeActivity) : [],
    configuration: normalizeConfiguration(data.configuration),
    updatedAt: data.updatedAt || data.updated_at || null,
  };
}

export function normalizeClientBootstrap(payload) {
  const data = unwrapApiData(payload);
  return {
    shipments: Array.isArray(data.shipments) ? data.shipments.map(normalizeShipment).filter((item) => item.id) : [],
    configuration: normalizeConfiguration(data.configuration),
    user: data.user ? normalizeCustomer(data.user) : null,
    updatedAt: data.updatedAt || data.updated_at || null,
  };
}
