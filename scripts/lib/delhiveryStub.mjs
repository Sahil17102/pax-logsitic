import { createServer } from "node:http";

const SERVICEABILITY_FIXTURES = {
  "110001": { pin: 110001, cod: "N", pre_paid: "N", pickup: "N", reverse_pickup: "N", remarks: "Embargo", district: "New Delhi", state_code: "DL" },
  "194103": { pin: 194103, cod: "Y", pre_paid: "Y", pickup: "Y", reverse_pickup: "Y", remarks: "", district: "Leh", state_code: "LA" },
  "411001": { pin: 411001, cod: "Y", pre_paid: "Y", pickup: "Y", reverse_pickup: "Y", remarks: "", district: "Pune", state_code: "MH" },
  "500029": { pin: 500029, cod: "N", pre_paid: "Y", pickup: "Y", reverse_pickup: "Y", remarks: "", district: "Hyderabad", state_code: "TS" },
};

export async function startDelhiveryStub(port, token = "postman-delhivery-token") {
  let manifestSequence = 0;
  const manifestedOrders = new Set();
  const manifestedWaybills = new Set();
  const cancelledWaybills = new Set();
  const trackingByWaybill = new Map();
  const pickupRequests = new Set();
  const registeredWarehouses = new Set(["Pax Test Warehouse"]);
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    response.setHeader("Content-Type", "application/json");

    if (request.method === "GET" && url.pathname === "/waybill/api/fetch/json/") {
      if (url.searchParams.get("token") !== token) {
        response.statusCode = 401;
        response.end(JSON.stringify({ detail: "Invalid token" }));
        return;
      }
      response.end(JSON.stringify({ waybill: "910000000001" }));
      return;
    }
    if (request.headers.authorization !== `Token ${token}`) {
      response.statusCode = 401;
      response.end(JSON.stringify({ detail: "Invalid token" }));
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/backend/clientwarehouse/create/") {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      let warehouse;
      try {
        if (!String(request.headers["content-type"] || "").toLowerCase().startsWith("application/json")) throw new Error("JSON required");
        warehouse = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        response.statusCode = 400;
        response.end(JSON.stringify({ success: false, error: "Invalid warehouse JSON" }));
        return;
      }
      const allowedKeys = new Set([
        "name", "registered_name", "phone", "email", "address", "city", "pin", "country",
        "return_address", "return_city", "return_pin", "return_state", "return_country",
      ]);
      if (Object.keys(warehouse).some((key) => !allowedKeys.has(key))
        || !String(warehouse.name || "").trim()
        || !/^\d{10}$/.test(String(warehouse.phone || ""))
        || !/^[1-9]\d{5}$/.test(String(warehouse.pin || ""))
        || !String(warehouse.return_address || "").trim()) {
        response.end(JSON.stringify({ success: false, error: "Invalid warehouse request" }));
        return;
      }
      if (registeredWarehouses.has(warehouse.name)) {
        response.end(JSON.stringify({ success: false, error: "Warehouse name already exists" }));
        return;
      }
      registeredWarehouses.add(warehouse.name);
      response.statusCode = 201;
      response.end(JSON.stringify({ success: true, message: "Warehouse created successfully", name: warehouse.name }));
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/backend/clientwarehouse/edit/") {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      let update;
      try {
        if (!String(request.headers["content-type"] || "").toLowerCase().startsWith("application/json")) throw new Error("JSON required");
        update = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        response.statusCode = 400;
        response.end(JSON.stringify({ success: false, error: "Invalid warehouse update JSON" }));
        return;
      }
      const allowedKeys = new Set(["name", "address", "pin", "phone"]);
      if (Object.keys(update).some((key) => !allowedKeys.has(key))
        || !registeredWarehouses.has(update.name)
        || !/^[1-9]\d{5}$/.test(String(update.pin || ""))
        || (update.address !== undefined && !String(update.address).trim())
        || (update.phone !== undefined && !/^\d{10}$/.test(String(update.phone)))) {
        response.end(JSON.stringify({ success: false, error: "Invalid warehouse update" }));
        return;
      }
      response.end(JSON.stringify({ success: true, message: "Warehouse updated successfully", name: update.name }));
      return;
    }
    if (request.method === "POST" && url.pathname === "/fm/request/new/") {
      let pickup;
      try {
        pickup = JSON.parse(await new Promise((resolve, reject) => {
          let body = "";
          request.on("data", (chunk) => { body += chunk; });
          request.on("end", () => resolve(body));
          request.on("error", reject);
        }));
      } catch {
        response.statusCode = 400;
        response.end(JSON.stringify({ error: "Invalid JSON" }));
        return;
      }
      const requestKey = `${pickup.pickup_location}:${pickup.pickup_date}`;
      if (!registeredWarehouses.has(pickup.pickup_location)
        || !/^\d{4}-\d{2}-\d{2}$/.test(String(pickup.pickup_date || ""))
        || !/^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(String(pickup.pickup_time || ""))
        || !Number.isInteger(pickup.expected_package_count)
        || pickup.expected_package_count < 1) {
        response.end(JSON.stringify({ success: false, error: "Invalid pickup request" }));
        return;
      }
      if (pickupRequests.has(requestKey)) {
        response.end(JSON.stringify({ success: false, error: "A Pickup Request for this Pickup Location Already Exist." }));
        return;
      }
      pickupRequests.add(requestKey);
      response.statusCode = 201;
      response.end(JSON.stringify({ success: true, pickup_id: `PUR-STUB-${pickupRequests.size}`, message: "Pickup request submitted successfully." }));
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/p/packing_slip") {
      const waybill = String(url.searchParams.get("wbns") || "").trim();
      const pdf = String(url.searchParams.get("pdf") || "").trim().toLowerCase();
      const pdfSize = String(url.searchParams.get("pdf_size") || "A4").trim().toUpperCase();
      if (!/^\d{8,20}$/.test(waybill) || !manifestedWaybills.has(waybill) || !["true", "false"].includes(pdf) || !["A4", "4R"].includes(pdfSize)) {
        response.end(JSON.stringify({ packages: [], packages_found: 0 }));
        return;
      }
      const tracked = trackingByWaybill.get(waybill);
      if (pdf === "true") {
        response.end(JSON.stringify({
          packages: [{ waybill, order: tracked?.order || "" }],
          packages_found: 1,
          pdf_download_link: `https://labels.test.delhivery.local/${waybill}-${pdfSize}.pdf`,
        }));
        return;
      }
      response.end(JSON.stringify({
        packages: [{
          waybill,
          order: tracked?.order || "",
          consignee: "Delhivery Test Receiver",
          destination: "Leh",
          payment_mode: "Pre-paid",
          barcode: waybill,
        }],
        packages_found: 1,
      }));
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/v1/packages/json/") {
      const waybills = String(url.searchParams.get("waybill") || "").split(",").map((value) => value.trim()).filter(Boolean);
      const refIds = String(url.searchParams.get("ref_ids") || "").trim();
      if (!waybills.length || waybills.length > 50 || waybills.some((waybill) => !/^\d{8,20}$/.test(waybill))) {
        response.statusCode = 400;
        response.end(JSON.stringify({ Error: "Invalid waybill list" }));
        return;
      }
      const ShipmentData = waybills.flatMap((waybill) => {
        const tracked = trackingByWaybill.get(waybill);
        if (!tracked || (refIds && tracked.order !== refIds)) return [];
        const current = tracked.currentStatus || { status: "Manifested", statusType: "UD", instructions: "Manifest uploaded" };
        return [{ Shipment: {
          AWB: waybill,
          ReferenceNo: tracked.order,
          PickUpDate: "2026-08-02 10:00:00",
          Origin: "Hyderabad",
          Destination: "Leh",
          Status: {
            Status: current.status,
            StatusType: current.statusType,
            StatusDateTime: "2026-08-02T10:00:00.000",
            StatusLocation: "HYD Hub",
            Instructions: current.instructions,
          },
          Scans: [{ ScanDetail: {
            Scan: "Manifested",
            ScanType: "UD",
            ScanDateTime: "2026-08-02T10:00:00.000",
            ScannedLocation: "HYD Hub",
            Instructions: "Manifest uploaded",
          } }],
        } }];
      });
      response.end(JSON.stringify({ ShipmentData }));
      return;
    }
    const ewaybillMatch = url.pathname.match(/^\/api\/rest\/ewaybill\/(\d{8,20})\/$/);
    if (request.method === "PUT" && ewaybillMatch) {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      let update;
      try {
        if (!String(request.headers["content-type"] || "").toLowerCase().startsWith("application/json")) throw new Error("JSON required");
        update = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        response.statusCode = 400;
        response.end(JSON.stringify({ status: false, message: "Invalid e-waybill JSON" }));
        return;
      }
      const waybill = ewaybillMatch[1];
      const record = Array.isArray(update?.data) && update.data.length === 1 ? update.data[0] : null;
      if (!manifestedWaybills.has(waybill)) {
        response.end(JSON.stringify({ status: false, message: "No such waybill found" }));
        return;
      }
      if (!record || Object.keys(record).some((key) => !["dcn", "ewbn"].includes(key)) || !String(record.dcn || "").trim() || !String(record.ewbn || "").trim()) {
        response.end(JSON.stringify({ status: false, message: "Invalid e-waybill update payload" }));
        return;
      }
      response.end(JSON.stringify({ status: true, message: "E-waybill updated successfully", waybill }));
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/p/edit") {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      let edit;
      try {
        if (!String(request.headers["content-type"] || "").toLowerCase().startsWith("application/json")) throw new Error("JSON required");
        edit = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        response.statusCode = 400;
        response.end(JSON.stringify({ status: false, message: "Invalid JSON edit payload" }));
        return;
      }
      const editableKeys = ["name", "phone", "pt", "cod", "add", "products_desc", "gm", "shipment_height", "shipment_width", "shipment_length"];
      const invalidPhone = edit.phone !== undefined
        && (!Array.isArray(edit.phone) || !edit.phone.length || edit.phone.some((phone) => !/^\d{10}$/.test(String(phone))));
      if (!/^\d{8,20}$/.test(String(edit.waybill || "")) || !manifestedWaybills.has(String(edit.waybill))) {
        response.end(JSON.stringify({ status: false, message: "No such waybill found" }));
        return;
      }
      if (edit.cancellation !== undefined) {
        if (edit.cancellation !== "true" || Object.keys(edit).some((key) => !["waybill", "cancellation"].includes(key))) {
          response.end(JSON.stringify({ status: false, message: "Invalid cancellation payload" }));
          return;
        }
        if (cancelledWaybills.has(String(edit.waybill))) {
          response.end(JSON.stringify({ status: false, message: "Shipment is already cancelled" }));
          return;
        }
        cancelledWaybills.add(String(edit.waybill));
        const tracked = trackingByWaybill.get(String(edit.waybill));
        if (tracked) tracked.currentStatus = { status: "Manifested", statusType: "UD", instructions: "Cancellation accepted" };
        response.end(JSON.stringify({ status: true, message: "Shipment cancellation accepted", waybill: String(edit.waybill) }));
        return;
      }
      if (!editableKeys.some((key) => edit[key] !== undefined) || invalidPhone || (edit.pt !== undefined && !["COD", "Pre-paid"].includes(edit.pt))) {
        response.end(JSON.stringify({ status: false, message: "Invalid shipment edit payload" }));
        return;
      }
      response.end(JSON.stringify({ status: true, message: "Shipment updated successfully", waybill: String(edit.waybill) }));
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/cmu/create.json") {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const rawBody = Buffer.concat(chunks).toString("utf8");
      const contentType = String(request.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
      let manifest;
      try {
        if (contentType === "application/json") {
          manifest = JSON.parse(rawBody);
        } else {
          const form = new URLSearchParams(rawBody);
          if (form.get("format") !== "json" || !form.get("data")) throw new Error("format key missing in the post");
          manifest = JSON.parse(form.get("data"));
        }
      } catch {
        response.statusCode = 400;
        response.end(JSON.stringify({ message: "invalid manifest JSON" }));
        return;
      }
      if (!registeredWarehouses.has(manifest?.pickup_location?.name) || !Array.isArray(manifest?.shipments) || !manifest.shipments.length) {
        response.end(JSON.stringify({ packages: [], rmk: "shipment list contains no data" }));
        return;
      }
      const multiPiece = manifest.shipments.length > 1;
      const masterWaybill = String(manifest.shipments[0].master_id || "");
      const invalidMps = multiPiece && (contentType !== "application/json"
        || !manifest.shipments.some((shipment) => shipment.waybill === masterWaybill)
        || manifest.shipments.some((shipment) => shipment.shipment_type !== "MPS"
          || shipment.mps_children !== manifest.shipments.length
          || String(shipment.master_id) !== masterWaybill
          || shipment.mps_amount !== (shipment.payment_mode === "COD" ? 2400 : 0)));
      if (invalidMps || (!multiPiece && contentType !== "application/x-www-form-urlencoded")) {
        response.end(JSON.stringify({ packages: [], rmk: "Invalid MPS or content-type contract" }));
        return;
      }
      const packages = manifest.shipments.map((shipment) => {
        if (shipment.name === "Reject Manifest" || shipment.client !== "Pax Test Client" || manifestedOrders.has(`${shipment.order}:${shipment.waybill || "dynamic"}`)) {
          return { status: "Failure", remarks: "Invalid client or duplicate order", refnum: shipment.order };
        }
        manifestedOrders.add(`${shipment.order}:${shipment.waybill || "dynamic"}`);
        manifestSequence += 1;
        const waybill = shipment.waybill || String(920000000000 + manifestSequence);
        manifestedWaybills.add(String(waybill));
        trackingByWaybill.set(String(waybill), {
          order: String(shipment.order),
          currentStatus: { status: "Manifested", statusType: "UD", instructions: "Manifest uploaded" },
        });
        return { status: "Success", waybill, refnum: shipment.order, remarks: "" };
      });
      response.end(JSON.stringify({ packages, package_count: packages.length, upload_wbn: `UP-${manifestSequence}` }));
      return;
    }
    if (request.method === "GET" && url.pathname === "/waybill/api/bulk/json/") {
      const count = Number(url.searchParams.get("count"));
      if (!Number.isInteger(count) || count < 1 || count > 10000) {
        response.statusCode = 400;
        response.end(JSON.stringify({ message: "count must be between 1 and 10000" }));
        return;
      }
      response.end(JSON.stringify({
        waybills: Array.from({ length: count }, (_, index) => String(900000000001 + index)),
      }));
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/dc/expected_tat") {
      const originPin = url.searchParams.get("origin_pin");
      const destinationPin = url.searchParams.get("destination_pin");
      const mot = url.searchParams.get("mot");
      if (!originPin || !destinationPin || !["S", "E", "N"].includes(mot)) {
        response.statusCode = 400;
        response.end(JSON.stringify({ message: "Invalid TAT parameters" }));
        return;
      }
      if (destinationPin === "999997") {
        response.end(JSON.stringify({ data: { origin_pin: originPin, destination_pin: destinationPin, status: "NSZ", message: "NSZ" } }));
        return;
      }
      const tatByMode = { S: 3, E: 2, N: 1 };
      response.end(JSON.stringify({
        data: {
          origin_pin: originPin,
          destination_pin: destinationPin,
          tat: tatByMode[mot],
          expected_delivery_date: "2026-08-05",
        },
      }));
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/kinko/v1/invoice/charges/.json") {
      const md = url.searchParams.get("md");
      const cgm = Number(url.searchParams.get("cgm"));
      const originPin = url.searchParams.get("o_pin");
      const destinationPin = url.searchParams.get("d_pin");
      const shipmentStatus = url.searchParams.get("ss");
      const paymentType = url.searchParams.get("pt");
      const packageType = url.searchParams.get("ipkg_type");
      const dimensions = ["l", "b", "h"].map((key) => url.searchParams.has(key) ? Number(url.searchParams.get(key)) : null);
      if (originPin === "999996" || !/^[1-9]\d{5}$/.test(String(originPin || ""))) {
        response.end(JSON.stringify({ error: "Unable to process request for provided o_pin" }));
        return;
      }
      if (!/^[1-9]\d{5}$/.test(String(destinationPin || "")) || !["S", "E"].includes(md)
        || !Number.isSafeInteger(cgm) || cgm < 0 || !["Delivered", "RTO", "DTO"].includes(shipmentStatus)
        || !["Pre-paid", "COD"].includes(paymentType) || (packageType && !["box", "flyer"].includes(packageType))
        || dimensions.some((value) => value !== null && (!Number.isSafeInteger(value) || value < 1))) {
        response.statusCode = 400;
        response.end(JSON.stringify({ error: "Invalid shipping charge parameters" }));
        return;
      }
      const freight = (md === "E" ? 150 : 100) + Math.ceil(cgm / 500) * 12;
      const cod = paymentType === "COD" ? 25 : 0;
      const serviceTax = Number(((freight + cod) * 0.18).toFixed(2));
      response.end(JSON.stringify([{
        zone: "D",
        charged_weight: cgm,
        charge_freight: freight,
        charge_COD: cod,
        tax_data: { service_tax: serviceTax },
        total_amount: Number((freight + cod + serviceTax).toFixed(2)),
      }]));
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/dc/fetch/serviceability/pincode") {
      const pincode = url.searchParams.get("pincode");
      if (url.searchParams.get("product_type") !== "Heavy") {
        response.statusCode = 400;
        response.end(JSON.stringify({ message: "product_type must be Heavy" }));
        return;
      }
      if (pincode === "400086") {
        response.end(JSON.stringify({
          data: [{ pincode: 400086, product_type: "Heavy", payment_type: ["Pre-paid", "COD"], serviceability: "Serviceable", city: "Mumbai", state_code: "MH" }],
        }));
        return;
      }
      response.end(JSON.stringify({ pincode: Number(pincode), product_type: "Heavy", payment_type: "NSZ", serviceability: "NSZ" }));
      return;
    }
    if (request.method !== "GET" || url.pathname !== "/c/api/pin-codes/json/") {
      response.statusCode = 404;
      response.end(JSON.stringify({ detail: "Not found" }));
      return;
    }

    const pincode = url.searchParams.get("filter_codes");
    const fixture = SERVICEABILITY_FIXTURES[pincode];
    response.end(JSON.stringify({ delivery_codes: fixture ? [{ postal_code: fixture }] : [] }));
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    token,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}
