// Seed Meriplaza catalog v2: many stores, a shared product catalog where several
// stores sell the same product (multiple offers), and reviews. Real product
// images are read from scripts/images.json ({ key: url }) when present.
//
//   node scripts/seed-v2.mjs [baseURL] [user:pass]
//
// Idempotent-ish: skips a seller whose handle already exists; products/offers
// are upserted by the API.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BASE = process.argv[2] || "http://localhost:8799";
const AUTH = process.argv[3] || "";
const HERE = dirname(fileURLToPath(import.meta.url));
const headers = { "content-type": "application/json" };
if (AUTH) headers["authorization"] = "Basic " + Buffer.from(AUTH).toString("base64");

let IMAGES = {};
try { IMAGES = JSON.parse(await readFile(join(HERE, "images.json"), "utf8")); } catch { console.log("(no images.json yet — products will use icon placeholders)"); }
const img = (key) => (IMAGES[key] ? [IMAGES[key]] : []);

const STORES = [
  { handle: "super-orinoco", name: "Supermercado Orinoco", kind: "supermarket", taxId: "J-09512461-4", currency: "VES",
    theme: { primaryColor: "#0a7d3b", accentColor: "#f5a623", tagline: "Lo mejor de Guayana al mejor precio", layout: "grid" }, socials: { whatsapp: "584140000001", instagram: "superorinoco" } },
  { handle: "mercado-bolivar", name: "Mercado Bolívar", kind: "supermarket", currency: "VES",
    theme: { primaryColor: "#b8232f", accentColor: "#ffb703", tagline: "Tu mercado de confianza", layout: "grid" }, socials: { whatsapp: "584140000010" } },
  { handle: "farmacia-vida", name: "Farmacia Vida", kind: "store", taxId: "J-31118822-3", currency: "VES",
    theme: { primaryColor: "#0d8a8a", accentColor: "#00b4d8", tagline: "Salud y bienestar para tu familia", layout: "grid" }, socials: { whatsapp: "584140000020", instagram: "farmaciavida" } },
  { handle: "tech-zone", name: "Tech Zone CCS", kind: "store", taxId: "J-12345678-4", currency: "USD",
    theme: { primaryColor: "#1f2937", accentColor: "#3b82f6", tagline: "Tecnología con garantía", layout: "grid" }, socials: { facebook: "techzoneccs" } },
  { handle: "mega-tech", name: "MegaTech Valencia", kind: "store", currency: "USD",
    theme: { primaryColor: "#4338ca", accentColor: "#22d3ee", tagline: "Más tecnología, mejor precio", layout: "grid" }, socials: { instagram: "megatechve" } },
  { handle: "artesania-maria", name: "Artesanías María", kind: "independent", currency: "USD",
    theme: { primaryColor: "#7b2ff7", accentColor: "#ff5ca8", tagline: "Hecho a mano en Mérida", layout: "featured" }, socials: { instagram: "artesaniasmaria", whatsapp: "584140000002" } },
  { handle: "moda-caracas", name: "Moda Caracas", kind: "store", currency: "USD",
    theme: { primaryColor: "#111111", accentColor: "#e11d48", tagline: "Tendencias que inspiran", layout: "featured" }, socials: { instagram: "modacaracas" } },
  { handle: "mascotas-felices", name: "Mascotas Felices", kind: "store", currency: "VES",
    theme: { primaryColor: "#ea580c", accentColor: "#16a34a", tagline: "Todo para tu mejor amigo", layout: "grid" }, socials: { instagram: "mascotasfelices" } },
];

// Canonical products + the offers (which stores sell them, price, stock).
const PRODUCTS = [
  { key: "corn_flour", title: "Harina de Maíz Precocida 1kg", category: "Alimentos", brand: "P.A.N.", desc: "Harina de maíz blanco precocida, ideal para arepas, empanadas y hallacas. El sabor de la mesa venezolana.", specs: { Peso: "1 kg", Tipo: "Maíz blanco" }, offers: [["super-orinoco","45.00",120],["mercado-bolivar","43.00",90],["farmacia-vida","48.00",30]] },
  { key: "ground_coffee", title: "Café Molido 500g", category: "Bebidas", brand: "Fama de América", desc: "Café 100% venezolano de tueste medio, molido fino. Aroma intenso y cuerpo equilibrado.", specs: { Peso: "500 g", Tueste: "Medio" }, offers: [["super-orinoco","210.00",60],["mercado-bolivar","205.00",40]] },
  { key: "milk_powder", title: "Leche en Polvo 900g", category: "Alimentos", brand: "La Campiña", desc: "Leche entera en polvo fortificada con vitaminas A y D. Rinde hasta 7 litros.", specs: { Peso: "900 g" }, offers: [["super-orinoco","320.00",40],["mercado-bolivar","315.00",35]] },
  { key: "bread_baguette", title: "Pan Canilla", category: "Alimentos", brand: "Panadería", desc: "Pan canilla recién horneado, corteza crujiente y miga suave.", specs: { Unidad: "1 pieza" }, offers: [["super-orinoco","18.00",200],["mercado-bolivar","17.00",150]] },
  { key: "cooking_oil", title: "Aceite de Maíz 1L", category: "Alimentos", brand: "Mazeite", desc: "Aceite de maíz puro, ligero y saludable para cocinar y freír.", specs: { Volumen: "1 L" }, offers: [["super-orinoco","95.00",80],["farmacia-vida","99.00",25]] },
  { key: "white_rice", title: "Arroz Blanco 1kg", category: "Alimentos", brand: "Primor", desc: "Arroz blanco de grano largo, suelto y de excelente rendimiento.", specs: { Peso: "1 kg" }, offers: [["super-orinoco","38.00",100],["mercado-bolivar","36.00",120]] },
  { key: "paracetamol", title: "Paracetamol 500mg x10", category: "Salud", brand: "Genven", desc: "Analgésico y antipirético para el alivio del dolor leve a moderado y la fiebre.", specs: { Presentación: "10 tabletas", Dosis: "500 mg" }, offers: [["farmacia-vida","12.00",200],["super-orinoco","14.00",50]] },
  { key: "vitamin_c", title: "Vitamina C 1000mg", category: "Salud", brand: "Vidamax", desc: "Suplemento de vitamina C para reforzar las defensas. 30 tabletas efervescentes.", specs: { Presentación: "30 tabletas" }, offers: [["farmacia-vida","25.00",80]] },
  { key: "soap_bar", title: "Jabón de Tocador", category: "Cuidado personal", brand: "Las Llaves", desc: "Jabón en barra humectante con aroma fresco y duradero.", specs: { Peso: "120 g" }, offers: [["farmacia-vida","9.00",150],["super-orinoco","10.00",90]] },
  { key: "shampoo", title: "Shampoo 400ml", category: "Cuidado personal", brand: "Savital", desc: "Shampoo con sábila para un cabello suave, brillante y manejable.", specs: { Volumen: "400 ml" }, offers: [["farmacia-vida","35.00",60],["super-orinoco","38.00",40]] },
  { key: "bluetooth_earbuds", title: "Audífonos Bluetooth", category: "Tecnología", brand: "SoundCore", desc: "Audífonos inalámbricos TWS con cancelación de ruido, hasta 24h de batería con el estuche.", specs: { Bluetooth: "5.3", Batería: "24 h" }, offers: [["tech-zone","38.00",15],["mega-tech","35.00",22]] },
  { key: "usb_charger", title: "Cargador USB-C 65W", category: "Tecnología", brand: "Anker", desc: "Cargador GaN compacto de 65W, carga rápida para laptop, tablet y teléfono.", specs: { Potencia: "65 W", Puertos: "USB-C" }, offers: [["tech-zone","22.00",35],["mega-tech","20.00",40]] },
  { key: "power_bank", title: "Power Bank 20000mAh", category: "Tecnología", brand: "Xiaomi", desc: "Batería externa de 20.000mAh con carga rápida de 22.5W y doble salida.", specs: { Capacidad: "20000 mAh" }, offers: [["tech-zone","30.00",0],["mega-tech","32.00",12]] },
  { key: "wireless_mouse", title: "Mouse Inalámbrico", category: "Tecnología", brand: "Logitech", desc: "Mouse inalámbrico silencioso y ergonómico con receptor USB de 2.4GHz.", specs: { Conexión: "2.4 GHz" }, offers: [["tech-zone","14.00",25],["mega-tech","13.00",30]] },
  { key: "mechanical_keyboard", title: "Teclado Mecánico RGB", category: "Tecnología", brand: "Redragon", desc: "Teclado mecánico retroiluminado RGB con switches azules, ideal para gaming.", specs: { Switches: "Azul", Layout: "Español" }, offers: [["mega-tech","55.00",10]] },
  { key: "hammock", title: "Hamaca Tejida a Mano", category: "Artesanía", brand: "Artesanal", desc: "Hamaca de algodón 100% tejida a mano por artesanos merideños. Resistente y fresca.", specs: { Material: "Algodón" }, offers: [["artesania-maria","45.00",8]] },
  { key: "wicker_basket", title: "Cesta de Mimbre", category: "Hogar", brand: "Artesanal", desc: "Cesta de mimbre natural tejida a mano, perfecta para organizar y decorar.", specs: { Material: "Mimbre" }, offers: [["artesania-maria","15.00",20]] },
  { key: "necklace", title: "Collar Artesanal", category: "Accesorios", brand: "Artesanal", desc: "Collar hecho a mano con cuentas de colores y piedras naturales. Pieza única.", specs: { Material: "Cuentas y piedra" }, offers: [["artesania-maria","12.00",30],["moda-caracas","18.00",15]] },
  { key: "tshirt", title: "Camiseta Básica de Algodón", category: "Moda", brand: "Urbano", desc: "Camiseta unisex de algodón peinado, corte regular. Suave y duradera.", specs: { Material: "Algodón" }, offers: [["moda-caracas","12.00",50]] },
  { key: "sneakers", title: "Zapatos Deportivos", category: "Moda", brand: "Runner", desc: "Zapatos deportivos livianos con suela acolchada para uso diario y entrenamiento.", specs: { Tipo: "Running" }, offers: [["moda-caracas","45.00",25]] },
  { key: "jeans", title: "Jeans Clásico", category: "Moda", brand: "Denim Co", desc: "Jeans de mezclilla corte recto, cómodo y versátil para cualquier ocasión.", specs: { Material: "Mezclilla" }, offers: [["moda-caracas","30.00",30]] },
  { key: "dog_food", title: "Alimento para Perros 3kg", category: "Mascotas", brand: "Dog Chow", desc: "Alimento balanceado para perros adultos con pollo. Nutrición completa.", specs: { Peso: "3 kg" }, offers: [["mascotas-felices","180.00",40],["super-orinoco","190.00",20]] },
  { key: "cat_toy", title: "Juguete para Gato", category: "Mascotas", brand: "PetFun", desc: "Juguete interactivo con plumas y cascabel para horas de diversión felina.", specs: {}, offers: [["mascotas-felices","25.00",60]] },
];

const REVIEWS = {
  corn_flour: [{ author: "María G.", rating: 5, title: "Las mejores arepas", body: "Siempre compro esta harina, rinde muchísimo y queda perfecta." }, { author: "José P.", rating: 4, title: "Buena calidad", body: "Cumple, aunque el precio ha subido." }],
  ground_coffee: [{ author: "Ana R.", rating: 5, title: "Aroma increíble", body: "Café venezolano de verdad. Lo recomiendo." }, { author: "Carlos M.", rating: 5, title: "Excelente", body: "Cuerpo y sabor espectacular." }],
  bluetooth_earbuds: [{ author: "Luis F.", rating: 4, title: "Muy buenos", body: "Suenan bien y la batería dura bastante. La cancelación de ruido es decente." }, { author: "Daniela S.", rating: 3, title: "Aceptables", body: "Buenos por el precio pero el micrófono es regular." }],
  hammock: [{ author: "Pedro L.", rating: 5, title: "Hermosa y resistente", body: "Calidad artesanal real. Vale cada centavo." }],
  sneakers: [{ author: "Gabriela T.", rating: 4, title: "Cómodos", body: "Livianos y cómodos para caminar todo el día." }],
};

async function post(path, body) {
  const res = await fetch(BASE + path, { method: "POST", headers, body: JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) throw new Error(`POST ${path} -> ${res.status}: ${text}`);
  return JSON.parse(text);
}
async function getJSON(path) { const r = await fetch(BASE + path); return r.ok ? r.json() : null; }

// 1) Stores
const sellerByHandle = {};
for (const s of STORES) {
  const existing = await getJSON(`/catalog/sellers/${s.handle}`);
  if (existing) { sellerByHandle[s.handle] = existing.seller.id; console.log(`• ${s.handle} exists`); continue; }
  const created = await post("/catalog/sellers", s);
  sellerByHandle[s.handle] = created.id;
  console.log(`✓ store ${s.name}`);
}

// 2) Products + offers + reviews
let nProducts = 0, nOffers = 0, nReviews = 0;
for (const p of PRODUCTS) {
  const created = await post("/catalog/products", {
    title: p.title, category: p.category, brand: p.brand, description: p.desc, specs: p.specs, images: img(p.key), slug: p.key,
  });
  nProducts++;
  for (const [handle, price, stock] of p.offers) {
    const sellerId = sellerByHandle[handle];
    if (!sellerId) continue;
    const store = STORES.find((s) => s.handle === handle);
    await post("/catalog/offers", { productId: created.id, sellerId, price, currency: store.currency, taxRate: p.category === "Alimentos" || p.category === "Salud" ? "16.00" : "16.00", stock });
    nOffers++;
  }
  for (const r of (REVIEWS[p.key] || [])) { await post(`/catalog/products/${created.slug}/reviews`, r); nReviews++; }
}

console.log(`\nSeeded ${STORES.length} stores, ${nProducts} products, ${nOffers} offers, ${nReviews} reviews.`);
const mk = await getJSON("/catalog/marketplace");
console.log(`Marketplace: ${mk.sellers.length} stores, categories: ${(mk.categories || []).map((c) => c.name).join(", ")}`);
