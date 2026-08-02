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
const DEFAULT_MANIFEST_RATE_LIMIT_REQUESTS = 18000;
const DEFAULT_EDIT_RATE_LIMIT_REQUESTS = 11000;
const DEFAULT_EWAYBILL_RATE_LIMIT_REQUESTS = 225;
const DEFAULT_TRACKING_RATE_LIMIT_REQUESTS = 675;
const DEFAULT_SHIPPING_COST_RATE_LIMIT_REQUESTS = 45;
const DEFAULT_SHIPPING_COST_TIMEOUT_MS = 65000;
const DEFAULT_TRACKING_CACHE_TTL_MS = 30 * 1000;
const TRANSPORT_MODES = { S: "Surface", E: "Express", N: "Next Day Delivery" };
const PAYMENT_MODES = new Map([
  ["prepaid", "Prepaid"],
  ["pre-paid", "Prepaid"],
  ["cod", "COD"],
  ["pickup", "Pickup"],
  ["repl", "REPL"],
]);

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

function optionalValue(value) {
  return value === undefined || value === null || value === "" ? undefined : value;
}

function requiredText(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    throw new DelhiveryError(`${field} is required for Delhivery shipment creation.`, {
      code: "INVALID_SHIPMENT",
      status: 400,
    });
  }
  return normalized;
}

export function buildDelhiveryShipmentPayload({ pickupLocation, clientName, shipments, masterWaybill, mpsAmount }) {
  const warehouse = requiredText(pickupLocation, "Pickup location");
  const client = requiredText(clientName, "Delhivery client name");
  if (!Array.isArray(shipments) || !shipments.length) {
    throw new DelhiveryError("At least one shipment piece is required.", { code: "INVALID_SHIPMENT", status: 400 });
  }
  const multiPiece = shipments.length > 1;
  const providerShipments = shipments.map((shipment, index) => {
    const paymentMode = PAYMENT_MODES.get(String(shipment.paymentMode || "").trim().toLowerCase());
    const phone = String(shipment.phone || "").replace(/\D/g, "");
    const pin = String(shipment.pin || "").trim();
    const waybill = String(shipment.waybill || "").trim();
    const totalAmount = Number(shipment.totalAmount || 0);
    const weightGrams = Number(shipment.weightGrams);
    const returnPhone = String(shipment.returnPhone || "").replace(/\D/g, "");
    const returnPin = String(shipment.returnPin || "").trim();
    const shippingMode = String(shipment.shippingMode || "").trim();
    const transportSpeed = String(shipment.transportSpeed || "").trim().toUpperCase();
    const addressType = String(shipment.addressType || "").trim().toLowerCase();
    if (!paymentMode) throw new DelhiveryError("Payment mode must be Prepaid, COD, Pickup or REPL.", { code: "INVALID_PAYMENT_MODE", status: 400 });
    if (!/^\d{10}$/.test(phone) || !/^[1-9]\d{5}$/.test(pin)) {
      throw new DelhiveryError("Every shipment piece requires a valid phone and PIN code.", { code: "INVALID_SHIPMENT", status: 400 });
    }
    if (multiPiece && !/^\d{8,20}$/.test(waybill)) {
      throw new DelhiveryError(`Multi-piece shipment piece ${index + 1} requires a valid waybill.`, { code: "MPS_WAYBILL_REQUIRED", status: 400 });
    }
    if (waybill && !/^\d{8,20}$/.test(waybill)) {
      throw new DelhiveryError(`Shipment piece ${index + 1} has an invalid waybill.`, { code: "INVALID_WAYBILL", status: 400 });
    }
    if (!Number.isFinite(weightGrams) || weightGrams <= 0) {
      throw new DelhiveryError(`Shipment piece ${index + 1} requires a positive weight in grams.`, { code: "INVALID_SHIPMENT_WEIGHT", status: 400 });
    }
    if (!Number.isFinite(totalAmount) || totalAmount < 0) {
      throw new DelhiveryError(`Shipment piece ${index + 1} has an invalid total amount.`, { code: "INVALID_SHIPMENT_AMOUNT", status: 400 });
    }
    if (returnPhone && !/^\d{10}$/.test(returnPhone)) {
      throw new DelhiveryError(`Shipment piece ${index + 1} has an invalid return phone.`, { code: "INVALID_RETURN_ADDRESS", status: 400 });
    }
    if (returnPin && !/^[1-9]\d{5}$/.test(returnPin)) {
      throw new DelhiveryError(`Shipment piece ${index + 1} has an invalid return PIN code.`, { code: "INVALID_RETURN_ADDRESS", status: 400 });
    }
    if (shippingMode && !["Surface", "Express"].includes(shippingMode)) {
      throw new DelhiveryError("Shipping mode must be Surface or Express.", { code: "INVALID_SHIPPING_MODE", status: 400 });
    }
    if (transportSpeed && !["D", "F"].includes(transportSpeed)) {
      throw new DelhiveryError("Transport speed must be D or F.", { code: "INVALID_TRANSPORT_SPEED", status: 400 });
    }
    if (addressType && !["home", "office"].includes(addressType)) {
      throw new DelhiveryError("Address type must be home or office.", { code: "INVALID_ADDRESS_TYPE", status: 400 });
    }
    if (Number.isFinite(totalAmount) && totalAmount >= 50000 && !String(shipment.ewbn || "").trim()) {
      throw new DelhiveryError("An e-waybill number is required when the shipment value is at least INR 50,000.", { code: "EWAYBILL_REQUIRED", status: 400 });
    }
    const providerShipment = {
      name: requiredText(shipment.name, "Consignee name"),
      order: requiredText(shipment.order, "Order ID"),
      phone,
      add: requiredText(shipment.address, "Consignee address"),
      pin,
      client,
      payment_mode: paymentMode,
      address_type: optionalValue(addressType),
      ewbn: optionalValue(shipment.ewbn),
      hsn_code: optionalValue(shipment.hsnCode),
      shipping_mode: optionalValue(shippingMode),
      seller_inv: optionalValue(shipment.sellerInvoice),
      city: optionalValue(shipment.city),
      weight: weightGrams,
      return_name: optionalValue(shipment.returnName),
      return_add: optionalValue(shipment.returnAddress),
      return_city: optionalValue(shipment.returnCity),
      return_phone: optionalValue(returnPhone),
      return_state: optionalValue(shipment.returnState),
      return_country: optionalValue(shipment.returnCountry),
      return_pin: optionalValue(returnPin),
      seller_name: optionalValue(shipment.sellerName),
      shipment_height: optionalValue(shipment.heightCm),
      shipment_width: optionalValue(shipment.widthCm),
      shipment_length: optionalValue(shipment.lengthCm),
      cod_amount: paymentMode === "COD" ? Math.max(0, Number(shipment.codAmount || totalAmount || 0)) : undefined,
      products_desc: optionalValue(shipment.productsDescription),
      state: optionalValue(shipment.state),
      dangerous_good: optionalValue(shipment.dangerousGood),
      waybill: optionalValue(waybill),
      total_amount: totalAmount,
      seller_add: optionalValue(shipment.sellerAddress),
      country: optionalValue(shipment.country),
      plastic_packaging: optionalValue(shipment.plasticPackaging),
      quantity: optionalValue(shipment.quantity),
      transport_speed: optionalValue(transportSpeed),
    };
    return Object.fromEntries(Object.entries(providerShipment).filter(([, value]) => value !== undefined));
  });
  if (multiPiece && new Set(providerShipments.map((shipment) => shipment.waybill)).size !== providerShipments.length) {
    throw new DelhiveryError("Every multi-piece shipment box requires a distinct waybill.", { code: "DUPLICATE_MPS_WAYBILL", status: 400 });
  }
  let finalShipments = providerShipments;
  if (multiPiece) {
    const masterId = String(masterWaybill || providerShipments[0].waybill || "").trim();
    if (!providerShipments.some((shipment) => shipment.waybill === masterId)) {
      throw new DelhiveryError("The MPS master waybill must belong to one of the shipment boxes.", { code: "INVALID_MPS_MASTER", status: 400 });
    }
    if (new Set(providerShipments.map((shipment) => shipment.payment_mode)).size !== 1) {
      throw new DelhiveryError("Every MPS box must use the same payment mode.", { code: "INVALID_MPS_PAYMENT", status: 400 });
    }
    const codShipment = providerShipments[0].payment_mode === "COD";
    const calculatedMpsAmount = codShipment
      ? Number(mpsAmount ?? providerShipments.reduce((sum, shipment) => sum + Number(shipment.cod_amount || 0), 0))
      : 0;
    if (!Number.isInteger(calculatedMpsAmount) || calculatedMpsAmount < 0) {
      throw new DelhiveryError("MPS COD amount must be a non-negative integer.", { code: "INVALID_MPS_AMOUNT", status: 400 });
    }
    finalShipments = providerShipments.map((shipment) => ({
      ...shipment,
      mps_amount: calculatedMpsAmount,
      mps_children: providerShipments.length,
      master_id: masterId,
      shipment_type: "MPS",
    }));
  }
  return {
    shipments: finalShipments,
    pickup_location: { name: warehouse },
    ...(shipments.some((shipment) => shipment.fragileShipment === true) ? { fragile_shipment: true } : {}),
  };
}

export function normalizeDelhiveryShipmentCreation(payload, expectedCount) {
  const packages = Array.isArray(payload?.packages) ? payload.packages : Array.isArray(payload?.data?.packages) ? payload.data.packages : [];
  const normalized = packages.map((item) => ({
    waybill: String(firstDefined(item, ["waybill", "waybill_number", "awb", "wbn"]) || "").trim(),
    orderId: String(firstDefined(item, ["refnum", "order", "order_id", "reference_number"]) || "").trim(),
    status: String(firstDefined(item, ["status", "success"]) || "").trim(),
    remark: String(firstDefined(item, ["remarks", "remark", "message", "error"]) || "").trim(),
  }));
  const accepted = normalized.length === expectedCount && normalized.every((item) => /^\d{8,20}$/.test(item.waybill) && /^(success|successful|true)$/i.test(item.status));
  if (!accepted) {
    const providerRemark = [payload?.rmk, payload?.remark, payload?.message, ...(Array.isArray(payload?.remarks) ? payload.remarks : []), ...normalized.map((item) => item.remark)].filter(Boolean).join("; ");
    throw new DelhiveryError(providerRemark || "Delhivery rejected the shipment manifestation.", {
      code: "DELHIVERY_MANIFEST_REJECTED",
      status: 422,
    });
  }
  return {
    provider: "delhivery",
    manifested: true,
    packageCount: normalized.length,
    uploadWaybill: String(firstDefined(payload, ["upload_wbn", "uploadWaybill"]) || "").trim(),
    packages: normalized,
  };
}

function editPaymentMode(value) {
  const normalized = String(value || "").trim().toLowerCase().replace(/[ _]+/g, "-");
  if (["prepaid", "pre-paid"].includes(normalized)) return "Prepaid";
  if (normalized === "cod") return "COD";
  return "";
}

function editNumber(value, field, { allowZero = false } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number) || (allowZero ? number < 0 : number <= 0)) {
    throw new DelhiveryError(`${field} must be ${allowZero ? "a non-negative" : "a positive"} number.`, {
      code: "INVALID_SHIPMENT_EDIT",
      status: 400,
    });
  }
  return number;
}

export function buildDelhiveryShipmentEditPayload(input = {}) {
  const waybill = String(input.waybill || "").trim();
  if (!/^\d{8,20}$/.test(waybill)) {
    throw new DelhiveryError("A valid waybill is required to edit a shipment.", { code: "INVALID_WAYBILL", status: 400 });
  }

  const payload = { waybill };
  let changedFields = 0;
  const hasValue = (key) => input[key] !== undefined && input[key] !== null && input[key] !== "";
  const setText = (inputKey, providerKey, label) => {
    if (!hasValue(inputKey)) return;
    payload[providerKey] = requiredText(input[inputKey], label);
    changedFields += 1;
  };
  const setNumber = (inputKey, providerKey, label) => {
    if (!hasValue(inputKey)) return;
    payload[providerKey] = editNumber(input[inputKey], label);
    changedFields += 1;
  };

  setText("name", "name", "Consignee name");
  setText("address", "add", "Consignee address");
  setText("productsDescription", "products_desc", "Product description");
  setNumber("weightGrams", "gm", "Shipment weight");
  setNumber("heightCm", "shipment_height", "Shipment height");
  setNumber("widthCm", "shipment_width", "Shipment width");
  setNumber("lengthCm", "shipment_length", "Shipment length");

  if (hasValue("phone")) {
    const phones = [...new Set((Array.isArray(input.phone) ? input.phone : [input.phone])
      .map((phone) => String(phone || "").replace(/\D/g, "")))];
    if (!phones.length || phones.some((phone) => !/^\d{10}$/.test(phone))) {
      throw new DelhiveryError("Consignee phone must contain valid 10-digit numbers.", { code: "INVALID_SHIPMENT_EDIT", status: 400 });
    }
    payload.phone = phones;
    changedFields += 1;
  }

  const currentPaymentMode = editPaymentMode(input.currentPaymentMode);
  const targetPaymentMode = hasValue("paymentMode") ? editPaymentMode(input.paymentMode) : "";
  if (hasValue("paymentMode")) {
    if (!targetPaymentMode) {
      throw new DelhiveryError("Payment mode can only be changed to COD or Prepaid.", { code: "INVALID_PAYMENT_MODE", status: 400 });
    }
    if (!currentPaymentMode || currentPaymentMode === targetPaymentMode) {
      throw new DelhiveryError("Only COD to Prepaid or Prepaid to COD conversion is allowed.", {
        code: "INVALID_PAYMENT_MODE_CONVERSION",
        status: 400,
      });
    }
    payload.pt = targetPaymentMode === "Prepaid" ? "Pre-paid" : "COD";
    changedFields += 1;
  }

  if (hasValue("codAmount")) {
    if ((targetPaymentMode || currentPaymentMode) !== "COD") {
      throw new DelhiveryError("COD amount can only be updated for a COD shipment.", { code: "INVALID_COD_AMOUNT", status: 400 });
    }
    payload.cod = editNumber(input.codAmount, "COD amount", { allowZero: true });
    changedFields += 1;
  }
  if (targetPaymentMode === "COD" && !hasValue("codAmount")) {
    throw new DelhiveryError("COD amount is required when converting a Prepaid shipment to COD.", { code: "COD_AMOUNT_REQUIRED", status: 400 });
  }
  if (!changedFields) {
    throw new DelhiveryError("Provide at least one supported shipment field to update.", { code: "NO_SHIPMENT_CHANGES", status: 400 });
  }
  return payload;
}

export function normalizeDelhiveryShipmentEdit(payload, waybill) {
  const record = payload?.data && typeof payload.data === "object" ? payload.data : payload;
  const status = firstDefined(record, ["success", "status", "updated"]);
  const remark = String(firstDefined(record, ["message", "remark", "remarks", "error", "detail"])
    ?? firstDefined(payload, ["message", "remark", "remarks", "error", "detail"])
    ?? "").trim();
  const rejected = status === false
    || status === 0
    || /^(false|failure|failed|error|rejected)$/i.test(String(status ?? "").trim())
    || /incorrect status|not allowed|cannot update|invalid waybill|no such waybill/i.test(remark);
  if (rejected) {
    throw new DelhiveryError(remark || "Delhivery rejected the shipment update.", {
      code: "DELHIVERY_EDIT_REJECTED",
      status: 422,
    });
  }
  return { provider: "delhivery", updated: true, waybill, remark };
}

export function buildDelhiveryShipmentCancellationPayload(input = {}) {
  const waybill = String(input.waybill || "").trim();
  if (!/^\d{8,20}$/.test(waybill)) {
    throw new DelhiveryError("A valid waybill is required to cancel a shipment.", { code: "INVALID_WAYBILL", status: 400 });
  }
  return { waybill, cancellation: "true" };
}

export function normalizeDelhiveryShipmentCancellation(payload, waybill) {
  try {
    const normalized = normalizeDelhiveryShipmentEdit(payload, waybill);
    return { provider: normalized.provider, cancelled: true, waybill, remark: normalized.remark };
  } catch (error) {
    if (!(error instanceof DelhiveryError) || error.code !== "DELHIVERY_EDIT_REJECTED") throw error;
    throw new DelhiveryError(error.message, { code: "DELHIVERY_CANCELLATION_REJECTED", status: error.status, cause: error });
  }
}

function ewaybillText(value, field, maxLength) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized.length > maxLength || /[\u0000-\u001F\u007F]/.test(normalized)) {
    throw new DelhiveryError(`${field} is required and must be at most ${maxLength} characters.`, {
      code: "INVALID_EWAYBILL_UPDATE",
      status: 400,
    });
  }
  return normalized;
}

export function buildDelhiveryEwaybillUpdatePayload(input = {}) {
  return {
    data: [{
      dcn: ewaybillText(input.dcn, "Invoice number", 100),
      ewbn: ewaybillText(input.ewbn, "E-waybill number", 50),
    }],
  };
}

export function normalizeDelhiveryEwaybillUpdate(payload, waybill) {
  try {
    const normalized = normalizeDelhiveryShipmentEdit(payload, waybill);
    return { provider: normalized.provider, updated: true, waybill, remark: normalized.remark };
  } catch (error) {
    if (!(error instanceof DelhiveryError) || error.code !== "DELHIVERY_EDIT_REJECTED") throw error;
    throw new DelhiveryError(error.message, { code: "DELHIVERY_EWAYBILL_REJECTED", status: error.status, cause: error });
  }
}

function trackingStatus(record = {}) {
  return {
    status: String(firstDefined(record, ["Status", "status", "Scan", "scan"]) || "").trim(),
    statusType: String(firstDefined(record, ["StatusType", "status_type", "ScanType", "scan_type"]) || "").trim(),
    dateTime: String(firstDefined(record, ["StatusDateTime", "status_date_time", "ScanDateTime", "scan_date_time", "date_time"]) || "").trim(),
    location: String(firstDefined(record, ["StatusLocation", "status_location", "ScannedLocation", "scanned_location", "location"]) || "").trim(),
    instructions: String(firstDefined(record, ["Instructions", "instructions", "remark", "remarks"]) || "").trim(),
  };
}

export function normalizeDelhiveryTracking(payload, requestedWaybills = []) {
  const source = Array.isArray(payload?.ShipmentData)
    ? payload.ShipmentData
    : Array.isArray(payload?.shipmentData)
      ? payload.shipmentData
      : Array.isArray(payload?.data)
        ? payload.data
        : [];
  const shipments = source.map((wrapper) => wrapper?.Shipment || wrapper?.shipment || wrapper).filter(Boolean).map((shipment) => {
    const scanSource = Array.isArray(shipment.Scans) ? shipment.Scans : Array.isArray(shipment.scans) ? shipment.scans : [];
    return {
      waybill: String(firstDefined(shipment, ["AWB", "awb", "waybill", "Waybill"]) || "").trim(),
      referenceId: String(firstDefined(shipment, ["ReferenceNo", "reference_no", "ref_id", "order_id"]) || "").trim(),
      pickupDate: String(firstDefined(shipment, ["PickUpDate", "pickup_date", "pickupDate"]) || "").trim(),
      origin: String(firstDefined(shipment, ["Origin", "origin"]) || "").trim(),
      destination: String(firstDefined(shipment, ["Destination", "destination"]) || "").trim(),
      currentStatus: trackingStatus(shipment.Status || shipment.status || {}),
      scans: scanSource.map((scan) => trackingStatus(scan?.ScanDetail || scan?.scan_detail || scan)).filter((scan) => scan.status || scan.dateTime),
    };
  }).filter((shipment) => /^\d{8,20}$/.test(shipment.waybill));
  const remark = String(firstDefined(payload, ["Error", "error", "message", "remark", "remarks"]) || "").trim();
  if (!shipments.length && remark) {
    throw new DelhiveryError(remark, { code: "DELHIVERY_TRACKING_REJECTED", status: 422 });
  }
  return {
    provider: "delhivery",
    requestedCount: requestedWaybills.length,
    foundCount: shipments.length,
    fetchedAt: new Date().toISOString(),
    shipments,
    remark,
  };
}

function normalizeTrackingRequest(input = {}) {
  const source = input.waybills ?? input.waybill;
  const waybills = [...new Set((Array.isArray(source) ? source : String(source || "").split(","))
    .map((waybill) => String(waybill || "").trim())
    .filter(Boolean))];
  if (!waybills.length || waybills.length > 50 || waybills.some((waybill) => !/^\d{8,20}$/.test(waybill))) {
    throw new DelhiveryError("Tracking requires between 1 and 50 valid waybills.", { code: "INVALID_TRACKING_WAYBILLS", status: 400 });
  }
  const refIds = String(input.refIds ?? input.ref_ids ?? "").trim();
  if (refIds.length > 100 || /[\u0000-\u001F\u007F]/.test(refIds)) {
    throw new DelhiveryError("Tracking order reference must be at most 100 characters.", { code: "INVALID_TRACKING_REFERENCE", status: 400 });
  }
  return { waybills, refIds };
}

function shippingCostInteger(value, field, { optional = false, positive = false } = {}) {
  if (value === undefined || value === null || value === "") {
    if (optional) return undefined;
    throw new DelhiveryError(`${field} is required.`, { code: "INVALID_SHIPPING_COST", status: 400 });
  }
  const numeric = Number(value);
  if (!Number.isSafeInteger(numeric) || numeric < (positive ? 1 : 0)) {
    throw new DelhiveryError(`${field} must be ${positive ? "a positive" : "a non-negative"} integer.`, {
      code: "INVALID_SHIPPING_COST",
      status: 400,
    });
  }
  return numeric;
}

export function normalizeShippingCostRequest(input = {}) {
  const md = String(firstDefined(input, ["md", "mot", "mode"]) || "").trim().toUpperCase();
  if (!new Set(["E", "S"]).has(md)) {
    throw new DelhiveryError("Billing mode must be E (Express) or S (Surface).", { code: "INVALID_BILLING_MODE", status: 400 });
  }
  const originPin = String(firstDefined(input, ["o_pin", "originPin", "origin_pin"]) || "").trim();
  const destinationPin = String(firstDefined(input, ["d_pin", "destinationPin", "destination_pin"]) || "").trim();
  if (!/^[1-9]\d{5}$/.test(originPin) || !/^[1-9]\d{5}$/.test(destinationPin)) {
    throw new DelhiveryError("Origin and destination must be valid 6-digit Indian PIN codes.", { code: "INVALID_SHIPPING_COST_PINCODE", status: 400 });
  }
  const statusInput = String(firstDefined(input, ["ss", "status", "shipmentStatus"]) || "").trim().toLowerCase();
  const status = new Map([["delivered", "Delivered"], ["rto", "RTO"], ["dto", "DTO"]]).get(statusInput);
  if (!status) {
    throw new DelhiveryError("Shipment status must be Delivered, RTO or DTO.", { code: "INVALID_SHIPPING_STATUS", status: 400 });
  }
  const paymentInput = String(firstDefined(input, ["pt", "payment", "paymentType"]) || "").trim().toLowerCase();
  const paymentType = new Map([["prepaid", "Pre-paid"], ["pre-paid", "Pre-paid"], ["cod", "COD"]]).get(paymentInput);
  if (!paymentType) {
    throw new DelhiveryError("Payment type must be Pre-paid or COD.", { code: "INVALID_SHIPPING_PAYMENT", status: 400 });
  }
  const packageTypeInput = firstDefined(input, ["ipkg_type", "packageType", "package_type"]);
  const packageType = packageTypeInput === undefined || packageTypeInput === null || packageTypeInput === ""
    ? undefined
    : String(packageTypeInput).trim().toLowerCase();
  if (packageType && !new Set(["box", "flyer"]).has(packageType)) {
    throw new DelhiveryError("Package type must be box or flyer.", { code: "INVALID_PACKAGE_TYPE", status: 400 });
  }
  return {
    md,
    cgm: shippingCostInteger(firstDefined(input, ["cgm", "chargeableWeightGrams", "weightGrams"]), "Chargeable weight"),
    o_pin: originPin,
    d_pin: destinationPin,
    ss: status,
    pt: paymentType,
    l: shippingCostInteger(firstDefined(input, ["l", "length", "lengthCm"]), "Length", { optional: true, positive: true }),
    b: shippingCostInteger(firstDefined(input, ["b", "breadth", "width", "widthCm"]), "Breadth", { optional: true, positive: true }),
    h: shippingCostInteger(firstDefined(input, ["h", "height", "heightCm"]), "Height", { optional: true, positive: true }),
    ipkg_type: packageType,
  };
}

function finiteShippingCostValue(record, keys) {
  const value = firstDefined(record, keys);
  if (value === undefined || value === null || value === "" || typeof value === "boolean") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function normalizeDelhiveryShippingCost(payload, request) {
  const providerError = String(firstDefined(payload, ["error", "Error"]) || "").trim();
  if (providerError) {
    throw new DelhiveryError(providerError, { code: "DELHIVERY_SHIPPING_COST_REJECTED", status: 422 });
  }
  let records = [];
  if (Array.isArray(payload)) records = payload;
  else if (Array.isArray(payload?.data)) records = payload.data;
  else if (payload?.data && typeof payload.data === "object") records = [payload.data];
  else if (payload && typeof payload === "object") records = [payload];
  const details = records.filter((record) => record && typeof record === "object");
  if (!details.length) {
    throw new DelhiveryError("Delhivery returned an invalid shipping-cost response.", { code: "DELHIVERY_INVALID_RESPONSE", status: 502 });
  }
  const primary = details[0];
  const recordError = String(firstDefined(primary, ["error", "Error"]) || "").trim();
  if (recordError) {
    throw new DelhiveryError(recordError, { code: "DELHIVERY_SHIPPING_COST_REJECTED", status: 422 });
  }
  const estimatedAmount = finiteShippingCostValue(primary, ["total_amount", "totalAmount", "gross_amount", "grossAmount", "shipping_charge", "shippingCharge", "amount", "total"]);
  const chargedWeightGrams = finiteShippingCostValue(primary, ["charged_weight", "chargedWeight", "chargeable_weight", "chargeableWeight", "cgm"]);
  return {
    provider: "delhivery",
    currency: "INR",
    estimatedAmount,
    chargedWeightGrams,
    zone: String(firstDefined(primary, ["zone", "Zone"]) || "").trim(),
    mode: request.md,
    modeOfTransport: request.md === "E" ? "Express" : "Surface",
    originPin: request.o_pin,
    destinationPin: request.d_pin,
    shipmentStatus: request.ss,
    paymentType: request.pt,
    requestedWeightGrams: request.cgm,
    dimensions: { length: request.l ?? null, breadth: request.b ?? null, height: request.h ?? null },
    packageType: request.ipkg_type || "",
    details,
    fetchedAt: new Date().toISOString(),
  };
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
  const configuredManifestRateLimit = Number(process.env.DELHIVERY_MANIFEST_RATE_LIMIT_REQUESTS);
  const manifestRateLimitRequests = Number.isInteger(configuredManifestRateLimit) && configuredManifestRateLimit > 0
    ? Math.min(configuredManifestRateLimit, 20000)
    : DEFAULT_MANIFEST_RATE_LIMIT_REQUESTS;
  const manifestPath = validateProviderPath(process.env.DELHIVERY_MANIFEST_PATH || "/api/cmu/create.json", "DELHIVERY_MANIFEST_PATH");
  const configuredEditRateLimit = Number(process.env.DELHIVERY_EDIT_RATE_LIMIT_REQUESTS);
  const editRateLimitRequests = Number.isInteger(configuredEditRateLimit) && configuredEditRateLimit > 0
    ? Math.min(configuredEditRateLimit, 12200)
    : DEFAULT_EDIT_RATE_LIMIT_REQUESTS;
  const editPath = validateProviderPath(process.env.DELHIVERY_EDIT_PATH || "/api/p/edit", "DELHIVERY_EDIT_PATH");
  const configuredEwaybillRateLimit = Number(process.env.DELHIVERY_EWAYBILL_RATE_LIMIT_REQUESTS);
  const ewaybillRateLimitRequests = Number.isInteger(configuredEwaybillRateLimit) && configuredEwaybillRateLimit > 0
    ? Math.min(configuredEwaybillRateLimit, 250)
    : DEFAULT_EWAYBILL_RATE_LIMIT_REQUESTS;
  const ewaybillPathTemplate = validateProviderPath(
    process.env.DELHIVERY_EWAYBILL_PATH_TEMPLATE || "/api/rest/ewaybill/{waybill}/",
    "DELHIVERY_EWAYBILL_PATH_TEMPLATE",
  );
  if ((ewaybillPathTemplate.match(/\{waybill\}/g) || []).length !== 1) {
    throw new DelhiveryError("DELHIVERY_EWAYBILL_PATH_TEMPLATE must contain one {waybill} placeholder.", {
      code: "DELHIVERY_INVALID_CONFIGURATION",
      status: 503,
    });
  }
  const configuredTrackingRateLimit = Number(process.env.DELHIVERY_TRACKING_RATE_LIMIT_REQUESTS);
  const trackingRateLimitRequests = Number.isInteger(configuredTrackingRateLimit) && configuredTrackingRateLimit > 0
    ? Math.min(configuredTrackingRateLimit, 750)
    : DEFAULT_TRACKING_RATE_LIMIT_REQUESTS;
  const trackingPath = validateProviderPath(process.env.DELHIVERY_TRACKING_PATH || "/api/v1/packages/json/", "DELHIVERY_TRACKING_PATH");
  const configuredShippingCostRateLimit = Number(process.env.DELHIVERY_SHIPPING_COST_RATE_LIMIT_REQUESTS);
  const shippingCostRateLimitRequests = Number.isInteger(configuredShippingCostRateLimit) && configuredShippingCostRateLimit > 0
    ? Math.min(configuredShippingCostRateLimit, 50)
    : DEFAULT_SHIPPING_COST_RATE_LIMIT_REQUESTS;
  const configuredShippingCostTimeout = Number(process.env.DELHIVERY_SHIPPING_COST_TIMEOUT_MS);
  const shippingCostTimeoutMs = Number.isInteger(configuredShippingCostTimeout) && configuredShippingCostTimeout > 0
    ? Math.min(configuredShippingCostTimeout, 120000)
    : DEFAULT_SHIPPING_COST_TIMEOUT_MS;
  const shippingCostPath = validateProviderPath(process.env.DELHIVERY_SHIPPING_COST_PATH || "/api/kinko/v1/invoice/charges/.json", "DELHIVERY_SHIPPING_COST_PATH");
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

  async function requestJson(endpoint, rateLimitKey, limit, { includeAuthorization = true, method = "GET", headers = {}, body, requestTimeoutMs = timeoutMs } = {}) {
    consumeRateLimit(rateLimitKey, limit);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), requestTimeoutMs);

    try {
      const response = await fetchImpl(endpoint, {
        method,
        headers: {
          Accept: "application/json",
          ...(includeAuthorization ? { Authorization: `Token ${token}` } : {}),
          ...headers,
        },
        ...(body === undefined ? {} : { body }),
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

  async function createShipment(input) {
    ensureConfigured();
    const manifest = buildDelhiveryShipmentPayload(input);
    const endpoint = new URL(manifestPath, `${baseUrl}/`);
    const multiPiece = manifest.shipments.length > 1;
    const form = multiPiece ? null : new URLSearchParams({ format: "json", data: JSON.stringify(manifest) });
    const payload = await requestJson(endpoint, "manifest", manifestRateLimitRequests, {
      method: "POST",
      headers: { "Content-Type": multiPiece ? "application/json" : "application/x-www-form-urlencoded" },
      body: multiPiece ? JSON.stringify(manifest) : form.toString(),
    });
    return normalizeDelhiveryShipmentCreation(payload, manifest.shipments.length);
  }

  async function editShipment(input) {
    ensureConfigured();
    const edit = buildDelhiveryShipmentEditPayload(input);
    const endpoint = new URL(editPath, `${baseUrl}/`);
    const payload = await requestJson(endpoint, "shipment-edit", editRateLimitRequests, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(edit),
    });
    return normalizeDelhiveryShipmentEdit(payload, edit.waybill);
  }

  async function cancelShipment(input) {
    ensureConfigured();
    const cancellation = buildDelhiveryShipmentCancellationPayload(input);
    const endpoint = new URL(editPath, `${baseUrl}/`);
    const payload = await requestJson(endpoint, "shipment-edit", editRateLimitRequests, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cancellation),
    });
    return normalizeDelhiveryShipmentCancellation(payload, cancellation.waybill);
  }

  async function updateEwaybill(input) {
    ensureConfigured();
    const waybill = String(input?.waybill || "").trim();
    if (!/^\d{8,20}$/.test(waybill)) {
      throw new DelhiveryError("A valid waybill is required to update an e-waybill.", { code: "INVALID_WAYBILL", status: 400 });
    }
    const update = buildDelhiveryEwaybillUpdatePayload(input);
    const path = ewaybillPathTemplate.replace("{waybill}", encodeURIComponent(waybill));
    const endpoint = new URL(path, `${baseUrl}/`);
    const payload = await requestJson(endpoint, "ewaybill-update", ewaybillRateLimitRequests, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    });
    return normalizeDelhiveryEwaybillUpdate(payload, waybill);
  }

  async function fetchTracking(request) {
    const endpoint = new URL(trackingPath, `${baseUrl}/`);
    endpoint.searchParams.set("waybill", request.waybills.join(","));
    endpoint.searchParams.set("ref_ids", request.refIds);
    const payload = await requestJson(endpoint, "shipment-tracking", trackingRateLimitRequests, {
      headers: { "Content-Type": "application/json" },
    });
    return normalizeDelhiveryTracking(payload, request.waybills);
  }

  async function fetchShippingCost(request) {
    const endpoint = new URL(shippingCostPath, `${baseUrl}/`);
    Object.entries(request).forEach(([key, value]) => {
      if (value !== undefined) endpoint.searchParams.set(key, String(value));
    });
    const payload = await requestJson(endpoint, "shipping-cost", shippingCostRateLimitRequests, {
      headers: { "Content-Type": "application/json" },
      requestTimeoutMs: shippingCostTimeoutMs,
    });
    return normalizeDelhiveryShippingCost(payload, request);
  }

  async function trackShipments(input) {
    ensureConfigured();
    const normalized = normalizeTrackingRequest(input);
    const cacheKey = `tracking:${normalized.waybills.join(",")}:${normalized.refIds}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return structuredClone(cached.data);
    if (pending.has(cacheKey)) return structuredClone(await pending.get(cacheKey));
    const request = fetchTracking(normalized)
      .then((data) => {
        if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
        cache.set(cacheKey, { data, expiresAt: Date.now() + DEFAULT_TRACKING_CACHE_TTL_MS });
        return data;
      })
      .finally(() => pending.delete(cacheKey));
    pending.set(cacheKey, request);
    return structuredClone(await request);
  }

  async function calculateShippingCost(input) {
    ensureConfigured();
    const normalized = normalizeShippingCostRequest(input);
    const cacheKey = `shipping-cost:${JSON.stringify(normalized)}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return structuredClone(cached.data);
    if (pending.has(cacheKey)) return structuredClone(await pending.get(cacheKey));
    const request = fetchShippingCost(normalized)
      .then((data) => {
        if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
        cache.set(cacheKey, { data, expiresAt: Date.now() + DEFAULT_CACHE_TTL_MS });
        return data;
      })
      .finally(() => pending.delete(cacheKey));
    pending.set(cacheKey, request);
    return structuredClone(await request);
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
    createShipment,
    editShipment,
    cancelShipment,
    updateEwaybill,
    trackShipments,
    calculateShippingCost,
  };
}
