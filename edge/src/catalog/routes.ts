// Catalog routes (v2): canonical products + per-seller offers + reviews.
// Multiple stores can sell the same product; the marketplace aggregates offers
// (lowest price, store count) and the product page lists every store's offer.
//
// Backed by D1; KV caches the marketplace landing.

import { Hono } from "hono";
import type { Env } from "../lib/env.ts";
import { newID, nowISO } from "../lib/env.ts";
import * as ident from "../lib/ident.ts";
import { priceOrder, type ProductLike, type CartItem } from "../lib/pricing.ts";

export const catalog = new Hono<{ Bindings: Env }>();

const json = (v: unknown) => JSON.stringify(v);
const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);

// ---------- marketplace landing ----------

catalog.get("/marketplace", async (c) => {
  const cached = await c.env.CACHE.get("marketplace");
  if (cached) return new Response(cached, { headers: { "content-type": "application/json", "x-cache": "HIT" } });

  const sellers = await c.env.DB.prepare(
    `SELECT s.doc AS doc,
       (SELECT COUNT(*) FROM offers o WHERE o.seller_id = s.id AND o.active = 1) AS offer_count
     FROM sellers s ORDER BY s.created_at`,
  ).all<{ doc: string; offer_count: number }>();
  const cats = await c.env.DB.prepare(`SELECT slug, name, icon FROM categories ORDER BY sort, name`).all();

  const payload = json({
    sellers: (sellers.results ?? []).map((r) => {
      const s = JSON.parse(r.doc);
      return { id: s.id, handle: s.handle, name: s.name, kind: s.kind, theme: s.theme, socials: s.socials, currency: s.currency, productCount: r.offer_count };
    }),
    categories: cats.results ?? [],
  });
  await c.env.CACHE.put("marketplace", payload, { expirationTtl: 60 });
  return new Response(payload, { headers: { "content-type": "application/json", "x-cache": "MISS" } });
});

// ---------- product listing / search ----------

export async function listProducts(env: Env, opts: { q?: string; category?: string; limit?: number } = {}) {
  const where: string[] = [];
  const binds: unknown[] = [];
  if (opts.category) { where.push("p.category = ?"); binds.push(opts.category); }
  if (opts.q) { where.push("(lower(p.title) LIKE ? OR lower(p.brand) LIKE ? OR lower(p.description) LIKE ?)"); const q = `%${opts.q.toLowerCase()}%`; binds.push(q, q, q); }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limit = Math.min(opts.limit ?? 60, 100);

  const rows = await env.DB.prepare(
    `SELECT p.id, p.slug, p.title, p.category, p.brand, p.images, p.rating_avg, p.rating_count,
        (SELECT MIN(CAST(o.price AS REAL)) FROM offers o WHERE o.product_id = p.id AND o.active = 1) AS min_price,
        (SELECT COUNT(*) FROM offers o WHERE o.product_id = p.id AND o.active = 1) AS offer_count,
        (SELECT o.currency FROM offers o WHERE o.product_id = p.id AND o.active = 1 ORDER BY CAST(o.price AS REAL) LIMIT 1) AS currency
     FROM products p ${whereSql}
     ORDER BY p.rating_count DESC, p.title LIMIT ?`,
  ).bind(...binds, limit).all<any>();

  return (rows.results ?? []).map((r) => ({
    id: r.id, slug: r.slug, title: r.title, category: r.category, brand: r.brand,
    image: firstImage(r.images), rating: r.rating_avg, ratingCount: r.rating_count,
    minPrice: r.min_price != null ? r.min_price.toFixed(2) : null,
    currency: r.currency || "VES", offerCount: r.offer_count,
  }));
}

catalog.get("/products", async (c) => {
  const items = await listProducts(c.env, { q: c.req.query("q") ?? "", category: c.req.query("category") ?? "" });
  return c.json({ count: items.length, products: items });
});

// ---------- product detail ----------

export async function getProduct(env: Env, slug: string) {
  const p = await env.DB.prepare(`SELECT * FROM products WHERE slug = ?`).bind(slug).first<any>();
  if (!p) return null;
  const offers = await env.DB.prepare(
    `SELECT o.id, o.price, o.currency, o.tax_rate, o.stock, o.condition,
            json_extract(s.doc,'$.name') AS seller_name, s.handle AS seller_handle, s.id AS seller_id
       FROM offers o JOIN sellers s ON s.id = o.seller_id
      WHERE o.product_id = ? AND o.active = 1
      ORDER BY CAST(o.price AS REAL)`,
  ).bind(p.id).all<any>();
  const reviews = await env.DB.prepare(
    `SELECT id, author, rating, title, body, created_at FROM reviews WHERE product_id = ? ORDER BY created_at DESC LIMIT 50`,
  ).bind(p.id).all<any>();
  return {
    id: p.id, slug: p.slug, title: p.title, category: p.category, brand: p.brand,
    description: p.description, images: safeJson(p.images, []), specs: safeJson(p.specs, {}),
    rating: p.rating_avg, ratingCount: p.rating_count,
    offers: (offers.results ?? []).map((o) => ({
      id: o.id, price: o.price, currency: o.currency, taxRate: o.tax_rate, stock: o.stock,
      condition: o.condition, sellerName: o.seller_name, sellerHandle: o.seller_handle, sellerId: o.seller_id,
    })),
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

// Create/replace a seller's offer for a product (store/admin).
catalog.post("/offers", async (c) => {
  const b = await c.req.json().catch(() => null);
  if (!b || !b.productId || !b.sellerId || !b.price) {
    return c.json({ error: "validation_failed", message: "productId, sellerId, price required" }, 422);
  }
  const id = newID("off");
  await c.env.DB.prepare(
    `INSERT INTO offers (id, product_id, seller_id, price, currency, tax_rate, stock, condition)
     VALUES (?,?,?,?,?,?,?,?)
     ON CONFLICT(product_id, seller_id) DO UPDATE SET
       price=excluded.price, currency=excluded.currency, tax_rate=excluded.tax_rate,
       stock=excluded.stock, condition=excluded.condition, active=1`,
  ).bind(id, b.productId, b.sellerId, String(b.price), b.currency ?? "VES", b.taxRate ?? "16.00",
    Number.isInteger(b.stock) ? b.stock : 0, b.condition ?? "new").run();
  await c.env.CACHE.delete("marketplace");
  return c.json({ ok: true }, 201);
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
    currency: body.currency || "VES", createdAt: nowISO(),
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
      offerId: o.id, slug: o.slug, title: o.title, image: firstImage(o.images), category: o.category,
      price: o.price, currency: o.currency, stock: o.stock, rating: o.rating_avg, ratingCount: o.rating_count,
    })),
  };
}

catalog.get("/sellers/:handle", async (c) => {
  const sf = await getStorefront(c.env, c.req.param("handle"));
  if (!sf) return c.json({ error: "not_found", message: "storefront not found" }, 404);
  return c.json(sf);
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
