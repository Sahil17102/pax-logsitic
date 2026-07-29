import { cp, mkdir } from "node:fs/promises";

await mkdir("public/assets", { recursive: true });
await cp("styles.css", "public/styles.css");
await cp("script.js", "public/script.js");
await cp("assets/favicon.svg", "public/assets/favicon.svg");
await cp("assets/pax-logistics-3d-hero.png", "public/assets/pax-logistics-3d-hero.png");
