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

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}

/** First meaningful word of a title, normalized for use as an image keyword. */
const DIACRITICS = /[̀-ͯ]/g;
function titleKeyword(title: string): string {
  const words = title.toLowerCase()
    .normalize("NFD").replace(DIACRITICS, "")
    .replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
  return words[0] || "";
}

/**
 * A deterministic, category-appropriate image URL for a product that lacks one.
 * `seed` should be a stable identifier (product id or slug).
 */
export function fallbackImage(title: string, category: string, seed: string): string {
  const kw = titleKeyword(title);
  const catKw = CATEGORY_KEYWORD[category] || "product";
  const keywords = kw ? `${encodeURIComponent(kw)},${catKw}` : catKw;
  const lock = (hash(seed || title) % 9000) + 1000;
  return `https://loremflickr.com/400/400/${keywords}?lock=${lock}`;
}

/** Resolve a product's display image: its own first image, else a fallback. */
export function resolveImage(own: string | null | undefined, title: string, category: string, seed: string): string {
  if (own && /^https?:\/\//.test(own)) return own;
  return fallbackImage(title, category, seed);
}
