// Render the platform pages with a headless browser and save screenshots, so
// we can visually check the graphic design. Serves web/ statically and drives
// it against the running edge Worker.
//
//   node scripts/shoot.mjs
//
// Requires: the edge Worker on :8799 (wrangler dev) seeded with demo stores.

import { chromium } from "playwright";
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const WEB_ROOT = normalize(join(fileURLToPath(import.meta.url), "../../../web"));
const PORT = 8088;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split("?")[0]);
    if (p === "/") p = "/index.html";
    const file = join(WEB_ROOT, p);
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404); res.end("not found");
  }
});
await new Promise((r) => server.listen(PORT, r));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
const logs = [];
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));

async function snap(name, urlHash = "") {
  await page.goto(`http://localhost:${PORT}/index.html${urlHash}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `/tmp/mp-${name}.png`, fullPage: true });
  console.log(`saved /tmp/mp-${name}.png`);
}

await snap("marketplace");
// Open a specific storefront via deep link.
await snap("store-orinoco", "#/tienda/super-orinoco");
await snap("store-maria", "#/tienda/artesania-maria");

if (logs.length) { console.log("\n-- browser console --"); logs.forEach((l) => console.log(l)); }

await browser.close();
server.close();
