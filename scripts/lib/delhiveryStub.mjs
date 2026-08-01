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
      if (manifest?.pickup_location?.name !== "Pax Test Warehouse" || !Array.isArray(manifest?.shipments) || !manifest.shipments.length) {
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
