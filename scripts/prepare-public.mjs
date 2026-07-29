import { cp, mkdir, rm } from "node:fs/promises";

await rm("public", { recursive: true, force: true });
await mkdir("public/assets", { recursive: true });
await cp("styles.css", "public/styles.css");
await cp("script.js", "public/script.js");
await cp("assets/favicon.svg", "public/assets/favicon.svg");
await cp("assets/pax-courier-hero.png", "public/assets/pax-courier-hero.png");
await cp("assets/pax-warehouse-operations.png", "public/assets/pax-warehouse-operations.png");
await cp("assets/pax-last-mile-delivery.png", "public/assets/pax-last-mile-delivery.png");
