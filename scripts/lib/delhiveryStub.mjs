import { createServer } from "node:http";

const SERVICEABILITY_FIXTURES = {
  "110001": { pin: 110001, cod: "N", pre_paid: "N", pickup: "N", reverse_pickup: "N", remarks: "Embargo", district: "New Delhi", state_code: "DL" },
  "194103": { pin: 194103, cod: "Y", pre_paid: "Y", pickup: "Y", reverse_pickup: "Y", remarks: "", district: "Leh", state_code: "LA" },
  "411001": { pin: 411001, cod: "Y", pre_paid: "Y", pickup: "Y", reverse_pickup: "Y", remarks: "", district: "Pune", state_code: "MH" },
  "500029": { pin: 500029, cod: "N", pre_paid: "Y", pickup: "Y", reverse_pickup: "Y", remarks: "", district: "Hyderabad", state_code: "TS" },
};

export async function startDelhiveryStub(port, token = "postman-delhivery-token") {
  const server = createServer((request, response) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    response.setHeader("Content-Type", "application/json");

    if (request.headers.authorization !== `Token ${token}`) {
      response.statusCode = 401;
      response.end(JSON.stringify({ detail: "Invalid token" }));
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
