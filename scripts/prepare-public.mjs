import { cp, mkdir, rm } from "node:fs/promises";

await rm("public", { recursive: true, force: true });
await mkdir("public/assets", { recursive: true });
await cp("styles.css", "public/styles.css");
await cp("script.js", "public/script.js");
await cp("assets/favicon.svg", "public/assets/favicon.svg");
