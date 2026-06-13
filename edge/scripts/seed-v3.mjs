// Comprehensive Meriplaza seed v3: popular brand stores (Traki with 200+
// products, Samsung, Farmatodo, Miyake, Santo Tomé) + the original stores,
// shared products with multi-store offers, discounts/featured promos, reviews,
// delivery cities + shipping methods, and home promotion banners.
//
//   node scripts/seed-v3.mjs [baseURL] [user:pass]

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BASE = process.argv[2] || "http://localhost:8799";
const AUTH = process.argv[3] || "";
const HERE = dirname(fileURLToPath(import.meta.url));
const headers = { "content-type": "application/json" };
if (AUTH) headers["authorization"] = "Basic " + Buffer.from(AUTH).toString("base64");

let IMAGES = {};
try { IMAGES = JSON.parse(await readFile(join(HERE, "images.json"), "utf8")); } catch {}
const img = (k) => (IMAGES[k] ? [IMAGES[k]] : []);
const logo = (domain) => `https://logo.clearbit.com/${domain}`;

const ALL_CITIES = ["caracas","maracaibo","valencia","barquisimeto","maracay","puerto-ordaz","merida","maturin"];
const ship = {
  local: [
    { provider: "Yummy Rides", eta: "30–60 min", fee: "Bs 60" },
    { provider: "Ridery", eta: "45 min", fee: "$2" },
    { provider: "Tango", eta: "1–2 h", fee: "Bs 50" },
    { provider: "Retiro en tienda", eta: "Hoy", fee: "Gratis" },
  ],
  national: [
    { provider: "MRW", eta: "1–3 días", fee: "según destino" },
    { provider: "Zoom", eta: "2–4 días", fee: "según destino" },
    { provider: "Retiro en tienda", eta: "Hoy", fee: "Gratis" },
  ],
};

// handle, name, kind, currency, theme, cities, shipping, logoDomain
const STORES = [
  { handle:"super-orinoco", name:"Supermercado Orinoco", kind:"supermarket", currency:"VES", taxId:"J-09512461-4",
    theme:{primaryColor:"#0a7d3b",accentColor:"#f5a623",tagline:"Lo mejor de Guayana al mejor precio",layout:"grid"}, cities:["puerto-ordaz","maturin"], shipping:ship.local },
  { handle:"santo-tome", name:"Central Santo Tomé", kind:"supermarket", currency:"VES", taxId:"J-09512461-4",
    theme:{primaryColor:"#c1121f",accentColor:"#ffd60a",tagline:"Tu hipermercado familiar",layout:"grid"}, cities:["puerto-ordaz","caracas"], shipping:ship.local },
  { handle:"farmatodo", name:"Farmatodo", kind:"store", currency:"VES", logo:"farmatodo.com.ve",
    theme:{primaryColor:"#0033a0",accentColor:"#e4002b",tagline:"Salud, belleza y más, 24 horas",layout:"grid"}, cities:ALL_CITIES, shipping:ship.local },
  { handle:"traki", name:"Traki", kind:"store", currency:"USD", logo:"traki.com.ve",
    theme:{primaryColor:"#e2001a",accentColor:"#ffcc00",tagline:"Todo lo que buscas, en un solo lugar",layout:"grid"}, cities:ALL_CITIES, shipping:ship.national },
  { handle:"samsung", name:"Samsung Store", kind:"store", currency:"USD", logo:"samsung.com",
    theme:{primaryColor:"#1428a0",accentColor:"#000000",tagline:"Innovación que inspira",layout:"featured"}, cities:["caracas","valencia","maracaibo"], shipping:ship.national },
  { handle:"miyake", name:"Miyake", kind:"store", currency:"USD",
    theme:{primaryColor:"#111111",accentColor:"#c8a96a",tagline:"Tecnología y hogar",layout:"grid"}, cities:["caracas","valencia"], shipping:ship.national },
  { handle:"tech-zone", name:"Tech Zone CCS", kind:"store", currency:"USD", taxId:"J-12345678-4",
    theme:{primaryColor:"#1f2937",accentColor:"#3b82f6",tagline:"Tecnología con garantía",layout:"grid"}, cities:["caracas"], shipping:ship.local },
  { handle:"artesania-maria", name:"Artesanías María", kind:"independent", currency:"USD",
    theme:{primaryColor:"#7b2ff7",accentColor:"#ff5ca8",tagline:"Hecho a mano en Mérida",layout:"featured"}, cities:["merida"], shipping:ship.national },
  { handle:"mascotas-felices", name:"Mascotas Felices", kind:"store", currency:"VES",
    theme:{primaryColor:"#ea580c",accentColor:"#16a34a",tagline:"Todo para tu mejor amigo",layout:"grid"}, cities:["caracas","maracay"], shipping:ship.local },
];

// Shared catalog products (sold by one or more stores). offer: [handle,price,stock,compareAt?,promo?,featured?]
const PRODUCTS = [
  { key:"corn_flour", title:"Harina de Maíz Precocida 1kg", category:"Alimentos", brand:"P.A.N.", desc:"Harina de maíz blanco precocida, ideal para arepas y empanadas.", specs:{Peso:"1 kg"}, offers:[["super-orinoco","45.00",120],["santo-tome","43.00",90],["farmatodo","48.00",40]] },
  { key:"ground_coffee", title:"Café Molido 500g", category:"Bebidas", brand:"Fama de América", desc:"Café 100% venezolano de tueste medio.", specs:{Peso:"500 g"}, offers:[["super-orinoco","210.00",60,"260.00","Oferta",1],["santo-tome","205.00",40]] },
  { key:"milk_powder", title:"Leche en Polvo 900g", category:"Alimentos", brand:"La Campiña", desc:"Leche entera en polvo fortificada.", specs:{Peso:"900 g"}, offers:[["super-orinoco","320.00",40],["santo-tome","315.00",35],["farmatodo","330.00",25]] },
  { key:"cooking_oil", title:"Aceite de Maíz 1L", category:"Alimentos", brand:"Mazeite", desc:"Aceite de maíz puro para cocinar y freír.", specs:{Volumen:"1 L"}, offers:[["super-orinoco","95.00",80],["santo-tome","92.00",60]] },
  { key:"white_rice", title:"Arroz Blanco 1kg", category:"Alimentos", brand:"Primor", desc:"Arroz de grano largo de excelente rendimiento.", specs:{Peso:"1 kg"}, offers:[["super-orinoco","38.00",100],["santo-tome","36.00",120]] },
  { key:"paracetamol", title:"Paracetamol 500mg x10", category:"Salud", brand:"Genven", desc:"Analgésico y antipirético.", specs:{Presentación:"10 tabletas"}, offers:[["farmatodo","12.00",200],["super-orinoco","14.00",50]] },
  { key:"vitamin_c", title:"Vitamina C 1000mg", category:"Salud", brand:"Vidamax", desc:"Refuerza las defensas. 30 tabletas efervescentes.", specs:{Presentación:"30 tabletas"}, offers:[["farmatodo","25.00",80,"32.00","-22%",1]] },
  { key:"soap_bar", title:"Jabón de Tocador", category:"Cuidado personal", brand:"Las Llaves", desc:"Jabón humectante con aroma fresco.", specs:{Peso:"120 g"}, offers:[["farmatodo","9.00",150],["super-orinoco","10.00",90]] },
  { key:"shampoo", title:"Shampoo 400ml", category:"Cuidado personal", brand:"Savital", desc:"Shampoo con sábila para cabello suave.", specs:{Volumen:"400 ml"}, offers:[["farmatodo","35.00",60],["super-orinoco","38.00",40]] },
  { key:"bluetooth_earbuds", title:"Audífonos Bluetooth", category:"Tecnología", brand:"Samsung", desc:"Audífonos TWS con cancelación de ruido, 24h de batería.", specs:{Bluetooth:"5.3"}, offers:[["samsung","42.00",30],["tech-zone","38.00",15],["miyake","40.00",18],["traki","44.00",25]] },
  { key:"usb_charger", title:"Cargador USB-C 65W", category:"Tecnología", brand:"Anker", desc:"Cargador GaN de 65W, carga rápida.", specs:{Potencia:"65 W"}, offers:[["tech-zone","22.00",35],["miyake","20.00",40,"28.00","Oferta",1],["traki","24.00",30]] },
  { key:"power_bank", title:"Power Bank 20000mAh", category:"Tecnología", brand:"Xiaomi", desc:"Batería externa con carga rápida 22.5W.", specs:{Capacidad:"20000 mAh"}, offers:[["tech-zone","30.00",6],["miyake","32.00",12],["traki","31.00",20]] },
  { key:"wireless_mouse", title:"Mouse Inalámbrico", category:"Tecnología", brand:"Logitech", desc:"Mouse silencioso y ergonómico.", specs:{Conexión:"2.4 GHz"}, offers:[["tech-zone","14.00",25],["traki","15.00",40]] },
  { key:"mechanical_keyboard", title:"Teclado Mecánico RGB", category:"Tecnología", brand:"Redragon", desc:"Teclado mecánico retroiluminado, switches azules.", specs:{Switches:"Azul"}, offers:[["miyake","55.00",10],["traki","58.00",14]] },
  { key:"hammock", title:"Hamaca Tejida a Mano", category:"Artesanía", brand:"Artesanal", desc:"Hamaca de algodón tejida a mano en Mérida.", specs:{Material:"Algodón"}, offers:[["artesania-maria","45.00",8]] },
  { key:"wicker_basket", title:"Cesta de Mimbre", category:"Hogar", brand:"Artesanal", desc:"Cesta de mimbre natural tejida a mano.", specs:{Material:"Mimbre"}, offers:[["artesania-maria","15.00",20],["traki","18.00",30]] },
  { key:"necklace", title:"Collar Artesanal", category:"Accesorios", brand:"Artesanal", desc:"Collar hecho a mano con piedras naturales.", specs:{}, offers:[["artesania-maria","12.00",30],["traki","16.00",25]] },
  { key:"tshirt", title:"Camiseta Básica de Algodón", category:"Moda", brand:"Urbano", desc:"Camiseta unisex de algodón peinado.", specs:{Material:"Algodón"}, offers:[["traki","12.00",80,"18.00","-33%",1]] },
  { key:"sneakers", title:"Zapatos Deportivos", category:"Moda", brand:"Runner", desc:"Zapatos deportivos livianos con suela acolchada.", specs:{Tipo:"Running"}, offers:[["traki","45.00",25]] },
  { key:"jeans", title:"Jeans Clásico", category:"Moda", brand:"Denim Co", desc:"Jeans de mezclilla corte recto.", specs:{Material:"Mezclilla"}, offers:[["traki","30.00",30]] },
  { key:"dog_food", title:"Alimento para Perros 3kg", category:"Mascotas", brand:"Dog Chow", desc:"Alimento balanceado para perros adultos.", specs:{Peso:"3 kg"}, offers:[["mascotas-felices","180.00",40],["super-orinoco","190.00",20]] },
  { key:"cat_toy", title:"Juguete para Gato", category:"Mascotas", brand:"PetFun", desc:"Juguete interactivo con plumas y cascabel.", specs:{}, offers:[["mascotas-felices","25.00",60]] },
];

const REVIEWS = {
  corn_flour:[{author:"María G.",rating:5,title:"Las mejores arepas",body:"Rinde muchísimo y queda perfecta."},{author:"José P.",rating:4,title:"Buena",body:"Cumple."}],
  ground_coffee:[{author:"Ana R.",rating:5,title:"Aroma increíble",body:"Café venezolano de verdad."},{author:"Carlos M.",rating:5,title:"Excelente",body:"Sabor espectacular."}],
  bluetooth_earbuds:[{author:"Luis F.",rating:4,title:"Muy buenos",body:"Batería dura bastante."},{author:"Daniela S.",rating:3,title:"Aceptables",body:"El micrófono es regular."}],
  sneakers:[{author:"Gabriela T.",rating:4,title:"Cómodos",body:"Livianos para todo el día."}],
};

// Generate ~200 Traki products to demonstrate a large catalog.
const TRAKI_LINES = {
  Moda: ["Camiseta","Franela","Pantalón","Jeans","Vestido","Falda","Chaqueta","Suéter","Short","Camisa","Blusa","Conjunto deportivo"],
  Hogar: ["Juego de sábanas","Toallas","Cortinas","Cojín decorativo","Olla","Sartén","Vajilla","Set de cubiertos","Lámpara","Organizador"],
  Tecnología: ["Audífonos","Parlante Bluetooth","Cable USB-C","Cargador","Smartwatch","Memoria USB","Webcam","Soporte para teléfono"],
  Accesorios: ["Gorra","Correa","Cartera","Mochila","Lentes de sol","Reloj","Billetera","Bufanda"],
  Mascotas: ["Cama para perro","Comedero","Collar para mascota","Juguete mordedor"],
};
const ADJ = ["Clásico","Premium","Deportivo","Casual","Edición Especial","Urbano","Slim","Confort","Eco","Pro"];
const imgByCat = { Moda: ["tshirt","jeans","sneakers"], Hogar:["wicker_basket"], Tecnología:["bluetooth_earbuds","usb_charger","wireless_mouse","mechanical_keyboard","power_bank"], Accesorios:["necklace"], Mascotas:["dog_food","cat_toy"] };
function trakiProducts(n) {
  const out = []; let i = 0;
  const cats = Object.keys(TRAKI_LINES);
  while (out.length < n) {
    const cat = cats[i % cats.length];
    const lines = TRAKI_LINES[cat];
    const base = lines[(i * 7) % lines.length];
    const adj = ADJ[(i * 3) % ADJ.length];
    const num = 100 + ((i * 17) % 900);
    const price = (5 + ((i * 13) % 120)).toFixed(2);
    const discounted = i % 5 === 0;
    const imgsKeys = imgByCat[cat] || [];
    const imgKey = imgsKeys.length ? imgsKeys[i % imgsKeys.length] : null;
    out.push({
      key: `traki_${i}`, title: `${base} ${adj} ${num}`, category: cat, brand: "Traki",
      desc: `${base} ${adj.toLowerCase()} disponible en Traki. Calidad y precio para toda la familia.`, specs: { SKU: `TRK-${num}` },
      images: imgKey ? img(imgKey) : [],
      offers: [["traki", price, 10 + (i % 40), discounted ? (parseFloat(price) * 1.3).toFixed(2) : "", discounted ? "Oferta" : "", i % 11 === 0 ? 1 : 0]],
    });
    i++;
  }
  return out;
}
const TRAKI_BULK = trakiProducts(200);

const PROMOS = [
  { kind:"holiday", title:"Especial Navidad 🎄", subtitle:"Hasta 40% en regalos seleccionados", href:"/?category=Tecnología", color:"blue", sort:1 },
  { kind:"deal", title:"Ofertas del día", subtitle:"Precios que bajan, no la calidad", href:"/?category=Alimentos", color:"yellow", sort:2 },
  { kind:"bundle", title:"Combos para tu hogar", subtitle:"Arma tu combo y ahorra más", href:"/?category=Hogar", color:"dark", sort:3 },
];

async function post(path, body) {
  const r = await fetch(BASE + path, { method:"POST", headers, body: JSON.stringify(body) });
  const t = await r.text(); if (!r.ok) throw new Error(`POST ${path} -> ${r.status}: ${t.slice(0,200)}`); return JSON.parse(t);
}
async function getJSON(path){ const r = await fetch(BASE+path); return r.ok ? r.json() : null; }

// 1) Stores (with cities + shipping)
const sellerByHandle = {};
for (const s of STORES) {
  const existing = await getJSON(`/catalog/sellers/${s.handle}`);
  let id;
  if (existing) { id = existing.seller.id; }
  else {
    const theme = { ...s.theme, ...(s.logo ? { logoUrl: logo(s.logo) } : {}) };
    const created = await post("/catalog/sellers", { handle:s.handle, name:s.name, kind:s.kind, currency:s.currency, taxId:s.taxId, theme, shipping:s.shipping, socials:{} });
    id = created.id;
  }
  sellerByHandle[s.handle] = id;
  await post(`/catalog/sellers/${id}/cities`, { cities: s.cities });
  console.log(`✓ ${s.name} (${s.cities.length} ciudades)`);
}

// 2) Products + offers + reviews
let nP = 0, nO = 0;
async function seedProduct(p) {
  const created = await post("/catalog/products", { title:p.title, category:p.category, brand:p.brand, description:p.desc, specs:p.specs, images:p.images ?? img(p.key), slug:p.key });
  nP++;
  for (const [handle, price, stock, compareAt, promo, featured] of p.offers) {
    const sellerId = sellerByHandle[handle]; if (!sellerId) continue;
    const store = STORES.find((s) => s.handle === handle);
    await post("/catalog/offers", { productId:created.id, sellerId, price, currency:store.currency, stock, compareAt: compareAt||"", promo: promo||"", featured: featured?1:0 });
    nO++;
  }
  for (const r of (REVIEWS[p.key] || [])) await post(`/catalog/products/${created.slug}/reviews`, r);
}
for (const p of PRODUCTS) await seedProduct(p);
for (const p of TRAKI_BULK) await seedProduct(p);

// 3) Promotions
for (const pr of PROMOS) await post("/catalog/promotions", pr);

console.log(`\nSeeded ${STORES.length} stores, ${nP} products, ${nO} offers, ${PROMOS.length} promos.`);
const mk = await getJSON("/catalog/marketplace");
console.log(`Marketplace: ${mk.sellers.length} stores, ${mk.cities.length} cities, ${mk.promotions.length} promos.`);
