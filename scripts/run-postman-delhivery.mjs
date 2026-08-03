import { spawn } from "node:child_process";
import { startDelhiveryStub } from "./lib/delhiveryStub.mjs";

const apiPort = 3110;
const baseUrl = `http://127.0.0.1:${apiPort}`;
const delhiveryStub = await startDelhiveryStub(3111);
const api = spawn(process.execPath, ["server/index.js"], {
  cwd: new URL("..", import.meta.url),
  env: {
    ...process.env,
    PORT: String(apiPort),
    ADMIN_PASSWORD: "StrongPass123",
    JWT_SECRET: "postman-contract-signing-secret",
    DELHIVERY_ENV: "staging",
    DELHIVERY_API_TOKEN: delhiveryStub.token,
    DELHIVERY_BASE_URL: delhiveryStub.baseUrl,
    DELHIVERY_ALLOW_INSECURE_HTTP: "true",
    DELHIVERY_PICKUP_LOCATION: "Pax Test Warehouse",
    DELHIVERY_CLIENT_NAME: "Pax Test Client",
    DELHIVERY_RVP_QC_QUESTION_IDS: "serial_check,color_check,seal_check",
  },
  stdio: ["ignore", "inherit", "inherit"],
});

async function waitForApi() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (api.exitCode !== null) throw new Error(`Pax API exited before Postman could run (code ${api.exitCode}).`);
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Pax API did not become ready for the Postman suite.");
}

try {
  await waitForApi();
  const newmanArguments = [
    "--yes",
    "newman@6.2.1",
    "run",
    "postman/Pax-Delhivery-B2C.postman_collection.json",
    "-e",
    "postman/Pax-Local.postman_environment.json",
    "--env-var",
    `baseUrl=${baseUrl}`,
    "--reporters",
    "cli",
  ];
  const newman = process.platform === "win32"
    ? spawn(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", `npx ${newmanArguments.join(" ")}`], {
      cwd: new URL("..", import.meta.url),
      stdio: "inherit",
    })
    : spawn("npx", newmanArguments, {
    cwd: new URL("..", import.meta.url),
    stdio: "inherit",
    });
  const exitCode = await new Promise((resolve, reject) => {
    newman.once("error", reject);
    newman.once("exit", resolve);
  });
  if (exitCode !== 0) throw new Error(`Postman/Newman suite failed with exit code ${exitCode}.`);
} finally {
  if (api.exitCode === null) api.kill();
  await delhiveryStub.close();
}
