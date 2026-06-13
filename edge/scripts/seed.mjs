// Seed the SalesFactory edge backend with demo stores (fake users) across
// different store kinds, each with its own catalog. Idempotent-ish: it skips a
// seller whose handle already exists.
//
//   node scripts/seed.mjs [baseURL] [user:pass]
//
// Defaults to http://localhost:8799 with no auth (local wrangler dev).

const BASE = process.argv[2] || "http://localhost:8799";
const AUTH = process.argv[3] || "";
const headers = { "content-type": "application/json" };
if (AUTH) headers["authorization"] = "Basic " + Buffer.from(AUTH).toString("base64");

const STORES = [
  {
    seller: {
      handle: "super-orinoco", name: "Supermercado Orinoco", kind: "supermarket",
      taxId: "J-09512461-4", currency: "VES",
      theme: { primaryColor: "#0a7d3b", accentColor: "#f5a623", tagline: "Lo mejor de Guayana al mejor precio", layout: "grid" },
      socials: { whatsapp: "584140000001", instagram: "superorinoco" },
    },
    products: [
      { title: "Harina P.A.N. 1kg", price: "45.00", taxRate: "16.00", stock: 120, description: "Harina de maíz precocida" , category: "Alimentos" },
      { title: "Café Fama de América 500g", price: "210.00", taxRate: "16.00", stock: 60, description: "Café molido" , category: "Bebidas" },
      { title: "Leche en polvo 900g", price: "320.00", taxRate: "16.00", stock: 40 , category: "Alimentos" },
      { title: "Pan canilla", price: "18.00", taxRate: "0.00", stock: 200, description: "Recién horneado" , category: "Alimentos" },
      { title: "Aceite de maíz 1L", price: "95.00", taxRate: "16.00", stock: 80 , category: "Alimentos" },
    ],
  },
  {
    seller: {
      handle: "artesania-maria", name: "Artesanías María", kind: "independent", currency: "USD",
      theme: { primaryColor: "#7b2ff7", accentColor: "#ff5ca8", tagline: "Hecho a mano en Mérida", layout: "featured" },
      socials: { instagram: "artesaniasmaria", whatsapp: "584140000002" },
    },
    products: [
      { title: "Hamaca tejida", price: "45.00", currency: "USD", taxRate: "16.00", stock: 8, description: "Algodón 100%" , category: "Artesanía" },
      { title: "Cesta de mimbre", price: "15.00", currency: "USD", taxRate: "16.00", stock: 20 , category: "Hogar" },
      { title: "Collar artesanal", price: "12.00", currency: "USD", taxRate: "16.00", stock: 30 , category: "Accesorios" },
    ],
  },
  {
    seller: {
      handle: "tech-zone", name: "Tech Zone CCS", kind: "store", taxId: "J-12345678-4", currency: "USD",
      theme: { primaryColor: "#1f2937", accentColor: "#3b82f6", tagline: "Tecnología con garantía", layout: "grid" },
      socials: { facebook: "techzoneccs" },
    },
    products: [
      { title: "Cargador USB-C 65W", price: "22.00", currency: "USD", taxRate: "16.00", stock: 35 , category: "Tecnología" },
      { title: "Audífonos Bluetooth", price: "38.00", currency: "USD", taxRate: "16.00", stock: 15 , category: "Tecnología" },
      { title: "Power Bank 20000mAh", price: "30.00", currency: "USD", taxRate: "16.00", stock: 0, description: "Agotado temporalmente" , category: "Tecnología" },
      { title: "Mouse inalámbrico", price: "14.00", currency: "USD", taxRate: "16.00", stock: 25 , category: "Tecnología" },
    ],
  },
];

async function post(path, body) {
  const res = await fetch(BASE + path, { method: "POST", headers, body: JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) throw new Error(`POST ${path} -> ${res.status}: ${text}`);
  return JSON.parse(text);
}

async function getSeller(handle) {
  const res = await fetch(`${BASE}/catalog/sellers/${handle}`);
  return res.ok ? res.json() : null;
}

for (const { seller, products } of STORES) {
  const existing = await getSeller(seller.handle);
  if (existing) {
    console.log(`• ${seller.handle} already exists, skipping`);
    continue;
  }
  const created = await post("/catalog/sellers", seller);
  for (const p of products) await post(`/catalog/sellers/${created.id}/products`, p);
  console.log(`✓ ${seller.name} (${seller.kind}) — ${products.length} products`);
}

const mk = await (await fetch(`${BASE}/catalog/marketplace`)).json();
console.log(`\nMarketplace now has ${mk.sellers.length} stores:`);
for (const s of mk.sellers) console.log(`  - ${s.name} [${s.kind}] ${s.productCount} products`);
