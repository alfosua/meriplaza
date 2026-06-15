// Large grocery seed for the supermarket experience: many geo-spread stores per
// city + a big grocery catalog + lots of multi-store offers so price comparison
// is rich. Built for SCALE testing (thousands of stores / products), so instead
// of ~tens-of-thousands of HTTP POSTs it generates one SQL file and applies it
// directly to D1 with `wrangler d1 execute` (fast, transactional).
//
//   node scripts/seed-grocery.mjs                  # defaults, --local
//   node scripts/seed-grocery.mjs --stores 1200 --products 1500
//   node scripts/seed-grocery.mjs --remote         # apply to the live D1
//   node scripts/seed-grocery.mjs --sql-only out.sql   # just write the SQL
//
// Idempotency: grocery rows created here are tagged (sellers handle prefix
// `g-`, product ids prefixed `gprod_`). The script DELETEs those tagged rows
// first, so re-running replaces the grocery dataset without touching the
// hand-curated seed-v3 data.

import { writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

// ---- args ----
const args = process.argv.slice(2);
const flag = (name, def) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : def; };
const has = (name) => args.includes(name);
const STORES = parseInt(flag("--stores", "700"), 10);
const PRODUCTS = parseInt(flag("--products", "1400"), 10);
const REMOTE = has("--remote");
const SQL_ONLY = has("--sql-only") ? (flag("--sql-only", "grocery-seed.sql")) : null;

// ---- reference geography (matches migrations 0004/0007) ----
// Caracas is weighted heavily so one city holds a realistic "thousands" density.
const CITIES = [
  { slug: "caracas", name: "Caracas", lat: 10.4806, lng: -66.9036, weight: 6 },
  { slug: "maracaibo", name: "Maracaibo", lat: 10.6545, lng: -71.6451, weight: 2 },
  { slug: "valencia", name: "Valencia", lat: 10.1620, lng: -68.0077, weight: 2 },
  { slug: "barquisimeto", name: "Barquisimeto", lat: 10.0647, lng: -69.3470, weight: 1 },
  { slug: "maracay", name: "Maracay", lat: 10.2469, lng: -67.5958, weight: 1 },
  { slug: "puerto-ordaz", name: "Puerto Ordaz", lat: 8.2966, lng: -62.7116, weight: 1 },
  { slug: "merida", name: "Mérida", lat: 8.5980, lng: -71.1561, weight: 1 },
  { slug: "maturin", name: "Maturín", lat: 9.7457, lng: -63.1832, weight: 1 },
];

// Supermarket chains/banners; each gets many neighborhood branches.
const CHAINS = [
  "Super Líder", "MercaPlus", "El Surtidor", "Central Madeirense", "Automercado Plaza",
  "Excelsior Gama", "Bicentenario", "Día a Día", "Más x Menos", "La Despensa",
  "Súper 99", "Económico", "MegaMercado", "Frescomar", "Abasto Familiar",
  "Tu Mercado", "Provea", "Garzón", "Unicasa", "Rattan Express",
];
const ZONES = ["Centro", "Las Mercedes", "Altamira", "Chacao", "El Hatillo", "La Candelaria", "Sabana Grande",
  "Los Palos Grandes", "El Paraíso", "Catia", "Petare", "La Urbina", "Boleíta", "El Cafetal", "Santa Mónica",
  "La Castellana", "Bello Monte", "Los Ruices", "Macaracuay", "El Marqués"];

// ---- grocery catalog vocabulary ----
const CATALOG = {
  Alimentos: {
    icon: "🍞",
    items: ["Harina de Maíz", "Arroz Blanco", "Pasta Larga", "Pasta Corta", "Caraotas Negras", "Lentejas",
      "Azúcar Refinada", "Sal Marina", "Aceite Vegetal", "Atún en Lata", "Sardinas", "Mayonesa", "Salsa de Tomate",
      "Avena en Hojuelas", "Galletas de Soda", "Pan de Sándwich", "Queso Blanco", "Mortadela", "Jamón Ahumado",
      "Mantequilla", "Margarina", "Cereal", "Granola", "Harina de Trigo", "Maicena", "Mermelada", "Miel", "Café Molido",
      "Leche en Polvo", "Leche Líquida", "Yogurt Firme", "Huevos", "Diablitos", "Ketchup", "Mostaza"],
    brands: ["P.A.N.", "Primor", "Mary", "Mavesa", "Diana", "Heinz", "La Campiña", "Santa Bárbara", "Robín", "Vatel",
      "Maizina Americana", "Pampero", "Iberia", "Margarita", "Carabobo"],
    sizes: ["500g", "1kg", "2kg", "400g", "200g", "1L", "900g", "Pack x3", "Familiar"],
    price: [25, 320],
  },
  Bebidas: {
    icon: "🧃",
    items: ["Refresco Cola", "Refresco Naranja", "Agua Mineral", "Jugo de Naranja", "Jugo de Manzana", "Malta",
      "Té Frío", "Cerveza", "Vino Tinto", "Néctar de Durazno", "Bebida Isotónica", "Café Listo", "Chocolate en Polvo",
      "Polvo para Jugo", "Agua Saborizada", "Energizante"],
    brands: ["Coca-Cola", "Pepsi", "Frescolita", "Maltín Polar", "Yukery", "Nestlé", "Toddy", "Tang", "Gatorade",
      "Minalba", "Nevada", "Pampero"],
    sizes: ["355ml", "1.5L", "2L", "Pack x6", "1L", "330ml"],
    price: [15, 220],
  },
  Salud: {
    icon: "💊",
    items: ["Acetaminofén", "Ibuprofeno", "Loratadina", "Suero Oral", "Alcohol Antiséptico", "Gasas", "Curitas",
      "Termómetro Digital", "Multivitamínico", "Vitamina C", "Vitamina D", "Omega 3", "Antiácido", "Protector Solar",
      "Gel Antibacterial", "Mascarillas", "Repelente", "Algodón", "Agua Oxigenada"],
    brands: ["Genven", "Vidamax", "Calox", "Leti", "Elmer", "Pfizer", "Bayer", "Nikzon", "Atamel"],
    sizes: ["x10", "x20", "x30", "120ml", "60ml", "Caja", "Frasco"],
    price: [8, 150],
  },
  "Cuidado personal": {
    icon: "🧴",
    items: ["Jabón de Tocador", "Shampoo", "Acondicionador", "Crema Dental", "Cepillo Dental", "Desodorante",
      "Papel Higiénico", "Toallas Húmedas", "Pañales", "Toallas Sanitarias", "Afeitadora", "Crema Corporal",
      "Enjuague Bucal", "Hisopos", "Talco", "Gel de Baño"],
    brands: ["Las Llaves", "Savital", "Colgate", "Oral-B", "Rexona", "Protector", "Nivea", "Dove", "Pampers", "Nosotras",
      "Gillette", "Listerine"],
    sizes: ["400ml", "200ml", "x4", "x12", "x24", "Familiar", "Grande"],
    price: [9, 180],
  },
  Hogar: {
    icon: "🏠",
    items: ["Detergente en Polvo", "Detergente Líquido", "Suavizante", "Cloro", "Lavaplatos", "Desinfectante",
      "Limpiavidrios", "Bolsas de Basura", "Servilletas", "Papel Aluminio", "Esponjas", "Cepillo de Piso",
      "Ambientador", "Insecticida", "Fósforos", "Velas", "Guantes de Cocina", "Film Plástico"],
    brands: ["Ariel", " Las Llaves", "Suavitel", "Cloro Nevex", "Mistolín", "Ace", "Ponset", "Familia", "Reynolds",
      "Glade", "Baygon"],
    sizes: ["1kg", "2L", "900ml", "x30", "x50", "Pack", "Grande"],
    price: [18, 250],
  },
  Mascotas: {
    icon: "🐾",
    items: ["Alimento para Perros", "Alimento para Gatos", "Arena Sanitaria", "Snacks Dentales", "Shampoo para Mascotas",
      "Collar Antipulgas", "Premios para Perro", "Comida Húmeda", "Juguete Mordedor", "Comedero"],
    brands: ["Dog Chow", "Cat Chow", "Pedigree", "Whiskas", "PetCare", "PetFun", "Purina", "DoggyLand"],
    sizes: ["1kg", "3kg", "8kg", "Lata", "Pack x6", "Unidad"],
    price: [30, 420],
  },
};

// ---- deterministic RNG so reseeds are reproducible ----
let _seed = 1337;
const rand = () => { _seed = (_seed * 1103515245 + 12345) & 0x7fffffff; return _seed / 0x7fffffff; };
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const rint = (a, b) => a + Math.floor(rand() * (b - a + 1));
let _uid=0;
const uid = (p) => p + (_uid++).toString(36).padStart(8,"0") + hex(6);
const hex = (n) => Array.from({ length: n }, () => "0123456789abcdef"[Math.floor(rand() * 16)]).join("");

const sq = (s) => String(s).replace(/'/g, "''");
const slugify = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);

// ---- generate stores ----
const totalWeight = CITIES.reduce((a, c) => a + c.weight, 0);
const stores = []; // {id, handle, name, lat, lng, citySlug, currency}
let storeN = 0;
for (const city of CITIES) {
  const n = Math.max(1, Math.round((STORES * city.weight) / totalWeight));
  for (let i = 0; i < n && stores.length < STORES; i++) {
    const chain = CHAINS[storeN % CHAINS.length];
    const zone = pick(ZONES);
    const id = uid("sel_g");
    const handle = `g-${slugify(chain)}-${city.slug}-${i + 1}`;
    const name = `${chain} ${zone}`;
    // jitter ~ up to 0.10° (~11 km) around the city centre
    const lat = +(city.lat + (rand() - 0.5) * 0.20).toFixed(5);
    const lng = +(city.lng + (rand() - 0.5) * 0.20).toFixed(5);
    // ~38% of branches are "certified" (verified seller, quality-checked) and
    // ~55% offer instant delivery (Yummy/Ridery 30–60 min).
    const certified = rand() < 0.38;
    const instant = rand() < 0.55;
    stores.push({ id, handle, name, lat, lng, citySlug: city.slug, currency: "VES", chain, zone, certified, instant });
    storeN++;
  }
}

// ---- generate products ----
const cats = Object.keys(CATALOG);
const products = []; // {id, slug, title, category, brand, basePrice}
const seenSlug = new Set();
let pN = 0;
while (products.length < PRODUCTS) {
  const cat = cats[pN % cats.length];
  const spec = CATALOG[cat];
  const item = pick(spec.items);
  const brand = pick(spec.brands);
  const size = pick(spec.sizes);
  const title = `${item} ${brand} ${size}`;
  let slug = slugify(title);
  if (seenSlug.has(slug)) { slug = slug + "-" + (pN % 1000); }
  if (seenSlug.has(slug)) { pN++; continue; }
  seenSlug.add(slug);
  const id = uid("gprod_");
  const basePrice = rint(spec.price[0], spec.price[1]);
  products.push({ id, slug, title, category: cat, brand, basePrice, item });
  pN++;
}

// ---- generate offers: each product is sold by a set of stores ----
// The first ~12% of products are "staples" (harina, arroz, leche…) carried by a
// large fraction of supermarkets, so the nearest stores reliably overlap and the
// price comparison is meaningful. The long tail is sold by just a few stores.
const offers = []; // {id, productId, sellerId, price, stock, compareAt, promo, featured}
const STAPLES = Math.round(products.length * 0.12);
for (let pi = 0; pi < products.length; pi++) {
  const p = products[pi];
  const chosen = new Set();
  if (pi < STAPLES) {
    // staple: stocked by 45–80% of all stores
    const frac = 0.45 + rand() * 0.35;
    for (const s of stores) if (rand() < frac) chosen.add(s.id);
  } else {
    const k = rint(3, 12);
    for (let i = 0; i < k; i++) chosen.add(stores[Math.floor(rand() * stores.length)].id);
  }
  for (const sellerId of chosen) {
    // ±18% spread around the base price → meaningful comparison/savings
    const price = (p.basePrice * (0.82 + rand() * 0.36)).toFixed(2);
    const promo = rand() < 0.12;
    offers.push({
      id: uid("off_g"), productId: p.id, sellerId, price,
      stock: rint(0, 120),
      compareAt: promo ? (parseFloat(price) * 1.2).toFixed(2) : "",
      promo: promo ? "Oferta" : "",
      featured: rand() < 0.04 ? 1 : 0,
    });
  }
}

// ---- emit SQL ----
function multiInsert(table, cols, rows, toVals, chunk = 100) {
  if (!rows.length) return "";
  const CHUNK = chunk;
  let out = "";
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    out += `INSERT INTO ${table} (${cols.join(",")}) VALUES\n` +
      slice.map((r) => `(${toVals(r)})`).join(",\n") + ";\n";
  }
  return out;
}

// NB: no explicit BEGIN/COMMIT — `wrangler d1 execute --file` wraps the import
// atomically itself, and the remote import path rejects manual transaction
// statements. The schema has no FK constraints, so ordering of DELETE/INSERT is
// the only concern (handled below).
let sql = "";
// Clean previous grocery dataset (tagged rows only).
sql += "DELETE FROM offers WHERE id LIKE 'off_g%';\n";
sql += "DELETE FROM store_cities WHERE seller_id LIKE 'sel_g%';\n";
sql += "DELETE FROM offers WHERE product_id LIKE 'gprod_%';\n";
sql += "DELETE FROM products WHERE id LIKE 'gprod_%';\n";
sql += "DELETE FROM sellers WHERE id LIKE 'sel_g%';\n";

sql += multiInsert("sellers", ["id", "handle", "doc", "lat", "lng"], stores, (s) => {
  const doc = {
    id: s.id, handle: s.handle, name: s.name, kind: "supermarket", taxId: "",
    merchantId: `m_${s.id}`, currency: s.currency,
    certified: s.certified, instant: s.instant,
    theme: { primaryColor: "#0a7d3b", accentColor: "#f5a623", tagline: `Tu supermercado en ${s.zone}`, layout: "grid" },
    socials: {},
    paymentMethods: {
      pago_movil: { bank: "0102 Banco de Venezuela", phone: "0414-1234567", ci: "J-40000000-0" },
      transferencia: { bank: "0105 Banco Mercantil", account: "0105-0000-00-0000000000", holder: s.name },
    },
    shipping: [
      ...(s.instant ? [{ provider: "Yummy Rides", eta: "30–60 min", fee: "Bs 60" }, { provider: "Ridery", eta: "45 min", fee: "$2" }] : []),
      { provider: "Tango", eta: "1–2 h", fee: "Bs 50" },
      { provider: "Retiro en tienda", eta: "Hoy", fee: "Gratis" },
    ],
  };
  return `'${sq(s.id)}','${sq(s.handle)}','${sq(JSON.stringify(doc))}',${s.lat},${s.lng}`;
}, 25);

sql += multiInsert("store_cities", ["seller_id", "city_slug"], stores, (s) => `'${sq(s.id)}','${sq(s.citySlug)}'`);

sql += multiInsert("products", ["id", "slug", "title", "category", "brand", "description", "images", "specs"], products, (p) =>
  `'${sq(p.id)}','${sq(p.slug)}','${sq(p.title)}','${sq(p.category)}','${sq(p.brand)}','${sq(`${p.item} ${p.brand} — disponible con despacho local y factura fiscal.`)}','[]','{}'`);

sql += multiInsert("offers", ["id", "product_id", "seller_id", "price", "currency", "tax_rate", "stock", "compare_at", "promo", "featured"], offers, (o) =>
  `'${sq(o.id)}','${sq(o.productId)}','${sq(o.sellerId)}','${o.price}','VES','16.00',${o.stock},'${o.compareAt}','${sq(o.promo)}',${o.featured}`);


const summary = `${stores.length} stores, ${products.length} products, ${offers.length} offers`;

if (SQL_ONLY) {
  await writeFile(SQL_ONLY, sql);
  console.log(`Wrote ${SQL_ONLY} (${summary}).`);
  process.exit(0);
}

// Apply via wrangler d1 execute --file.
const tmp = `/tmp/mp-grocery-seed-${Date.now()}.sql`;
await writeFile(tmp, sql);
const target = REMOTE ? "--remote" : "--local";
console.log(`Applying grocery seed (${summary}) ${target}…`);
const res = spawnSync("npx", ["wrangler", "d1", "execute", "meriplaza", target, "--file", tmp, "--yes"], {
  stdio: "inherit", cwd: process.cwd(),
});
process.exit(res.status ?? 0);
