// Fetch one real, hotlinkable product image per key from Wikimedia Commons via
// its API (the API tolerates this better than bulk-fetching the file server).
// Writes scripts/images.json { key: thumburl }. Run occasionally to refresh.
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const UA = "MeriplazaSeed/1.0 (https://meriplaza-edge.alfosuag.workers.dev; demo)";

const TERMS = {
  corn_flour: "flour sack", ground_coffee: "ground coffee", milk_powder: "powdered milk",
  bread_baguette: "baguette bread", cooking_oil: "olive oil bottle", white_rice: "white rice bowl",
  paracetamol: "paracetamol box", vitamin_c: "vitamin pills bottle", soap_bar: "handmade soap",
  shampoo: "shampoo bottle", bluetooth_earbuds: "wireless earbuds", usb_charger: "usb power adapter",
  power_bank: "power bank charger", wireless_mouse: "wireless mouse computer", mechanical_keyboard: "mechanical keyboard",
  hammock: "hammock", wicker_basket: "empty wicker basket", necklace: "necklace beads",
  tshirt: "t-shirt white", sneakers: "running shoe", jeans: "blue jeans",
  dog_food: "dog food bowl", cat_toy: "cat toy",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = {};

for (const [key, term] of Object.entries(TERMS)) {
  const api = `https://commons.wikimedia.org/w/api.php?action=query&generator=search` +
    `&gsrsearch=${encodeURIComponent(term + " filetype:bitmap")}&gsrnamespace=6&gsrlimit=6` +
    `&prop=imageinfo&iiprop=url|mime&iiurlwidth=640&format=json&origin=*`;
  try {
    const res = await fetch(api, { headers: { "User-Agent": UA } });
    const data = await res.json();
    const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
    // pick the first JPEG/PNG thumb that isn't an svg/icon
    let pick = null;
    for (const p of pages) {
      const ii = p.imageinfo?.[0];
      if (!ii?.thumburl) continue;
      if (!/\.(jpg|jpeg|png)$/i.test(ii.thumburl)) continue;
      pick = ii.thumburl; break;
    }
    if (pick) { out[key] = pick; console.log(`✓ ${key} -> ${pick.split("/").pop()}`); }
    else console.log(`✗ ${key} (no suitable image)`);
  } catch (e) {
    console.log(`✗ ${key} (${e.message})`);
  }
  await sleep(1200); // be polite to the API
}

await writeFile(join(HERE, "images.json"), JSON.stringify(out, null, 2));
console.log(`\nWrote ${Object.keys(out).length}/${Object.keys(TERMS).length} images to images.json`);
