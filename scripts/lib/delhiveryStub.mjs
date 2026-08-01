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
