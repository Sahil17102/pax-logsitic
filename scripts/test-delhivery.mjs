import assert from "node:assert/strict";
import { buildDelhiveryEwaybillUpdatePayload, buildDelhiveryNdrPayload, buildDelhiveryShipmentCancellationPayload, buildDelhiveryShipmentEditPayload, buildDelhiveryShipmentPayload, buildDelhiveryWarehousePayload, buildDelhiveryWarehouseUpdatePayload, createDelhiveryClient, DelhiveryError, normalizeDelhiveryCustomQc, normalizeDelhiveryDocument, normalizeDelhiveryEwaybillUpdate, normalizeDelhiveryExpectedTat, normalizeDelhiveryHeavyServiceability, normalizeDelhiveryNdrAction, normalizeDelhiveryPickupRequest, normalizeDelhiveryServiceability, normalizeDelhiveryShipmentCancellation, normalizeDelhiveryShipmentCreation, normalizeDelhiveryShipmentEdit, normalizeDelhiveryShippingCost, normalizeDelhiveryShippingLabel, normalizeDelhiveryTracking, normalizeDelhiveryWarehouseCreation, normalizeDelhiveryWarehouseUpdate, normalizeDelhiveryWaybills, normalizeDocumentRequest, normalizeNdrActionRequest, normalizePickupRequest, normalizeShippingCostRequest, normalizeShippingLabelRequest, validateNdrEligibility } from "../server/integrations/delhivery.js";

assert.deepEqual(normalizeDelhiveryWaybills({ waybills: ["900000000001", "900000000002", "900000000001"] }), ["900000000001", "900000000002"]);
assert.deepEqual(normalizeDelhiveryWaybills({ data: { awb_numbers: "900000000003, 900000000004" } }), ["900000000003", "900000000004"]);

const manifestInput = {
  pickupLocation: "Pax Test Warehouse",
  clientName: "Pax Test Client",
  shipments: [{ name: "Receiver", order: "PAX-ORDER-1", phone: "9123456789", address: "House & Market #2", pin: "194103", paymentMode: "COD", weightGrams: 1250, totalAmount: 999, codAmount: 999, productsDescription: "Shoes; shampoo", quantity: "2", shippingMode: "Surface", transportSpeed: "D" }],
};
const manifestPayload = buildDelhiveryShipmentPayload(manifestInput);
assert.equal(manifestPayload.pickup_location.name, "Pax Test Warehouse");
assert.equal(manifestPayload.shipments[0].add, "House & Market #2");
assert.equal(manifestPayload.shipments[0].payment_mode, "COD");
assert.equal(manifestPayload.shipments[0].cod_amount, 999);
const customQcInput = [
  { item: "Mobile", description: "Mi Note Pro", images: ["https://images.example.com/mobile.jpg"], returnReason: "Damaged", quantity: 1, brand: "Mi", productCategory: "mobile", questions: [
    { questionId: "serial_check", options: [""], value: ["SN12345"], required: true, type: "varchar", questionImages: ["https://images.example.com/serial.jpg"] },
    { questionId: "color_check", options: ["Black", "Other"], value: ["Black"], required: false, type: "multi" },
  ] },
  { description: "Retail box", images: "https://images.example.com/box.jpg", questions: [
    { questions_id: "seal_check", options: ["Intact", "Broken"], value: ["Intact"], required: true, type: "multi" },
  ] },
];
const normalizedCustomQc = normalizeDelhiveryCustomQc(customQcInput);
assert.equal(normalizedCustomQc.length, 2);
assert.equal(normalizedCustomQc[0].questions[0].questions_id, "serial_check");
assert.equal(normalizedCustomQc[1].quantity, 1);
const rvpQcManifestInput = { ...manifestInput, shipments: [{ ...manifestInput.shipments[0], paymentMode: "Pickup", customQc: customQcInput }] };
const rvpQcManifestPayload = buildDelhiveryShipmentPayload(rvpQcManifestInput);
assert.equal(rvpQcManifestPayload.shipments[0].qc_type, "param");
assert.deepEqual(rvpQcManifestPayload.shipments[0].custom_qc, normalizedCustomQc);
assert.throws(() => buildDelhiveryShipmentPayload({ ...manifestInput, shipments: [{ ...manifestInput.shipments[0], customQc: customQcInput }] }), (error) => error instanceof DelhiveryError && error.code === "RVP_QC_REQUIRES_PICKUP");
assert.throws(() => normalizeDelhiveryCustomQc([...customQcInput, customQcInput[0]]), (error) => error instanceof DelhiveryError && error.code === "INVALID_RVP_QC_ITEMS");
assert.throws(() => normalizeDelhiveryCustomQc([{ ...customQcInput[0], questions: Array.from({ length: 7 }, () => customQcInput[0].questions[0]) }]), (error) => error instanceof DelhiveryError && error.code === "INVALID_RVP_QC_QUESTIONS");
assert.throws(() => normalizeDelhiveryCustomQc([{ ...customQcInput[0], questions: [{ ...customQcInput[0].questions[1], value: ["Blue"] }] }]), (error) => error instanceof DelhiveryError && error.code === "INVALID_RVP_QC_VALUE");
assert.throws(() => buildDelhiveryShipmentPayload({ ...manifestInput, shipments: [{ ...manifestInput.shipments[0], totalAmount: 50000 }] }), (error) => error instanceof DelhiveryError && error.code === "EWAYBILL_REQUIRED");
assert.throws(() => buildDelhiveryShipmentPayload({ ...manifestInput, shipments: [manifestInput.shipments[0], { ...manifestInput.shipments[0], order: "PAX-ORDER-2" }] }), (error) => error instanceof DelhiveryError && error.code === "MPS_WAYBILL_REQUIRED");
assert.throws(() => buildDelhiveryShipmentPayload({ ...manifestInput, shipments: [{ ...manifestInput.shipments[0], waybill: "900000000001" }, { ...manifestInput.shipments[0], order: "PAX-ORDER-2", waybill: "900000000001" }] }), (error) => error instanceof DelhiveryError && error.code === "DUPLICATE_MPS_WAYBILL");
const normalizedManifest = normalizeDelhiveryShipmentCreation({ packages: [{ status: "Success", waybill: "920000000001", refnum: "PAX-ORDER-1" }], upload_wbn: "UP-1" }, 1);
assert.equal(normalizedManifest.manifested, true);
assert.equal(normalizedManifest.packages[0].waybill, "920000000001");
const mpsManifestInput = {
  pickupLocation: "Pax Test Warehouse",
  clientName: "Pax Test Client",
  masterWaybill: "900000000002",
  mpsAmount: 2400,
  shipments: [
    { ...manifestInput.shipments[0], order: "PAX-MPS-1", waybill: "900000000001", codAmount: 1200, totalAmount: 1200 },
    { ...manifestInput.shipments[0], order: "PAX-MPS-1", waybill: "900000000002", codAmount: 1200, totalAmount: 1200 },
  ],
};
const mpsManifestPayload = buildDelhiveryShipmentPayload(mpsManifestInput);
assert.equal(mpsManifestPayload.shipments[0].shipment_type, "MPS");
assert.equal(mpsManifestPayload.shipments[0].master_id, "900000000002");
assert.equal(mpsManifestPayload.shipments[1].mps_children, 2);
assert.equal(mpsManifestPayload.shipments[1].mps_amount, 2400);

const editInput = {
  waybill: "920000000001",
  currentPaymentMode: "COD",
  paymentMode: "Prepaid",
  name: "Edited Receiver",
  phone: ["9234567890"],
  address: "Edited delivery address",
  productsDescription: "Edited products",
  weightGrams: 1500,
  heightCm: 40.2,
  widthCm: 20,
  lengthCm: 30,
};
const editPayload = buildDelhiveryShipmentEditPayload(editInput);
assert.deepEqual(editPayload, {
  waybill: "920000000001",
  name: "Edited Receiver",
  add: "Edited delivery address",
  products_desc: "Edited products",
  gm: 1500,
  shipment_height: 40.2,
  shipment_width: 20,
  shipment_length: 30,
  phone: ["9234567890"],
  pt: "Pre-paid",
});
assert.throws(() => buildDelhiveryShipmentEditPayload({ waybill: "920000000001", currentPaymentMode: "COD", paymentMode: "COD" }), (error) => error instanceof DelhiveryError && error.code === "INVALID_PAYMENT_MODE_CONVERSION");
assert.throws(() => buildDelhiveryShipmentEditPayload({ waybill: "920000000001", currentPaymentMode: "Prepaid", paymentMode: "COD" }), (error) => error instanceof DelhiveryError && error.code === "COD_AMOUNT_REQUIRED");
assert.throws(() => buildDelhiveryShipmentEditPayload({ waybill: "920000000001", currentPaymentMode: "Pickup", paymentMode: "Prepaid" }), (error) => error instanceof DelhiveryError && error.code === "INVALID_PAYMENT_MODE_CONVERSION");
assert.throws(() => normalizeDelhiveryShipmentEdit({ status: false, message: "Package in incorrect status" }, "920000000001"), (error) => error instanceof DelhiveryError && error.code === "DELHIVERY_EDIT_REJECTED");
assert.deepEqual(buildDelhiveryShipmentCancellationPayload({ waybill: "920000000001" }), { waybill: "920000000001", cancellation: "true" });
assert.throws(() => buildDelhiveryShipmentCancellationPayload({ waybill: "invalid" }), (error) => error instanceof DelhiveryError && error.code === "INVALID_WAYBILL");
assert.throws(() => normalizeDelhiveryShipmentCancellation({ status: false, message: "Package in incorrect status" }, "920000000001"), (error) => error instanceof DelhiveryError && error.code === "DELHIVERY_CANCELLATION_REJECTED");
const ewaybillUpdatePayload = buildDelhiveryEwaybillUpdatePayload({ dcn: "INV-2026/001", ewbn: "181000000001" });
assert.deepEqual(ewaybillUpdatePayload, { data: [{ dcn: "INV-2026/001", ewbn: "181000000001" }] });
assert.throws(() => buildDelhiveryEwaybillUpdatePayload({ dcn: "", ewbn: "181000000001" }), (error) => error instanceof DelhiveryError && error.code === "INVALID_EWAYBILL_UPDATE");
assert.throws(() => buildDelhiveryEwaybillUpdatePayload({ dcn: "INV-1", ewbn: 181000000001 }), (error) => error instanceof DelhiveryError && error.code === "INVALID_EWAYBILL_UPDATE");
assert.throws(() => normalizeDelhiveryEwaybillUpdate({ status: false, message: "No such waybill found" }, "920000000001"), (error) => error instanceof DelhiveryError && error.code === "DELHIVERY_EWAYBILL_REJECTED");
const trackingFixture = { ShipmentData: [{ Shipment: {
  AWB: "920000000001",
  ReferenceNo: "PAX-ORDER-1",
  PickUpDate: "2026-08-02 10:00:00",
  Origin: "Hyderabad",
  Destination: "Leh",
  Status: { Status: "NDR", StatusType: "UD", StatusDateTime: "2026-08-03T10:00:00.000", StatusLocation: "DEL Hub", Instructions: "Consignee unavailable", NSLCode: "EOD-74", AttemptCount: 1 },
  Scans: [{ ScanDetail: { Scan: "Manifested", ScanType: "UD", ScanDateTime: "2026-08-02T10:00:00.000", ScannedLocation: "HYD Hub", Instructions: "Manifest uploaded" } }],
} }] };
const normalizedTracking = normalizeDelhiveryTracking(trackingFixture, ["920000000001"]);
assert.equal(normalizedTracking.foundCount, 1);
assert.equal(normalizedTracking.shipments[0].currentStatus.status, "NDR");
assert.equal(normalizedTracking.shipments[0].scans[0].location, "HYD Hub");
assert.equal(normalizedTracking.shipments[0].currentStatus.nslCode, "EOD-74");
assert.equal(normalizedTracking.shipments[0].attemptCount, 1);
const ndrRequest = normalizeNdrActionRequest({ waybill: "920000000001", act: "re-attempt" });
const eligibleNdrRequest = validateNdrEligibility(ndrRequest, normalizedTracking.shipments[0]);
assert.deepEqual(buildDelhiveryNdrPayload(eligibleNdrRequest), { data: [{ waybill: "920000000001", act: "RE-ATTEMPT" }] });
assert.equal(normalizeDelhiveryNdrAction({ success: true, data: { upl_id: "UPL-NDR-1" } }, eligibleNdrRequest).uplId, "UPL-NDR-1");
const pickupNdrRequest = normalizeNdrActionRequest({ waybill: "920000000002", act: "PICKUP_RESCHEDULE" });
assert.equal(validateNdrEligibility(pickupNdrRequest, { waybill: "920000000002", attemptCount: 2, otpCancelled: false, currentStatus: { status: "Cancelled", nslCode: "EOD-777" } }).nslCode, "EOD-777");
assert.throws(() => normalizeNdrActionRequest({ waybill: "920000000001", act: "CANCEL" }), (error) => error instanceof DelhiveryError && error.code === "INVALID_NDR_ACTION");
assert.throws(() => validateNdrEligibility(ndrRequest, { waybill: "920000000001", attemptCount: 3, currentStatus: { nslCode: "EOD-74" } }), (error) => error instanceof DelhiveryError && error.code === "NDR_ATTEMPT_NOT_ELIGIBLE");
assert.throws(() => validateNdrEligibility(ndrRequest, { waybill: "920000000001", attemptCount: 1, currentStatus: { nslCode: "EOD-999" } }), (error) => error instanceof DelhiveryError && error.code === "NDR_NSL_NOT_ELIGIBLE");
assert.throws(() => validateNdrEligibility(pickupNdrRequest, { waybill: "920000000002", attemptCount: 2, otpCancelled: true, currentStatus: { status: "Cancelled", nslCode: "EOD-777" } }), (error) => error instanceof DelhiveryError && error.code === "NDR_PICKUP_NOT_ELIGIBLE");

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

const heavy = normalizeDelhiveryHeavyServiceability({
  data: [{ pincode: 400086, product_type: "Heavy", payment_type: ["Pre-paid", "COD"], serviceability: "Serviceable", city: "Mumbai", state_code: "MH" }],
}, "400086");
assert.deepEqual(heavy, {
  provider: "delhivery",
  productType: "Heavy",
  pincode: "400086",
  status: "serviceable",
  serviceable: true,
  cod: true,
  prepaid: true,
  paymentTypes: ["Pre-paid", "COD"],
  remark: "",
  city: "Mumbai",
  district: "",
  stateCode: "MH",
});
const heavyNsz = normalizeDelhiveryHeavyServiceability({ pincode: 999999, payment_type: "NSZ", serviceability: "NSZ" }, "999999");
assert.equal(heavyNsz.status, "non_serviceable");
assert.equal(heavyNsz.cod, false);
assert.equal(heavyNsz.prepaid, false);

const tatRequest = { originPin: "122003", destinationPin: "136118", mot: "S", pdt: "B2C", expectedPickupDate: "2026-08-03 10:30" };
const tat = normalizeDelhiveryExpectedTat({ data: { origin_pin: 122003, destination_pin: 136118, tat: "3 Days", expected_delivery_date: "2026-08-06" } }, tatRequest);
assert.deepEqual(tat, {
  provider: "delhivery",
  originPin: "122003",
  destinationPin: "136118",
  mot: "S",
  modeOfTransport: "Surface",
  productType: "B2C",
  expectedPickupDate: "2026-08-03 10:30",
  status: "available",
  serviceable: true,
  tatDays: 3,
  expectedDeliveryDate: "2026-08-06",
  remark: "",
});
const tatNsz = normalizeDelhiveryExpectedTat({ data: { status: "NSZ", message: "NSZ" } }, { ...tatRequest, destinationPin: "999997" });
assert.equal(tatNsz.status, "non_serviceable");
assert.equal(tatNsz.tatDays, null);
const shippingCostRequest = normalizeShippingCostRequest({ md: "s", cgm: "1500", o_pin: "122003", d_pin: "136118", ss: "delivered", pt: "prepaid", l: "20", b: "15", h: "10", ipkg_type: "BOX" });
assert.deepEqual(shippingCostRequest, { md: "S", cgm: 1500, o_pin: "122003", d_pin: "136118", ss: "Delivered", pt: "Pre-paid", l: 20, b: 15, h: 10, ipkg_type: "box" });
const shippingCostFixture = [{ zone: "D", charged_weight: 1500, charge_freight: 136, charge_COD: 0, tax_data: { service_tax: 24.48 }, total_amount: 160.48 }];
const normalizedShippingCost = normalizeDelhiveryShippingCost(shippingCostFixture, shippingCostRequest);
assert.equal(normalizedShippingCost.estimatedAmount, 160.48);
assert.equal(normalizedShippingCost.chargedWeightGrams, 1500);
assert.equal(normalizedShippingCost.modeOfTransport, "Surface");
assert.equal(normalizeDelhiveryShippingCost([{ total_amount: 0 }], shippingCostRequest).estimatedAmount, 0);
assert.throws(() => normalizeShippingCostRequest({ ...shippingCostRequest, md: "N" }), (error) => error instanceof DelhiveryError && error.code === "INVALID_BILLING_MODE");
assert.throws(() => normalizeShippingCostRequest({ ...shippingCostRequest, pt: "Pickup" }), (error) => error instanceof DelhiveryError && error.code === "INVALID_SHIPPING_PAYMENT");
assert.throws(() => normalizeDelhiveryShippingCost({ error: "Unable to process request for provided o_pin" }, shippingCostRequest), (error) => error instanceof DelhiveryError && error.code === "DELHIVERY_SHIPPING_COST_REJECTED");
const pdfLabelRequest = normalizeShippingLabelRequest({ waybill: "920000000001", pdf: "true", pdf_size: "4r" });
assert.deepEqual(pdfLabelRequest, { waybill: "920000000001", pdf: true, pdfSize: "4R" });
const pdfLabelFixture = { packages: [{ waybill: "920000000001" }], packages_found: 1, pdf_download_link: "https://labels.test.delhivery.local/920000000001-4R.pdf" };
const normalizedPdfLabel = normalizeDelhiveryShippingLabel(pdfLabelFixture, pdfLabelRequest);
assert.equal(normalizedPdfLabel.format, "pdf");
assert.equal(normalizedPdfLabel.downloadUrl, "https://labels.test.delhivery.local/920000000001-4R.pdf");
const jsonLabelRequest = normalizeShippingLabelRequest({ waybill: "920000000001", pdf: false });
const normalizedJsonLabel = normalizeDelhiveryShippingLabel({ packages: [{ waybill: "920000000001", barcode: "920000000001" }], packages_found: 1 }, jsonLabelRequest);
assert.equal(normalizedJsonLabel.format, "json");
assert.equal(normalizedJsonLabel.labelData.packages[0].barcode, "920000000001");
assert.throws(() => normalizeShippingLabelRequest({ waybill: "920000000001", pdf: "yes" }), (error) => error instanceof DelhiveryError && error.code === "INVALID_LABEL_FORMAT");
assert.throws(() => normalizeShippingLabelRequest({ waybill: "920000000001", pdf_size: "A6" }), (error) => error instanceof DelhiveryError && error.code === "INVALID_LABEL_SIZE");
assert.throws(() => normalizeDelhiveryShippingLabel({ packages: [], packages_found: 0 }, pdfLabelRequest), (error) => error instanceof DelhiveryError && error.code === "DELHIVERY_LABEL_REJECTED");
const documentRequest = normalizeDocumentRequest({ waybill: "920000000001", doc_type: "epod" });
assert.deepEqual(documentRequest, { waybill: "920000000001", documentType: "EPOD" });
const normalizedDocument = normalizeDelhiveryDocument({ success: true, data: [{ url: "https://documents.test.delhivery.local/920000000001-epod.pdf" }] }, documentRequest);
assert.equal(normalizedDocument.documentCount, 1);
assert.equal(normalizedDocument.downloadUrl, "https://documents.test.delhivery.local/920000000001-epod.pdf");
assert.equal(normalizeDelhiveryDocument({ success: true, error: false, document_url: "https://documents.test.delhivery.local/920000000001-epod.pdf" }, documentRequest).documentCount, 1);
assert.throws(() => normalizeDocumentRequest({ waybill: "920000000001", doc_type: "INVOICE" }), (error) => error instanceof DelhiveryError && error.code === "INVALID_DOCUMENT_TYPE");
assert.throws(() => normalizeDelhiveryDocument({ success: true, url: "http://documents.example.com/file.pdf" }, documentRequest), (error) => error instanceof DelhiveryError && error.code === "DELHIVERY_DOCUMENT_NOT_FOUND");
const pickupRequest = normalizePickupRequest({ pickupDate: "2026-08-04", pickupTime: "11:00:00", pickupLocation: "Pax Test Warehouse", expectedPackageCount: 2 }, { now: new Date("2026-08-03T00:00:00Z") });
assert.deepEqual(pickupRequest, { pickup_time: "11:00:00", pickup_date: "2026-08-04", pickup_location: "Pax Test Warehouse", expected_package_count: 2 });
const normalizedPickup = normalizeDelhiveryPickupRequest({ success: true, pickup_id: "PUR-TEST-1", message: "Pickup request submitted successfully." }, pickupRequest);
assert.equal(normalizedPickup.providerPickupId, "PUR-TEST-1");
assert.equal(normalizeDelhiveryPickupRequest({ success: true, error: false, pickup_id: "PUR-TEST-OK" }, pickupRequest).scheduled, true);
assert.throws(() => normalizePickupRequest({ ...pickupRequest, pickup_date: "2026-08-11" }, { now: new Date("2026-08-03T00:00:00Z") }), (error) => error instanceof DelhiveryError && error.code === "INVALID_PICKUP_DATE");
assert.throws(() => normalizePickupRequest({ ...pickupRequest, pickup_time: "25:00:00" }, { now: new Date("2026-08-03T00:00:00Z") }), (error) => error instanceof DelhiveryError && error.code === "INVALID_PICKUP_TIME");
assert.throws(() => normalizeDelhiveryPickupRequest({ success: false, error: "Pickup request already exists" }, pickupRequest), (error) => error instanceof DelhiveryError && error.code === "DELHIVERY_PICKUP_REJECTED");
const warehouseInput = { name: "Kota Test Warehouse", registeredName: "Pax Test Client", phone: "9999999999", email: "warehouse@example.com", address: "Industrial Area", city: "Kota", pin: "110042", country: "India", returnAddress: "Returns Block", returnCity: "Kota", returnPin: "110042", returnState: "Delhi", returnCountry: "India" };
const warehousePayload = buildDelhiveryWarehousePayload(warehouseInput);
assert.equal(warehousePayload.name, "Kota Test Warehouse");
assert.equal(warehousePayload.registered_name, "Pax Test Client");
assert.equal(warehousePayload.return_address, "Returns Block");
assert.throws(() => buildDelhiveryWarehousePayload({ ...warehouseInput, phone: "123" }), (error) => error instanceof DelhiveryError && error.code === "INVALID_WAREHOUSE_PHONE");
assert.throws(() => buildDelhiveryWarehousePayload({ ...warehouseInput, returnAddress: "" }), (error) => error instanceof DelhiveryError && error.code === "INVALID_WAREHOUSE");
assert.equal(normalizeDelhiveryWarehouseCreation({ success: true, message: "Warehouse created" }, warehousePayload).registered, true);
assert.throws(() => normalizeDelhiveryWarehouseCreation({ success: false, error: "Warehouse already exists" }, warehousePayload), (error) => error instanceof DelhiveryError && error.code === "DELHIVERY_WAREHOUSE_REJECTED");
const warehouseUpdateInput = { name: "Kota Test Warehouse", address: "Updated Industrial Area", pin: "110043", phone: "9888888888" };
const warehouseUpdatePayload = buildDelhiveryWarehouseUpdatePayload(warehouseUpdateInput);
assert.deepEqual(warehouseUpdatePayload, warehouseUpdateInput);
assert.throws(() => buildDelhiveryWarehouseUpdatePayload({ ...warehouseUpdateInput, pin: "123" }), (error) => error instanceof DelhiveryError && error.code === "INVALID_WAREHOUSE_PINCODE");
assert.throws(() => buildDelhiveryWarehouseUpdatePayload({ ...warehouseUpdateInput, address: "" }), (error) => error instanceof DelhiveryError && error.code === "INVALID_WAREHOUSE");
assert.equal(normalizeDelhiveryWarehouseUpdate({ success: true, message: "Warehouse updated" }, warehouseUpdatePayload).updated, true);
assert.throws(() => normalizeDelhiveryWarehouseUpdate({ success: false, error: "Warehouse not found" }, warehouseUpdatePayload), (error) => error instanceof DelhiveryError && error.code === "DELHIVERY_WAREHOUSE_UPDATE_REJECTED");

const originalToken = process.env.DELHIVERY_API_TOKEN;
const originalBaseUrl = process.env.DELHIVERY_BASE_URL;
const originalInsecure = process.env.DELHIVERY_ALLOW_INSECURE_HTTP;
const originalRvpQcQuestionIds = process.env.DELHIVERY_RVP_QC_QUESTION_IDS;
try {
  process.env.DELHIVERY_API_TOKEN = "test-token";
  process.env.DELHIVERY_BASE_URL = "http://127.0.0.1:9999";
  process.env.DELHIVERY_ALLOW_INSECURE_HTTP = "true";
  process.env.DELHIVERY_RVP_QC_QUESTION_IDS = "serial_check,color_check,seal_check";
  let requestCount = 0;
  const client = createDelhiveryClient({
    fetchImpl: async (url, options) => {
      requestCount += 1;
      const endpoint = new URL(url);
      if (endpoint.pathname === "/waybill/api/fetch/json/") {
        assert.equal(endpoint.searchParams.get("token"), "test-token");
        assert.equal(options.headers.Authorization, undefined);
        return new Response(JSON.stringify({ waybill: "910000000001" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      assert.equal(options.headers.Authorization, "Token test-token");
      if (endpoint.pathname === "/api/p/packing_slip") {
        assert.equal(options.method, "GET");
        assert.equal(endpoint.searchParams.get("wbns"), "920000000001");
        assert.equal(endpoint.searchParams.get("pdf_size"), endpoint.searchParams.get("pdf") === "true" ? "4R" : "A4");
        if (endpoint.searchParams.get("pdf") === "true") {
          return new Response(JSON.stringify(pdfLabelFixture), { status: 200, headers: { "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({ packages: [{ waybill: "920000000001", barcode: "920000000001" }], packages_found: 1 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (endpoint.pathname === "/api/rest/fetch/pkg/document/") {
        assert.equal(options.method, "GET");
        assert.equal(endpoint.searchParams.get("doc_type"), "EPOD");
        assert.equal(endpoint.searchParams.get("waybill"), "920000000001");
        return new Response(JSON.stringify({ success: true, document_url: "https://documents.test.delhivery.local/920000000001-epod.pdf" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (endpoint.pathname === "/fm/request/new/") {
        assert.equal(options.method, "POST");
        assert.equal(options.headers["Content-Type"], "application/json");
        const pickup = JSON.parse(options.body);
        assert.equal(pickup.pickup_location, "Pax Test Warehouse");
        assert.equal(pickup.pickup_time, "11:00:00");
        assert.equal(pickup.expected_package_count, 2);
        return new Response(JSON.stringify({ success: true, pickup_id: "PUR-TEST-2", message: "Pickup request submitted successfully." }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (endpoint.pathname === "/api/backend/clientwarehouse/create/") {
        assert.equal(options.method, "POST");
        assert.equal(options.headers["Content-Type"], "application/json");
        assert.deepEqual(JSON.parse(options.body), warehousePayload);
        return new Response(JSON.stringify({ success: true, message: "Warehouse created successfully" }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (endpoint.pathname === "/api/backend/clientwarehouse/edit/") {
        assert.equal(options.method, "POST");
        assert.equal(options.headers["Content-Type"], "application/json");
        assert.deepEqual(JSON.parse(options.body), warehouseUpdatePayload);
        return new Response(JSON.stringify({ success: true, message: "Warehouse updated successfully" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (endpoint.pathname === "/api/kinko/v1/invoice/charges/.json") {
        assert.equal(options.method, "GET");
        assert.equal(endpoint.searchParams.get("md"), "S");
        assert.equal(endpoint.searchParams.get("cgm"), "1500");
        assert.equal(endpoint.searchParams.get("o_pin"), "122003");
        assert.equal(endpoint.searchParams.get("d_pin"), "136118");
        assert.equal(endpoint.searchParams.get("ss"), "Delivered");
        assert.equal(endpoint.searchParams.get("pt"), "Pre-paid");
        assert.equal(endpoint.searchParams.get("ipkg_type"), "box");
        return new Response(JSON.stringify(shippingCostFixture), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (endpoint.pathname === "/api/v1/packages/json/") {
        assert.equal(options.method, "GET");
        assert.equal(endpoint.searchParams.get("waybill"), "920000000001");
        assert.equal(endpoint.searchParams.get("ref_ids"), "PAX-ORDER-1");
        assert.equal(options.headers["Content-Type"], "application/json");
        return new Response(JSON.stringify(trackingFixture), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (endpoint.pathname === "/api/rest/ewaybill/920000000001/") {
        assert.equal(options.method, "PUT");
        assert.equal(options.headers["Content-Type"], "application/json");
        assert.deepEqual(JSON.parse(options.body), ewaybillUpdatePayload);
        return new Response(JSON.stringify({ status: true, message: "E-waybill updated successfully" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (endpoint.pathname === "/api/p/update") {
        assert.equal(options.method, "POST");
        assert.equal(options.headers["Content-Type"], "application/json");
        assert.deepEqual(JSON.parse(options.body), { data: [{ waybill: "920000000001", act: "RE-ATTEMPT" }] });
        return new Response(JSON.stringify({ success: true, upl_id: "UPL-NDR-2" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (endpoint.pathname === "/api/p/edit") {
        assert.equal(options.method, "POST");
        assert.equal(options.headers["Content-Type"], "application/json");
        const providerPayload = JSON.parse(options.body);
        if (providerPayload.cancellation !== undefined) {
          assert.deepEqual(providerPayload, { waybill: "920000000001", cancellation: "true" });
          return new Response(JSON.stringify({ status: true, message: "Shipment cancellation accepted" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        assert.deepEqual(providerPayload, editPayload);
        return new Response(JSON.stringify({ status: true, message: "Shipment updated successfully" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (endpoint.pathname === "/api/cmu/create.json") {
        assert.equal(options.method, "POST");
        if (options.headers["Content-Type"] === "application/json") {
          assert.deepEqual(JSON.parse(options.body), mpsManifestPayload);
          return new Response(JSON.stringify({ packages: [
            { status: "Success", waybill: "900000000001", refnum: "PAX-MPS-1" },
            { status: "Success", waybill: "900000000002", refnum: "PAX-MPS-1" },
          ] }), { status: 200, headers: { "Content-Type": "application/json" } });
        }
        assert.equal(options.headers["Content-Type"], "application/x-www-form-urlencoded");
        const form = new URLSearchParams(options.body);
        assert.equal(form.get("format"), "json");
        const submittedManifest = JSON.parse(form.get("data"));
        if (submittedManifest.shipments[0].qc_type === "param") {
          assert.deepEqual(submittedManifest, rvpQcManifestPayload);
          return new Response(JSON.stringify({ packages: [{ status: "Success", waybill: "920000000003", refnum: "PAX-ORDER-1" }], upload_wbn: "UP-QC" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        assert.deepEqual(submittedManifest, manifestPayload);
        return new Response(JSON.stringify({ packages: [{ status: "Success", waybill: "920000000001", refnum: "PAX-ORDER-1" }], upload_wbn: "UP-1" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (endpoint.pathname === "/waybill/api/bulk/json/") {
        assert.equal(endpoint.searchParams.get("count"), "2");
        return new Response(JSON.stringify({ data: { waybills: ["900000000001", "900000000002"] } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (endpoint.pathname === "/api/dc/expected_tat") {
        assert.equal(endpoint.searchParams.get("origin_pin"), "122003");
        assert.equal(endpoint.searchParams.get("destination_pin"), "136118");
        assert.equal(endpoint.searchParams.get("mot"), "S");
        assert.equal(endpoint.searchParams.get("pdt"), "B2C");
        assert.equal(endpoint.searchParams.get("expected_pickup_date"), "2026-08-03 10:30");
        return new Response(JSON.stringify({ data: { tat: 3, expected_delivery_date: "2026-08-06" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (endpoint.pathname === "/api/dc/fetch/serviceability/pincode") {
        assert.equal(endpoint.searchParams.get("product_type"), "Heavy");
        assert.equal(endpoint.searchParams.get("pincode"), "400086");
        return new Response(JSON.stringify({ data: [{ pincode: 400086, payment_type: { COD: "Y", Prepaid: "Serviceable" }, serviceability: "Serviceable" }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      assert.equal(endpoint.searchParams.get("filter_codes"), "194103");
      return new Response(JSON.stringify({ delivery_codes: [{ postal_code: { pin: 194103, cod: "Y", pre_paid: "Y", remarks: "" } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });
  await client.checkServiceability("194103");
  await client.checkServiceability("194103");
  await client.checkHeavyServiceability("400086");
  await client.checkHeavyServiceability("400086");
  await client.getExpectedTat(tatRequest);
  await client.getExpectedTat(tatRequest);
  const shippingCost = await client.calculateShippingCost(shippingCostRequest);
  assert.equal(shippingCost.estimatedAmount, 160.48);
  await client.calculateShippingCost(shippingCostRequest);
  const fetchedWaybills = await client.fetchWaybills(2);
  assert.deepEqual(fetchedWaybills.waybills, ["900000000001", "900000000002"]);
  const fetchedSingleWaybill = await client.fetchSingleWaybill();
  assert.deepEqual(fetchedSingleWaybill.waybills, ["910000000001"]);
  const manifested = await client.createShipment(manifestInput);
  assert.equal(manifested.packages[0].waybill, "920000000001");
  const manifestedMps = await client.createShipment(mpsManifestInput);
  assert.equal(manifestedMps.packageCount, 2);
  const manifestedRvpQc = await client.createShipment(rvpQcManifestInput);
  assert.equal(manifestedRvpQc.packages[0].waybill, "920000000003");
  await assert.rejects(() => client.createShipment({ ...rvpQcManifestInput, shipments: [{ ...rvpQcManifestInput.shipments[0], customQc: [{ ...customQcInput[0], questions: [{ ...customQcInput[0].questions[0], questionId: "unmapped_question" }] }] }] }), (error) => error instanceof DelhiveryError && error.code === "UNMAPPED_RVP_QC_QUESTION");
  const pdfLabel = await client.generateShippingLabel(pdfLabelRequest);
  assert.equal(pdfLabel.downloadUrl, "https://labels.test.delhivery.local/920000000001-4R.pdf");
  const jsonLabel = await client.generateShippingLabel(jsonLabelRequest);
  assert.equal(jsonLabel.labelData.packages[0].barcode, "920000000001");
  const downloadedDocument = await client.downloadDocument(documentRequest);
  assert.equal(downloadedDocument.documentType, "EPOD");
  assert.equal(downloadedDocument.documentCount, 1);
  const submittedNdr = await client.applyNdrAction({ waybill: "920000000001", act: "RE-ATTEMPT", refIds: "PAX-ORDER-1" });
  assert.equal(submittedNdr.uplId, "UPL-NDR-2");
  assert.equal(submittedNdr.status, "Pending");
  const tomorrowInIndia = new Date(Date.now() + (330 * 60 * 1000) + (24 * 60 * 60 * 1000)).toISOString().slice(0, 10);
  const pickupCreated = await client.createPickupRequest({ pickupDate: tomorrowInIndia, pickupTime: "11:00:00", pickupLocation: "Pax Test Warehouse", expectedPackageCount: 2 });
  assert.equal(pickupCreated.providerPickupId, "PUR-TEST-2");
  const warehouseCreated = await client.createWarehouse(warehouseInput);
  assert.equal(warehouseCreated.name, "Kota Test Warehouse");
  const warehouseUpdated = await client.updateWarehouse(warehouseUpdateInput);
  assert.equal(warehouseUpdated.name, "Kota Test Warehouse");
  assert.equal(warehouseUpdated.updates.address, "Updated Industrial Area");
  const edited = await client.editShipment(editInput);
  assert.equal(edited.updated, true);
  assert.equal(edited.waybill, "920000000001");
  const cancelled = await client.cancelShipment({ waybill: "920000000001" });
  assert.equal(cancelled.cancelled, true);
  assert.equal(cancelled.waybill, "920000000001");
  const ewaybillUpdated = await client.updateEwaybill({ waybill: "920000000001", dcn: "INV-2026/001", ewbn: "181000000001" });
  assert.equal(ewaybillUpdated.updated, true);
  assert.equal(ewaybillUpdated.waybill, "920000000001");
  const tracked = await client.trackShipments({ waybills: ["920000000001"], refIds: "PAX-ORDER-1" });
  assert.equal(tracked.shipments[0].currentStatus.status, "NDR");
  await client.trackShipments({ waybills: ["920000000001"], refIds: "PAX-ORDER-1" });
  assert.equal(requestCount, 21, "each Delhivery contract uses its independent provider request path and cache");
  await assert.rejects(() => client.checkServiceability("123"), (error) => error instanceof DelhiveryError && error.status === 400);
  await assert.rejects(() => client.fetchWaybills(0), (error) => error instanceof DelhiveryError && error.code === "INVALID_WAYBILL_COUNT");
  await assert.rejects(() => client.fetchWaybills(10001), (error) => error instanceof DelhiveryError && error.code === "INVALID_WAYBILL_COUNT");
  await assert.rejects(() => client.getExpectedTat({ ...tatRequest, mot: "X" }), (error) => error instanceof DelhiveryError && error.code === "INVALID_TRANSPORT_MODE");
  await assert.rejects(() => client.getExpectedTat({ ...tatRequest, expectedPickupDate: "2026-02-30" }), (error) => error instanceof DelhiveryError && error.code === "INVALID_PICKUP_DATE");
  await assert.rejects(() => client.trackShipments({ waybills: Array.from({ length: 51 }, (_, index) => String(930000000000 + index)) }), (error) => error instanceof DelhiveryError && error.code === "INVALID_TRACKING_WAYBILLS");
  await assert.rejects(() => client.calculateShippingCost({ ...shippingCostRequest, ss: "Pending" }), (error) => error instanceof DelhiveryError && error.code === "INVALID_SHIPPING_STATUS");
  delete process.env.DELHIVERY_RVP_QC_QUESTION_IDS;
  const missingMappingClient = createDelhiveryClient({ fetchImpl: async () => { throw new Error("Provider must not be called without QC mapping"); } });
  await assert.rejects(() => missingMappingClient.createShipment(rvpQcManifestInput), (error) => error instanceof DelhiveryError && error.code === "DELHIVERY_RVP_QC_MAPPING_NOT_CONFIGURED");
} finally {
  if (originalToken === undefined) delete process.env.DELHIVERY_API_TOKEN; else process.env.DELHIVERY_API_TOKEN = originalToken;
  if (originalBaseUrl === undefined) delete process.env.DELHIVERY_BASE_URL; else process.env.DELHIVERY_BASE_URL = originalBaseUrl;
  if (originalInsecure === undefined) delete process.env.DELHIVERY_ALLOW_INSECURE_HTTP; else process.env.DELHIVERY_ALLOW_INSECURE_HTTP = originalInsecure;
  if (originalRvpQcQuestionIds === undefined) delete process.env.DELHIVERY_RVP_QC_QUESTION_IDS; else process.env.DELHIVERY_RVP_QC_QUESTION_IDS = originalRvpQcQuestionIds;
}

console.log(JSON.stringify({ serviceable: serviceable.pincode, embargoed: embargo.pincode, nsz: nsz.pincode, heavy: heavy.pincode, heavyNsz: heavyNsz.pincode, tatDays: tat.tatDays, tatNsz: tatNsz.status, shippingCost: normalizedShippingCost.estimatedAmount, bulkWaybillVerified: true, singleWaybillVerified: true, manifestationVerified: true, mpsManifestationVerified: true, rvpQcVerified: true, shipmentEditVerified: true, shipmentCancellationVerified: true, ewaybillUpdateVerified: true, shipmentTrackingVerified: true, shippingCostVerified: true, shippingLabelVerified: true, documentDownloadVerified: true, ndrActionVerified: true, pickupRequestVerified: true, warehouseCreationVerified: true, warehouseUpdateVerified: true, paymentConversionVerified: true, mpsJsonVerified: true, urlEncodingVerified: true, waybillParser: true, cacheVerified: true }));
