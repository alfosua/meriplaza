// Product imagery helper. Much of the bulk-generated catalog ships without
// photos, and several products reused the same placeholder. To get varied,
// product-appropriate images without re-seeding, we derive a deterministic
// keyword-based photo from the product's title + category and fetch it from
// LoremFlickr (keyword image CDN, no API key). The `lock` seed keeps a given
// product showing the same picture across renders.

const STOPWORDS = new Set([
  "de", "la", "el", "los", "las", "para", "con", "sin", "y", "o", "en", "un", "una",
  "premium", "set", "kit", "x", "und", "ml", "lt", "kg", "gr", "pack", "familiar", "caja",
]);

const CATEGORY_KEYWORD: Record<string, string> = {
  Alimentos: "food,grocery",
  Bebidas: "drink,beverage",
  Salud: "pharmacy,health",
  "Cuidado personal": "cosmetics,beauty",
  Tecnología: "electronics,gadget",
  Hogar: "home,household",
  Artesanía: "handmade,craft",
  Accesorios: "accessory",
  Moda: "fashion,clothing",
  Mascotas: "pet,petfood",
};

// Spanish item word → English image keyword(s), so the derived photo actually
// matches the product (LoremFlickr indexes English tags). Falls back to the
// product's own first word when no mapping exists.
const ITEM_KEYWORD: Record<string, string> = {
  harina: "flour", arroz: "rice", pasta: "pasta", caraotas: "beans", lentejas: "lentils",
  azucar: "sugar", sal: "salt", aceite: "oil,bottle", atun: "tuna,can", sardinas: "sardines",
  mayonesa: "mayonnaise", salsa: "sauce", avena: "oatmeal", galletas: "cookies,crackers",
  pan: "bread", queso: "cheese", mortadela: "deli,meat", jamon: "ham", mantequilla: "butter",
  margarina: "butter", cereal: "cereal", granola: "granola", maicena: "cornstarch",
  mermelada: "jam", miel: "honey", cafe: "coffee", leche: "milk", yogurt: "yogurt", huevos: "eggs",
  diablitos: "pate,canned", ketchup: "ketchup", mostaza: "mustard",
  refresco: "soda,bottle", agua: "water,bottle", jugo: "juice", malta: "beer,bottle",
  cerveza: "beer", vino: "wine", nectar: "juice", energizante: "energydrink", chocolate: "cocoa",
  acetaminofen: "pills,medicine", ibuprofeno: "pills,medicine", loratadina: "pills",
  suero: "saline,medical", alcohol: "antiseptic", gasas: "gauze", curitas: "bandage",
  termometro: "thermometer", multivitaminico: "vitamins", vitamina: "vitamins", omega: "fishoil",
  antiacido: "antacid", protector: "sunscreen", gel: "sanitizer", mascarillas: "facemask",
  repelente: "spray", algodon: "cotton",
  jabon: "soap", shampoo: "shampoo", acondicionador: "conditioner", crema: "cream",
  cepillo: "toothbrush", desodorante: "deodorant", papel: "tissue,toiletpaper",
  toallas: "towels", panales: "diapers", afeitadora: "razor", enjuague: "mouthwash",
  hisopos: "cottonswab", talco: "powder",
  detergente: "detergent", suavizante: "softener", cloro: "bleach", lavaplatos: "dishsoap",
  desinfectante: "disinfectant", limpiavidrios: "cleaner", bolsas: "garbagebag",
  servilletas: "napkins", esponjas: "sponge", ambientador: "airfreshener",
  insecticida: "insecticide", fosforos: "matches", velas: "candles", film: "plasticwrap",
  alimento: "petfood", arena: "catlitter", snacks: "petsnacks", collar: "petcollar",
  premios: "dogtreats", comida: "petfood", juguete: "pettoy", comedero: "petbowl",
};

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}

/** Meaningful words of a title, normalized for image keywords. */
const DIACRITICS = /[̀-ͯ]/g;
function titleWords(title: string): string[] {
  return title.toLowerCase()
    .normalize("NFD").replace(DIACRITICS, "")
    .replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/**
 * A deterministic, category-appropriate image URL for a product that lacks one.
 * `seed` should be a stable identifier (product id or slug). We map the item's
 * first Spanish word to an English image keyword for accuracy, optionally add a
 * second descriptive word, and a per-product lock so each product keeps a
 * distinct, stable picture (more visual variety across the catalog).
 */
export function fallbackImage(title: string, category: string, seed: string): string {
  const words = titleWords(title);
  const first = words[0] || "";
  const mapped = ITEM_KEYWORD[first];
  const catKw = CATEGORY_KEYWORD[category] || "product";
  let keywords: string;
  if (mapped) keywords = `${mapped},${catKw.split(",")[0]}`;
  else if (first) keywords = `${encodeURIComponent(first)},${catKw}`;
  else keywords = catKw;
  const lock = (hash(seed || title) % 90000) + 1000;
  return `https://loremflickr.com/400/400/${keywords}?lock=${lock}`;
}

/** Resolve a product's display image: its own first image, else a fallback. */
export function resolveImage(own: string | null | undefined, title: string, category: string, seed: string): string {
  if (own && /^https?:\/\//.test(own)) return own;
  return fallbackImage(title, category, seed);
}
