// Catalog routes (v2): canonical products + per-seller offers + reviews.
// Multiple stores can sell the same product; the marketplace aggregates offers
// (lowest price, store count) and the product page lists every store's offer.
//
// Backed by D1; KV caches the marketplace landing.

import { Hono } from "hono";
import type { Env } from "../lib/env.ts";
import { newID, nowISO, distanceKm } from "../lib/env.ts";
import { resolveImage } from "../ssr/images.ts";
import * as ident from "../lib/ident.ts";
import { priceOrder, type ProductLike, type CartItem } from "../lib/pricing.ts";
import { confirm, isKnownMethod, type Method } from "../payments/processors.ts";
import { currentUser } from "../auth/session.ts";

export const catalog = new Hono<{ Bindings: Env }>();

const json = (v: unknown) => JSON.stringify(v);
const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);

// ---------- marketplace landing ----------

export async function marketplaceData(env: Env): Promise<{ sellers: any[]; categories: any[]; cities: any[]; promotions: any[] }> {
  const sellers = await env.DB.prepare(
    `SELECT s.doc AS doc,
       (SELECT COUNT(*) FROM offers o WHERE o.seller_id = s.id AND o.active = 1) AS offer_count
     FROM sellers s ORDER BY s.created_at`,
  ).all<{ doc: string; offer_count: number }>();
  const cats = await env.DB.prepare(`SELECT slug, name, icon FROM categories ORDER BY sort, name`).all();
  const cities = await env.DB.prepare(`SELECT slug, name, state, lat, lng FROM cities ORDER BY sort, name`).all();
  const promos = await env.DB.prepare(`SELECT id, kind, title, subtitle, href, color FROM promotions WHERE active=1 ORDER BY sort`).all();
  return {
    sellers: (sellers.results ?? []).map((r) => {
      const s = JSON.parse(r.doc);
      return { id: s.id, handle: s.handle, name: s.name, kind: s.kind, theme: s.theme, socials: s.socials, currency: s.currency, productCount: r.offer_count };
    }),
    categories: cats.results ?? [],
    cities: cities.results ?? [],
    promotions: promos.results ?? [],
  };
}

catalog.get("/marketplace", async (c) => {
  const cached = await c.env.CACHE.get("marketplace");
  if (cached) return new Response(cached, { headers: { "content-type": "application/json", "x-cache": "HIT" } });
  const payload = json(await marketplaceData(c.env));
  await c.env.CACHE.put("marketplace", payload, { expirationTtl: 60 });
  return new Response(payload, { headers: { "content-type": "application/json", "x-cache": "MISS" } });
});

// ---------- supermarket mode (proximity + price comparison) ----------

const GROCERY_CATEGORIES = ["Alimentos", "Bebidas", "Salud", "Cuidado personal", "Hogar", "Mascotas"];
const CARACAS = { lat: 10.4806, lng: -66.9036 };

export interface SupermarketOpts {
  lat?: number; lng?: number; cityName?: string;
  stores?: string[]; q?: string; category?: string; limit?: number; offset?: number;
  sort?: string; certified?: boolean; instant?: boolean; inStock?: boolean;
}

// How many of the nearest stores feed the price comparison when the shopper
// hasn't hand-picked any. Bounds the offers IN(...) clause so the query stays
// fast and within SQLite's bound-variable limit even with thousands of stores.
const NEARBY_COMPARE = 12;
// How many store chips to render in the picker (closest first).
const MAX_STORE_CHIPS = 60;

/**
 * Supermarket view: rank stores by how close their delivery coverage is to the
 * customer's home point, then list grocery products with a price comparison
 * across the selected (or all nearby) stores.
 */
export async function supermarketData(env: Env, opts: SupermarketOpts = {}) {
  const cityRows = await env.DB.prepare(`SELECT slug, name, state, lat, lng FROM cities`).all<any>();
  const cities = cityRows.results ?? [];

  let lat = Number.isFinite(opts.lat as number) ? (opts.lat as number) : undefined;
  let lng = Number.isFinite(opts.lng as number) ? (opts.lng as number) : undefined;
  if ((lat == null || lng == null) && opts.cityName) {
    const ct = cities.find((c) => c.name === opts.cityName);
    if (ct && ct.lat) { lat = ct.lat; lng = ct.lng; }
  }
  if (lat == null || lng == null) { lat = CARACAS.lat; lng = CARACAS.lng; }

  // Rank every store by distance. A store with its own geo point (lat/lng set)
  // is ranked from that exact branch location; otherwise we fall back to the
  // nearest covered-city centroid. This lets thousands of branches in one city
  // spread out instead of collapsing onto the city center.
  const sellerRows = await env.DB.prepare(`SELECT id, doc, lat, lng FROM sellers`).all<any>();
  const cov = await env.DB.prepare(
    `SELECT sc.seller_id AS seller_id, c.name AS city, c.lat AS lat, c.lng AS lng
       FROM store_cities sc JOIN cities c ON c.slug = sc.city_slug WHERE c.lat <> 0`,
  ).all<any>();
  const coverage = new Map<string, any[]>();
  for (const r of cov.results ?? []) {
    if (!coverage.has(r.seller_id)) coverage.set(r.seller_id, []);
    coverage.get(r.seller_id)!.push(r);
  }
  const distById = new Map<string, number>();
  const ranked = (sellerRows.results ?? []).map((r) => {
    const doc = safeJson<any>(r.doc, {});
    let dist = Infinity, nearest: string | null = null;
    if (r.lat && r.lng) {
      dist = distanceKm(lat!, lng!, r.lat, r.lng);
      // Label with the covered city closest to the branch, for context.
      let cityDist = Infinity;
      for (const c of coverage.get(r.id) ?? []) {
        const d = distanceKm(r.lat, r.lng, c.lat, c.lng);
        if (d < cityDist) { cityDist = d; nearest = c.city; }
      }
    } else {
      for (const c of coverage.get(r.id) ?? []) {
        const d = distanceKm(lat!, lng!, c.lat, c.lng);
        if (d < dist) { dist = d; nearest = c.city; }
      }
    }
    if (Number.isFinite(dist)) distById.set(r.id, Math.round(dist));
    return {
      id: r.id, handle: doc.handle, name: doc.name, kind: doc.kind,
      currency: doc.currency || "VES", theme: doc.theme || {},
      certified: !!doc.certified, instant: !!doc.instant,
      nearestCity: nearest, distanceKm: Number.isFinite(dist) ? Math.round(dist) : null,
    };
  }).filter((s) => s.distanceKm != null).sort((a, b) => (a.distanceKm! - b.distanceKm!));

  const totalStores = ranked.length;
  // Store-level filters (apply before picking chips / comparison stores).
  let pool = ranked;
  if (opts.certified) pool = pool.filter((s) => s.certified);
  if (opts.instant) pool = pool.filter((s) => s.instant);
  // Only the closest stores get rendered as chips (the UI can't show thousands).
  const stores = pool.slice(0, MAX_STORE_CHIPS);

  // Which sellers' offers feed the product comparison. With no hand-picked
  // stores, compare across the nearest few (after filters) so it stays bounded.
  const selectedHandles = (opts.stores ?? []).filter(Boolean);
  const sellersForProducts = selectedHandles.length
    ? pool.filter((s) => selectedHandles.includes(s.handle))
    : pool.slice(0, NEARBY_COMPARE);
  const sellerIds = sellersForProducts.map((s) => s.id);
  if (!sellerIds.length) return { home: { lat, lng, cityName: opts.cityName || "" }, stores, totalStores, products: [], total: 0, categories: GROCERY_CATEGORIES };

  const cats = opts.category && GROCERY_CATEGORIES.includes(opts.category) ? [opts.category] : GROCERY_CATEGORIES;
  const catPh = cats.map(() => "?").join(",");
  const selPh = sellerIds.map(() => "?").join(",");
  let qClause = "";
  const qBinds: unknown[] = [];
  if (opts.q) { qClause = " AND (lower(p.title) LIKE ? OR lower(p.brand) LIKE ?)"; const t = `%${opts.q.toLowerCase()}%`; qBinds.push(t, t); }

  // Step 1: page the distinct grocery products that have an offer in the chosen
  // stores (ordered by title), plus a total count for pagination. This bounds
  // how many products we materialize regardless of catalog size.
  const limit = Math.min(opts.limit ?? 60, 120);
  const offset = Math.max(0, opts.offset ?? 0);
  const stockCond = opts.inStock ? " AND o.stock > 0" : "";
  const baseWhere = `WHERE p.category IN (${catPh})${qClause} AND EXISTS (
      SELECT 1 FROM offers o WHERE o.product_id = p.id AND o.active = 1 AND o.seller_id IN (${selPh})${stockCond})`;
  const filterBinds = [...cats, ...qBinds, ...sellerIds];
  const totalRow = await env.DB.prepare(`SELECT COUNT(*) AS n FROM products p ${baseWhere}`).bind(...filterBinds).first<{ n: number }>();
  const total = totalRow?.n ?? 0;

  // Sort across the whole filtered set (not just the page). price/savings need
  // a min/max over the chosen stores' offers, computed as SELECT subqueries —
  // their binds precede the WHERE binds since they appear earlier in the SQL.
  const sort = opts.sort || "";
  const minExpr = `(SELECT MIN(CAST(o.price AS REAL)) FROM offers o WHERE o.product_id=p.id AND o.active=1 AND o.seller_id IN (${selPh})${stockCond})`;
  const maxExpr = `(SELECT MAX(CAST(o.price AS REAL)) FROM offers o WHERE o.product_id=p.id AND o.active=1 AND o.seller_id IN (${selPh})${stockCond})`;
  let selExtra = "", orderSql = "p.title";
  const orderBinds: unknown[] = [];
  if (sort === "price_asc" || sort === "price_desc") {
    selExtra = `, ${minExpr} AS minp`; orderBinds.push(...sellerIds);
    orderSql = sort === "price_asc" ? "minp ASC" : "minp DESC";
  } else if (sort === "savings") {
    selExtra = `, ${minExpr} AS minp, ${maxExpr} AS maxp`; orderBinds.push(...sellerIds, ...sellerIds);
    orderSql = "(maxp - minp) DESC";
  } else if (sort === "rating") {
    orderSql = "p.rating_avg DESC, p.rating_count DESC";
  }
  const pageIds = await env.DB.prepare(
    `SELECT p.id${selExtra} FROM products p ${baseWhere} ORDER BY ${orderSql} LIMIT ? OFFSET ?`,
  ).bind(...orderBinds, ...filterBinds, limit, offset).all<{ id: string }>();
  const ids = (pageIds.results ?? []).map((r) => r.id);
  if (!ids.length) return { home: { lat, lng, cityName: opts.cityName || "" }, stores, totalStores, products: [], total, categories: GROCERY_CATEGORIES };

  // Step 2: every chosen-store offer for just this page of products.
  const idPh = ids.map(() => "?").join(",");
  const rows = await env.DB.prepare(
    `SELECT p.id, p.slug, p.title, p.category, p.brand, p.images, p.rating_avg, p.rating_count,
            o.id AS offer_id, o.price, o.currency, o.stock, o.compare_at,
            o.seller_id, json_extract(s.doc,'$.name') AS seller_name, s.handle AS seller_handle
       FROM offers o
       JOIN products p ON p.id = o.product_id
       JOIN sellers s ON s.id = o.seller_id
      WHERE o.active = 1 AND p.id IN (${idPh}) AND o.seller_id IN (${selPh})${stockCond}
      ORDER BY CAST(o.price AS REAL)`,
  ).bind(...ids, ...sellerIds).all<any>();

  const products = new Map<string, any>();
  for (const r of rows.results ?? []) {
    let p = products.get(r.id);
    if (!p) {
      p = {
        id: r.id, slug: r.slug, title: r.title, category: r.category, brand: r.brand,
        image: resolveImage(firstImage(r.images), r.title, r.category, r.slug),
        rating: r.rating_avg, ratingCount: r.rating_count, offers: [],
      };
      products.set(r.id, p);
    }
    p.offers.push({
      offerId: r.offer_id, sellerId: r.seller_id, sellerHandle: r.seller_handle,
      sellerName: r.seller_name, price: r.price, currency: r.currency, stock: r.stock,
      distanceKm: distById.get(r.seller_id) ?? null,
    });
  }
  // Preserve the sorted page order from step 1.
  const list = ids.map((id) => products.get(id)).filter(Boolean).map((p) => {
    const prices = p.offers.map((o: any) => parseFloat(o.price)).filter((n: number) => Number.isFinite(n));
    const min = Math.min(...prices), max = Math.max(...prices);
    const best = p.offers.find((o: any) => parseFloat(o.price) === min) || p.offers[0];
    return {
      ...p,
      bestOffer: best,
      minPrice: Number.isFinite(min) ? min.toFixed(2) : null,
      maxPrice: Number.isFinite(max) ? max.toFixed(2) : null,
      currency: best?.currency || "VES",
      storeCount: p.offers.length,
      savingsPct: max > min && max > 0 ? Math.round(((max - min) / max) * 100) : 0,
    };
  });

  return { home: { lat, lng, cityName: opts.cityName || "" }, stores, totalStores, products: list, total, categories: GROCERY_CATEGORIES };
}

catalog.get("/supermarket", async (c) => {
  const lat = parseFloat(c.req.query("lat") || ""), lng = parseFloat(c.req.query("lng") || "");
  const stores = (c.req.query("stores") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const limit = Math.min(Math.max(1, parseInt(c.req.query("limit") || "60", 10) || 60), 120);
  const page = Math.max(1, parseInt(c.req.query("page") || "1", 10) || 1);
  const data = await supermarketData(c.env, {
    lat: Number.isFinite(lat) ? lat : undefined, lng: Number.isFinite(lng) ? lng : undefined,
    cityName: c.req.query("city") || "", stores, q: c.req.query("q") || "", category: c.req.query("category") || "",
    sort: c.req.query("sort") || "", certified: c.req.query("certified") === "1",
    instant: c.req.query("instant") === "1", inStock: c.req.query("instock") === "1",
    limit, offset: (page - 1) * limit,
  });
  return c.json({ ...data, page, limit, pages: Math.ceil((data.total ?? 0) / limit) });
});

// ---------- product listing / search ----------

export interface ListOpts { q?: string; category?: string; store?: string; city?: string; sort?: string; featured?: boolean; limit?: number; offset?: number }

// Build the shared WHERE clause + binds for both listing and counting, so the
// product count shown in pagination always matches the filtered result set.
function productFilter(opts: ListOpts): { whereSql: string; binds: unknown[] } {
  const where: string[] = [];
  const binds: unknown[] = [];
  if (opts.category) { where.push("p.category = ?"); binds.push(opts.category); }
  if (opts.q) { where.push("(lower(p.title) LIKE ? OR lower(p.brand) LIKE ? OR lower(p.description) LIKE ?)"); const q = `%${opts.q.toLowerCase()}%`; binds.push(q, q, q); }
  // Availability filters operate on the product's active offers.
  if (opts.store) { where.push(`EXISTS (SELECT 1 FROM offers o JOIN sellers s ON s.id=o.seller_id WHERE o.product_id=p.id AND o.active=1 AND s.handle=?)`); binds.push(opts.store); }
  if (opts.city) { where.push(`EXISTS (SELECT 1 FROM offers o JOIN store_cities sc ON sc.seller_id=o.seller_id WHERE o.product_id=p.id AND o.active=1 AND sc.city_slug=?)`); binds.push(opts.city); }
  if (opts.featured) where.push(`EXISTS (SELECT 1 FROM offers o WHERE o.product_id=p.id AND o.active=1 AND o.featured=1)`);
  return { whereSql: where.length ? `WHERE ${where.join(" AND ")}` : "", binds };
}

// Total number of products matching the filters (for pagination). Cheap: counts
// rows in `products` with EXISTS subqueries, no per-offer aggregates.
export async function countProducts(env: Env, opts: ListOpts = {}): Promise<number> {
  const { whereSql, binds } = productFilter(opts);
  const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM products p ${whereSql}`).bind(...binds).first<{ n: number }>();
  return row?.n ?? 0;
}

export async function listProducts(env: Env, opts: ListOpts = {}) {
  const { whereSql, binds } = productFilter(opts);
  const limit = Math.min(opts.limit ?? 60, 120);
  const offset = Math.max(0, opts.offset ?? 0);
  const order = opts.sort === "price_asc" ? "min_price ASC"
    : opts.sort === "price_desc" ? "min_price DESC"
    : opts.sort === "rating" ? "p.rating_avg DESC, p.rating_count DESC"
    : "p.rating_count DESC, p.title";
  // best = the cheapest active offer; lets a listing card add to cart directly.
  const best = (col: string) =>
    `(SELECT ${col} FROM offers o WHERE o.product_id = p.id AND o.active = 1 ORDER BY CAST(o.price AS REAL), o.id LIMIT 1)`;

  const rows = await env.DB.prepare(
    `SELECT p.id, p.slug, p.title, p.category, p.brand, p.images, p.description, p.curated, p.rating_avg, p.rating_count,
        (SELECT MIN(CAST(o.price AS REAL)) FROM offers o WHERE o.product_id = p.id AND o.active = 1) AS min_price,
        (SELECT COUNT(*) FROM offers o WHERE o.product_id = p.id AND o.active = 1) AS offer_count,
        ${best("o.currency")} AS currency,
        ${best("o.id")} AS best_offer_id,
        ${best("o.seller_id")} AS best_seller_id,
        ${best("o.stock")} AS best_stock,
        ${best("o.compare_at")} AS best_compare,
        ${best("o.promo")} AS best_promo,
        (SELECT json_extract(s.doc,'$.name') FROM offers o JOIN sellers s ON s.id = o.seller_id
          WHERE o.product_id = p.id AND o.active = 1 ORDER BY CAST(o.price AS REAL), o.id LIMIT 1) AS best_seller_name
     FROM products p ${whereSql}
     ORDER BY ${order} LIMIT ? OFFSET ?`,
  ).bind(...binds, limit, offset).all<any>();

  return (rows.results ?? []).map((r) => {
    const compare = r.best_compare ? parseFloat(r.best_compare) : 0;
    const price = r.min_price ?? 0;
    const discountPct = compare > price && price > 0 ? Math.round(((compare - price) / compare) * 100) : 0;
    return {
      id: r.id, slug: r.slug, title: r.title, category: r.category, brand: r.brand,
      description: r.description || "", curated: !!r.curated,
      image: resolveImage(firstImage(r.images), r.title, r.category, r.slug || r.id), rating: r.rating_avg, ratingCount: r.rating_count,
      minPrice: r.min_price != null ? r.min_price.toFixed(2) : null,
      compareAt: compare ? compare.toFixed(2) : null, discountPct, promo: r.best_promo || "",
      currency: r.currency || "VES", offerCount: r.offer_count,
      bestOffer: r.best_offer_id ? { id: r.best_offer_id, sellerId: r.best_seller_id, sellerName: r.best_seller_name, stock: r.best_stock } : null,
    };
  });
}

catalog.get("/products", async (c) => {
  const limit = Math.min(Math.max(1, parseInt(c.req.query("limit") || "60", 10) || 60), 120);
  const page = Math.max(1, parseInt(c.req.query("page") || "1", 10) || 1);
  const opts = {
    q: c.req.query("q") ?? "", category: c.req.query("category") ?? "",
    store: c.req.query("store") ?? "", city: c.req.query("city") ?? "", sort: c.req.query("sort") ?? "",
    limit, offset: (page - 1) * limit,
  };
  const [items, total] = await Promise.all([listProducts(c.env, opts), countProducts(c.env, opts)]);
  return c.json({ count: items.length, total, page, limit, pages: Math.ceil(total / limit), products: items });
});

// ---------- product detail ----------

export async function getProduct(env: Env, slug: string) {
  const p = await env.DB.prepare(`SELECT * FROM products WHERE slug = ?`).bind(slug).first<any>();
  if (!p) return null;
  const offers = await env.DB.prepare(
    `SELECT o.id, o.price, o.currency, o.tax_rate, o.stock, o.condition, o.compare_at, o.promo,
            s.doc AS seller_doc, s.handle AS seller_handle, s.id AS seller_id
       FROM offers o JOIN sellers s ON s.id = o.seller_id
      WHERE o.product_id = ? AND o.active = 1
      ORDER BY CAST(o.price AS REAL)`,
  ).bind(p.id).all<any>();
  const reviews = await env.DB.prepare(
    `SELECT id, author, rating, title, body, created_at FROM reviews WHERE product_id = ? ORDER BY created_at DESC LIMIT 50`,
  ).bind(p.id).all<any>();
  // delivery cities of the best (first) offer's seller
  let cities: any[] = [];
  if (offers.results?.[0]) {
    const cr = await env.DB.prepare(`SELECT c.name FROM store_cities sc JOIN cities c ON c.slug=sc.city_slug WHERE sc.seller_id=? ORDER BY c.sort`).bind(offers.results[0].seller_id).all<any>();
    cities = (cr.results ?? []).map((x) => x.name);
  }
  const ownImages = safeJson<string[]>(p.images, []);
  const images = ownImages.length ? ownImages : [resolveImage(null, p.title, p.category, p.slug)];
  return {
    id: p.id, slug: p.slug, title: p.title, category: p.category, brand: p.brand,
    description: p.description, images, specs: safeJson(p.specs, {}),
    rating: p.rating_avg, ratingCount: p.rating_count, deliveryCities: cities,
    offers: (offers.results ?? []).map((o) => {
      const sd = safeJson<any>(o.seller_doc, {});
      const compare = o.compare_at ? parseFloat(o.compare_at) : 0;
      return {
        id: o.id, price: o.price, currency: o.currency, taxRate: o.tax_rate, stock: o.stock,
        condition: o.condition, compareAt: o.compare_at || null, promo: o.promo || "",
        discountPct: compare > parseFloat(o.price) ? Math.round((compare - parseFloat(o.price)) / compare * 100) : 0,
        sellerName: sd.name, sellerHandle: o.seller_handle, sellerId: o.seller_id, shipping: sd.shipping || [],
      };
    }),
    reviews: reviews.results ?? [],
  };
}

catalog.get("/products/:slug", async (c) => {
  const p = await getProduct(c.env, c.req.param("slug"));
  if (!p) return c.json({ error: "not_found" }, 404);
  return c.json(p);
});

// Create a canonical product (admin).
catalog.post("/products", async (c) => {
  const b = await c.req.json().catch(() => null);
  if (!b || !b.title) return c.json({ error: "validation_failed", message: "title required" }, 422);
  const id = newID("prod");
  const slug = (b.slug ? slugify(b.slug) : slugify(b.title)) + "-" + id.slice(-4);
  await c.env.DB.prepare(
    `INSERT INTO products (id, slug, title, category, brand, description, images, specs) VALUES (?,?,?,?,?,?,?,?)`,
  ).bind(id, slug, b.title, b.category ?? "", b.brand ?? "", b.description ?? "", json(b.images ?? []), json(b.specs ?? {})).run();
  await c.env.CACHE.delete("marketplace");
  return c.json({ id, slug }, 201);
});

// Update a canonical product's content (superuser content management). Only the
// provided fields are changed; `curated` flags well-known catalog items.
catalog.post("/products/:id", async (c) => {
  // The global auth gate already restricts writes to admin or Basic-auth callers.
  const id = c.req.param("id");
  const row = await c.env.DB.prepare(`SELECT * FROM products WHERE id = ?`).bind(id).first<any>();
  if (!row) return c.json({ error: "not_found" }, 404);
  const b = await c.req.json().catch(() => ({}));
  const next = {
    title: typeof b.title === "string" && b.title.trim() ? b.title.trim() : row.title,
    category: typeof b.category === "string" ? b.category : row.category,
    brand: typeof b.brand === "string" ? b.brand : row.brand,
    description: typeof b.description === "string" ? b.description : row.description,
    images: Array.isArray(b.images) ? json(b.images.filter((x: any) => typeof x === "string" && x.trim())) : row.images,
    specs: b.specs && typeof b.specs === "object" ? json(b.specs) : row.specs,
    curated: b.curated == null ? row.curated : (b.curated ? 1 : 0),
  };
  await c.env.DB.prepare(
    `UPDATE products SET title=?, category=?, brand=?, description=?, images=?, specs=?, curated=? WHERE id=?`,
  ).bind(next.title, next.category, next.brand, next.description, next.images, next.specs, next.curated, id).run();
  await c.env.CACHE.delete("marketplace");
  return c.json({ ok: true, id, ...next, images: safeJson(next.images, []) });
});

// Create/replace a seller's offer for a product (store/admin).
catalog.post("/offers", async (c) => {
  const b = await c.req.json().catch(() => null);
  if (!b || !b.productId || !b.sellerId || !b.price) {
    return c.json({ error: "validation_failed", message: "productId, sellerId, price required" }, 422);
  }
  const id = newID("off");
  await c.env.DB.prepare(
    `INSERT INTO offers (id, product_id, seller_id, price, currency, tax_rate, stock, condition, compare_at, promo, featured)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(product_id, seller_id) DO UPDATE SET
       price=excluded.price, currency=excluded.currency, tax_rate=excluded.tax_rate,
       stock=excluded.stock, condition=excluded.condition, compare_at=excluded.compare_at,
       promo=excluded.promo, featured=excluded.featured, active=1`,
  ).bind(id, b.productId, b.sellerId, String(b.price), b.currency ?? "VES", b.taxRate ?? "16.00",
    Number.isInteger(b.stock) ? b.stock : 0, b.condition ?? "new",
    b.compareAt ? String(b.compareAt) : "", b.promo ?? "", b.featured ? 1 : 0).run();
  await c.env.CACHE.delete("marketplace");
  return c.json({ ok: true }, 201);
});

// Create a home promotion banner (admin). body: { kind,title,subtitle,href,color,sort }
catalog.post("/promotions", async (c) => {
  const b = await c.req.json().catch(() => null);
  if (!b || !b.title) return c.json({ error: "validation_failed", message: "title required" }, 422);
  await c.env.DB.prepare(`INSERT INTO promotions (id, kind, title, subtitle, href, color, sort) VALUES (?,?,?,?,?,?,?)`)
    .bind(newID("promo"), b.kind ?? "deal", b.title, b.subtitle ?? "", b.href ?? "/", b.color ?? "blue", b.sort ?? 0).run();
  await c.env.CACHE.delete("marketplace");
  return c.json({ ok: true }, 201);
});

// Set a store's delivery cities (admin/store). body: { sellerId, cities: [slug] }
catalog.post("/sellers/:id/cities", async (c) => {
  const sellerId = c.req.param("id");
  const b = await c.req.json().catch(() => null);
  const cities: string[] = Array.isArray(b?.cities) ? b.cities : [];
  await c.env.DB.prepare(`DELETE FROM store_cities WHERE seller_id = ?`).bind(sellerId).run();
  if (cities.length) {
    await c.env.DB.batch(cities.map((slug) => c.env.DB.prepare(`INSERT OR IGNORE INTO store_cities (seller_id, city_slug) VALUES (?,?)`).bind(sellerId, slug)));
  }
  return c.json({ ok: true, cities });
});

// Configure merchant payment instructions shown during Meriplaza checkout.
catalog.post("/sellers/:id/payment-methods", async (c) => {
  const sellerId = c.req.param("id");
  const user = await currentUser(c.env, c.req.header("Cookie"));
  if (user?.role === "store" && user.sellerId !== sellerId) return c.json({ error: "forbidden" }, 403);
  const row = await c.env.DB.prepare(`SELECT doc FROM sellers WHERE id=?`).bind(sellerId).first<{ doc: string }>();
  if (!row) return c.json({ error: "not_found" }, 404);
  const b = await c.req.json().catch(() => ({}));
  const seller = safeJson<any>(row.doc, {});
  seller.paymentMethods = normalizePaymentMethods(b);
  await c.env.DB.prepare(`UPDATE sellers SET doc=? WHERE id=?`).bind(json(seller), sellerId).run();
  await c.env.CACHE.delete("marketplace");
  return c.json({ ok: true, paymentMethods: seller.paymentMethods });
});

// Add a review and recompute the product's rating aggregate.
catalog.post("/products/:slug/reviews", async (c) => {
  const p = await c.env.DB.prepare(`SELECT id FROM products WHERE slug = ?`).bind(c.req.param("slug")).first<{ id: string }>();
  if (!p) return c.json({ error: "not_found" }, 404);
  const b = await c.req.json().catch(() => null);
  const rating = Math.max(1, Math.min(5, Number(b?.rating) | 0));
  if (!rating) return c.json({ error: "validation_failed", message: "rating 1-5 required" }, 422);
  await c.env.DB.prepare(`INSERT INTO reviews (id, product_id, author, rating, title, body) VALUES (?,?,?,?,?,?)`)
    .bind(newID("rev"), p.id, (b.author || "Cliente").slice(0, 60), rating, (b.title || "").slice(0, 120), (b.body || "").slice(0, 2000)).run();
  const agg = await c.env.DB.prepare(`SELECT AVG(rating) a, COUNT(*) n FROM reviews WHERE product_id = ?`).bind(p.id).first<{ a: number; n: number }>();
  await c.env.DB.prepare(`UPDATE products SET rating_avg = ?, rating_count = ? WHERE id = ?`).bind(agg?.a ?? 0, agg?.n ?? 0, p.id).run();
  return c.json({ ok: true, rating: agg?.a, count: agg?.n }, 201);
});

// ---------- sellers / storefronts ----------

catalog.post("/sellers", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || !body.handle || !body.name) return c.json({ error: "validation_failed", message: "handle and name required" }, 422);
  if (body.taxId) { try { ident.parse(body.taxId); } catch (e) { return c.json({ error: "validation_failed", message: `invalid taxId: ${(e as Error).message}` }, 422); } }
  const seller = {
    id: newID("sel"), handle: String(body.handle), name: String(body.name), kind: body.kind ?? "store",
    taxId: body.taxId ?? "", merchantId: body.merchantId || "", theme: body.theme ?? {}, socials: body.socials ?? {},
    shipping: Array.isArray(body.shipping) ? body.shipping : [], currency: body.currency || "VES", createdAt: nowISO(),
  };
  if (!seller.merchantId) seller.merchantId = `m_${seller.id}`;
  try {
    await c.env.DB.prepare(`INSERT INTO sellers (id, handle, doc) VALUES (?,?,?)`).bind(seller.id, seller.handle, json(seller)).run();
  } catch (e) {
    if (String((e as Error).message).includes("UNIQUE")) return c.json({ error: "conflict", message: "handle already taken" }, 409);
    throw e;
  }
  await c.env.CACHE.delete("marketplace");
  return c.json(seller, 201);
});

export async function getStorefront(env: Env, handle: string) {
  const row = await env.DB.prepare(`SELECT doc FROM sellers WHERE handle = ?`).bind(handle).first<{ doc: string }>();
  if (!row) return null;
  const seller = JSON.parse(row.doc);
  const offers = await env.DB.prepare(
    `SELECT o.id, o.price, o.currency, o.tax_rate, o.stock, p.slug, p.title, p.images, p.category, p.rating_avg, p.rating_count
       FROM offers o JOIN products p ON p.id = o.product_id
      WHERE o.seller_id = ? AND o.active = 1 ORDER BY p.title`,
  ).bind(seller.id).all<any>();
  return {
    seller,
    products: (offers.results ?? []).map((o) => ({
      offerId: o.id, slug: o.slug, title: o.title, image: resolveImage(firstImage(o.images), o.title, o.category, o.slug), category: o.category,
      price: o.price, currency: o.currency, stock: o.stock, rating: o.rating_avg, ratingCount: o.rating_count,
    })),
  };
}

catalog.get("/sellers/:handle", async (c) => {
  const sf = await getStorefront(c.env, c.req.param("handle"));
  if (!sf) return c.json({ error: "not_found", message: "storefront not found" }, 404);
  return c.json(sf);
});

catalog.get("/sellers/by-id/:id/payment-methods", async (c) => {
  const row = await c.env.DB.prepare(`SELECT doc FROM sellers WHERE id=?`).bind(c.req.param("id")).first<{ doc: string }>();
  if (!row) return c.json({ error: "not_found" }, 404);
  const seller = safeJson<any>(row.doc, {});
  return c.json({ seller: { id: seller.id, name: seller.name }, paymentMethods: seller.paymentMethods || {} });
});

// ---------- orders ----------

catalog.post("/orders", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || !Array.isArray(body.items) || body.items.length === 0) {
    return c.json({ error: "validation_failed", message: "items required" }, 422);
  }
  const items: CartItem[] = body.items.map((i: any) => ({ productId: String(i.offerId), quantity: Number(i.quantity) }));

  // Load each offer as the sellable unit; all lines must belong to one seller.
  const products = new Map<string, ProductLike>();
  let sellerId = "", currency = "";
  for (const it of items) {
    const o = await c.env.DB.prepare(
      `SELECT o.id, o.price, o.currency, o.tax_rate, o.stock, o.seller_id, p.title
         FROM offers o JOIN products p ON p.id = o.product_id WHERE o.id = ?`,
    ).bind(it.productId).first<any>();
    if (!o) return c.json({ error: "validation_failed", message: `unknown offer ${it.productId}` }, 422);
    if (sellerId && o.seller_id !== sellerId) return c.json({ error: "validation_failed", message: "one order must be from a single store" }, 422);
    sellerId = o.seller_id; currency = o.currency;
    products.set(o.id, { id: o.id, title: o.title, price: o.price, currency: o.currency, taxRate: o.tax_rate, stock: o.stock, active: true });
  }

  let priced;
  try { priced = priceOrder(currency, products, items); }
  catch (e) { return c.json({ error: "validation_failed", message: (e as Error).message }, 422); }

  const order = {
    id: newID("ord"), sellerId, channel: body.channel ?? "web", lines: priced.lines,
    currency: priced.currency, subtotal: priced.subtotal, taxTotal: priced.taxTotal, grandTotal: priced.grandTotal,
    status: "pending", paymentIntentId: "", invoiceId: "",
    buyerName: body.buyerName ?? "", buyerTaxId: body.buyerTaxId ?? "", userId: body.userId ?? "",
    createdAt: nowISO(),
  };

  // Reserve stock on offers (conditional UPDATE prevents overselling).
  const stmts = order.lines.map((l) =>
    c.env.DB.prepare(`UPDATE offers SET stock = stock - ? WHERE id = ? AND stock >= ?`).bind(l.quantity, l.productId, l.quantity));
  const results = await c.env.DB.batch(stmts);
  if (results.some((r) => (r.meta?.changes ?? 0) === 0)) {
    const undo = order.lines.filter((_, i) => (results[i].meta?.changes ?? 0) > 0)
      .map((l) => c.env.DB.prepare(`UPDATE offers SET stock = stock + ? WHERE id = ?`).bind(l.quantity, l.productId));
    if (undo.length) await c.env.DB.batch(undo);
    return c.json({ error: "out_of_stock", message: "insufficient stock" }, 409);
  }
  await c.env.DB.prepare(`INSERT INTO orders (id, seller_id, doc) VALUES (?,?,?)`).bind(order.id, order.sellerId, json(order)).run();
  return c.json(order, 201);
});

// Customer checkout: split a cart by store, create one order + payment intent
// per store, confirm each intent, and attach fiscal invoice metadata when paid.
catalog.post("/checkout", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || !Array.isArray(body.items) || body.items.length === 0) {
    return c.json({ error: "validation_failed", message: "items required" }, 422);
  }
  const method = String(body.payment?.method ?? "transferencia");
  if (!isKnownMethod(method)) return c.json({ error: "validation_failed", message: `unknown payment method "${method}"` }, 422);
  const user = await currentUser(c.env, c.req.header("Cookie"));

  const cart = normalizeCart(body.items);
  if (cart.length === 0) return c.json({ error: "validation_failed", message: "valid items required" }, 422);
  const offerIds = [...new Set(cart.map((i) => i.offerId))];
  const offers = new Map<string, any>();
  for (const id of offerIds) {
    const row = await c.env.DB.prepare(
      `SELECT o.id, o.price, o.currency, o.tax_rate, o.stock, o.seller_id,
              p.title, s.doc AS seller_doc
         FROM offers o
         JOIN products p ON p.id = o.product_id
         JOIN sellers s ON s.id = o.seller_id
        WHERE o.id = ? AND o.active = 1`,
    ).bind(id).first<any>();
    if (!row) return c.json({ error: "validation_failed", message: `unknown offer ${id}` }, 422);
    offers.set(id, row);
  }

  const bySeller = new Map<string, { seller: any; items: CartItem[] }>();
  for (const line of cart) {
    const offer = offers.get(line.offerId);
    const group = bySeller.get(offer.seller_id) ?? { seller: offer, items: [] };
    group.items.push({ productId: line.offerId, quantity: line.quantity });
    bySeller.set(offer.seller_id, group);
  }

  const orders: any[] = [];
  for (const [sellerId, group] of bySeller) {
    const sellerDoc = safeJson<any>(group.seller.seller_doc, {});
    const products = new Map<string, ProductLike>();
    for (const it of group.items) {
      const o = offers.get(it.productId);
      products.set(o.id, { id: o.id, title: o.title, price: o.price, currency: o.currency, taxRate: o.tax_rate, stock: o.stock, active: true });
    }

    let priced;
    try { priced = priceOrder(group.seller.currency, products, group.items); }
    catch (e) { return c.json({ error: "validation_failed", message: (e as Error).message }, 422); }

    const orderId = newID("ord");
    const piId = newID("pi");
    const now = nowISO();
    const paymentIntent = {
      id: piId,
      amount: { value: priced.grandTotal, currency: priced.currency },
      method: method as Method,
      status: "requires_confirmation",
      merchantId: sellerDoc.merchantId || `m_${sellerId}`,
      orderRef: orderId,
      description: `Meriplaza ${orderId}`,
      methodData: body.payment?.methodData ?? {},
      nextAction: null as unknown,
      settlement: null as unknown,
      failureReason: "",
      createdAt: now,
      updatedAt: now,
    };

    const res = confirm(method as Method, { id: piId, amount: paymentIntent.amount, methodData: paymentIntent.methodData }, nowISO());
    paymentIntent.status = res.status;
    paymentIntent.nextAction = res.nextAction ?? null;
    paymentIntent.settlement = res.settlement ?? null;
    paymentIntent.failureReason = res.failure ?? "";
    paymentIntent.updatedAt = nowISO();

    const invoice = paymentIntent.status === "succeeded" ? buildFiscalInvoice(orderId, priced, body, sellerDoc, paymentIntent) : null;
    const order = {
      id: orderId,
      sellerId,
      channel: body.channel ?? "web",
      lines: priced.lines,
      currency: priced.currency,
      subtotal: priced.subtotal,
      taxTotal: priced.taxTotal,
      grandTotal: priced.grandTotal,
      status: invoice ? "invoiced" : paymentIntent.status === "requires_action" ? "payment_action_required" : paymentIntent.status === "failed" ? "payment_failed" : "pending_payment",
      paymentIntentId: piId,
      invoiceId: invoice?.id ?? "",
      invoice,
      payment: {
        method,
        status: paymentIntent.status,
        nextAction: paymentIntent.nextAction,
        settlement: paymentIntent.settlement,
        failureReason: paymentIntent.failureReason,
      },
      buyerName: body.buyer?.name ?? body.buyerName ?? "",
      buyerTaxId: body.buyer?.taxId ?? body.buyerTaxId ?? "",
      buyerEmail: body.buyer?.email ?? "",
      userId: body.userId ?? user?.id ?? "",
      shippingAddress: body.shippingAddress ?? {},
      shipment: {
        status: "pending",
        method: body.shipment?.method ?? sellerDoc.shipping?.[0]?.provider ?? "delivery",
        city: body.shippingAddress?.city ?? "",
        notes: body.shipment?.notes ?? "",
      },
      merchant: {
        id: sellerId,
        name: sellerDoc.name ?? "",
        rif: sellerDoc.taxId ?? "",
        merchantId: sellerDoc.merchantId || `m_${sellerId}`,
      },
      createdAt: nowISO(),
    };

    const reserve = order.lines.map((l: any) =>
      c.env.DB.prepare(`UPDATE offers SET stock = stock - ? WHERE id = ? AND stock >= ?`).bind(l.quantity, l.productId, l.quantity));
    const reserved = await c.env.DB.batch(reserve);
    if (reserved.some((r) => (r.meta?.changes ?? 0) === 0)) {
      const undo = order.lines.filter((_: any, i: number) => (reserved[i].meta?.changes ?? 0) > 0)
        .map((l: any) => c.env.DB.prepare(`UPDATE offers SET stock = stock + ? WHERE id = ?`).bind(l.quantity, l.productId));
      if (undo.length) await c.env.DB.batch(undo);
      return c.json({ error: "out_of_stock", message: "insufficient stock" }, 409);
    }

    await c.env.DB.batch([
      c.env.DB.prepare(`INSERT INTO payment_intents (id, merchant_id, idempotency_key, doc) VALUES (?, ?, ?, ?)`)
        .bind(paymentIntent.id, paymentIntent.merchantId, `checkout:${order.id}`, json(paymentIntent)),
      c.env.DB.prepare(`INSERT INTO orders (id, seller_id, doc) VALUES (?,?,?)`).bind(order.id, order.sellerId, json(order)),
    ]);
    orders.push(order);
  }

  return c.json({ ok: true, orders }, 201);
});

catalog.get("/orders/:id", async (c) => {
  const row = await c.env.DB.prepare(`SELECT doc FROM orders WHERE id = ?`).bind(c.req.param("id")).first<{ doc: string }>();
  if (!row) return c.json({ error: "not_found" }, 404);
  return c.json(JSON.parse(row.doc));
});

catalog.post("/orders/:id/mark-paid", async (c) => {
  const row = await c.env.DB.prepare(`SELECT doc FROM orders WHERE id = ?`).bind(c.req.param("id")).first<{ doc: string }>();
  if (!row) return c.json({ error: "not_found" }, 404);
  const order = JSON.parse(row.doc);
  const b = await c.req.json().catch(() => ({}));
  order.paymentIntentId = b.paymentIntentId ?? order.paymentIntentId;
  order.status = "paid";
  if (b.invoiceId) { order.invoiceId = b.invoiceId; order.status = "invoiced"; }
  await c.env.DB.prepare(`UPDATE orders SET doc = ? WHERE id = ?`).bind(json(order), order.id).run();
  return c.json(order);
});

catalog.post("/orders/:id/fulfillment", async (c) => {
  const row = await c.env.DB.prepare(`SELECT doc FROM orders WHERE id = ?`).bind(c.req.param("id")).first<{ doc: string }>();
  if (!row) return c.json({ error: "not_found" }, 404);
  const order = JSON.parse(row.doc);
  const user = await currentUser(c.env, c.req.header("Cookie"));
  if (user?.role === "store" && user.sellerId !== order.sellerId) return c.json({ error: "forbidden" }, 403);

  const b = await c.req.json().catch(() => ({}));
  const status = String(b.status || order.shipment?.status || "pending");
  if (!["pending", "preparing", "ready", "shipped", "delivered", "canceled"].includes(status)) {
    return c.json({ error: "validation_failed", message: "invalid shipment status" }, 422);
  }
  order.shipment = {
    ...(order.shipment || {}),
    status,
    carrier: String(b.carrier ?? order.shipment?.carrier ?? "").slice(0, 80),
    tracking: String(b.tracking ?? order.shipment?.tracking ?? "").slice(0, 120),
    notes: String(b.notes ?? order.shipment?.notes ?? "").slice(0, 240),
    updatedAt: nowISO(),
  };
  if (status === "delivered") order.status = "fulfilled";
  if (status === "canceled") order.status = "canceled";
  await c.env.DB.prepare(`UPDATE orders SET doc = ? WHERE id = ?`).bind(json(order), order.id).run();
  return c.json(order);
});

// Orders for a seller (store dashboard).
catalog.get("/sellers/:id/orders", async (c) => {
  const rows = await c.env.DB.prepare(`SELECT doc FROM orders WHERE seller_id = ? ORDER BY created_at DESC LIMIT 100`).bind(c.req.param("id")).all<{ doc: string }>();
  return c.json({ orders: (rows.results ?? []).map((r) => JSON.parse(r.doc)) });
});

// ---------- helpers ----------
function firstImage(imagesJson: string): string | null {
  const arr = safeJson(imagesJson, []) as string[];
  return arr.length ? arr[0] : null;
}
function safeJson<T>(s: string, fallback: T): T { try { return JSON.parse(s); } catch { return fallback; } }

function normalizePaymentMethods(b: any) {
  return {
    pago_movil: b.pago_movil ? {
      bank: String(b.pago_movil.bank || "").slice(0, 80),
      phone: String(b.pago_movil.phone || "").slice(0, 40),
      ci: String(b.pago_movil.ci || "").slice(0, 40),
    } : null,
    transferencia: b.transferencia ? {
      bank: String(b.transferencia.bank || "").slice(0, 80),
      account: String(b.transferencia.account || "").slice(0, 80),
      holder: String(b.transferencia.holder || "").slice(0, 120),
    } : null,
    crypto: b.crypto ? {
      network: String(b.crypto.network || "TRON").slice(0, 40),
      asset: String(b.crypto.asset || "USDT").slice(0, 20),
      address: String(b.crypto.address || "").slice(0, 160),
    } : null,
  };
}

function normalizeCart(items: any[]): Array<{ offerId: string; quantity: number }> {
  return items.map((i) => ({ offerId: String(i.offerId), quantity: Number(i.quantity) }))
    .filter((i) => i.offerId && Number.isInteger(i.quantity) && i.quantity > 0);
}

function buildFiscalInvoice(orderId: string, priced: any, body: any, seller: any, pi: any) {
  const createdAt = nowISO();
  return {
    id: newID("fac"),
    number: orderId.replace(/^ord_/, "").slice(0, 9).toUpperCase(),
    controlNumber: `SF-${orderId.slice(-9).toUpperCase()}`,
    type: "FACTURA",
    currency: priced.currency,
    subtotal: priced.subtotal,
    ivaAmount: priced.taxTotal,
    total: priced.grandTotal,
    buyer: {
      name: body.buyer?.name ?? body.buyerName ?? "Consumidor final",
      taxId: body.buyer?.taxId ?? body.buyerTaxId ?? "",
      email: body.buyer?.email ?? "",
      address: body.shippingAddress ?? {},
    },
    merchant: {
      name: seller.name ?? "",
      rif: seller.taxId ?? "",
      fiscalAddress: seller.address ?? "",
      merchantId: seller.merchantId ?? "",
    },
    lines: priced.lines.map((l: any) => ({
      description: l.title,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      ivaRate: l.taxRate,
    })),
    payment: {
      intentId: pi.id,
      method: pi.method,
      settlement: pi.settlement,
    },
    createdAt,
  };
}
