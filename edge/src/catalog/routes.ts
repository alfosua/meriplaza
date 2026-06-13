// Catalog routes: sellers (customizable storefronts), products, orders.
// Backed by D1, with a KV cache for public storefront reads to cut D1 row-reads
// and serve fast at the edge.

import { Hono } from "hono";
import type { Env } from "../lib/env.ts";
import { newID, nowISO } from "../lib/env.ts";
import * as ident from "../lib/ident.ts";
import { priceOrder, type ProductLike, type CartItem } from "../lib/pricing.ts";

const STOREFRONT_TTL = 60; // seconds (KV minimum); edits also bust the cache explicitly

export const catalog = new Hono<{ Bindings: Env }>();

// --- unified marketplace (Amazon-like, across all sellers) ---

// List all storefronts for the marketplace landing page.
catalog.get("/marketplace", async (c) => {
  const cached = await c.env.CACHE.get("marketplace");
  if (cached) return new Response(cached, { headers: { "content-type": "application/json", "x-cache": "HIT" } });

  const { results } = await c.env.DB.prepare(`SELECT s.doc AS doc,
      (SELECT COUNT(*) FROM products p WHERE p.seller_id = s.id AND p.active = 1) AS product_count
      FROM sellers s ORDER BY s.created_at`).all<{ doc: string; product_count: number }>();
  const sellers = (results ?? []).map((r) => {
    const s = JSON.parse(r.doc);
    return { id: s.id, handle: s.handle, name: s.name, kind: s.kind, theme: s.theme, socials: s.socials, currency: s.currency, productCount: r.product_count };
  });
  const payload = JSON.stringify({ sellers });
  await c.env.CACHE.put("marketplace", payload, { expirationTtl: 60 });
  return new Response(payload, { headers: { "content-type": "application/json", "x-cache": "MISS" } });
});

// Unified product search across every store.
catalog.get("/products", async (c) => {
  const q = (c.req.query("q") ?? "").trim().toLowerCase();
  const { results } = await c.env.DB.prepare(
    `SELECT p.doc AS doc, p.stock AS stock, s.handle AS seller_handle, s.name AS seller_name
       FROM products p JOIN sellers s ON s.id = p.seller_id
      WHERE p.active = 1`,
  ).all<{ doc: string; stock: number; seller_handle: string; seller_name: string }>();
  let items = (results ?? []).map((r) => ({ ...JSON.parse(r.doc), stock: r.stock, sellerHandle: r.seller_handle, sellerName: r.seller_name }));
  if (q) items = items.filter((p) => p.title.toLowerCase().includes(q) || (p.description ?? "").toLowerCase().includes(q));
  return c.json({ query: q, count: items.length, products: items });
});

// --- sellers ---

catalog.post("/sellers", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || !body.handle || !body.name) {
    return c.json({ error: "validation_failed", message: "handle and name are required" }, 422);
  }
  if (body.taxId) {
    try { ident.parse(body.taxId); } catch (e) {
      return c.json({ error: "validation_failed", message: `invalid taxId: ${(e as Error).message}` }, 422);
    }
  }
  const seller = {
    id: newID("sel"),
    handle: String(body.handle),
    name: String(body.name),
    kind: body.kind ?? "store",
    taxId: body.taxId ?? "",
    merchantId: body.merchantId || "",
    theme: body.theme ?? {},
    socials: body.socials ?? {},
    currency: body.currency || "VES",
    createdAt: nowISO(),
  };
  if (!seller.merchantId) seller.merchantId = `m_${seller.id}`;

  try {
    await c.env.DB.prepare(`INSERT INTO sellers (id, handle, doc) VALUES (?, ?, ?)`)
      .bind(seller.id, seller.handle, JSON.stringify(seller))
      .run();
  } catch (e) {
    if (String((e as Error).message).includes("UNIQUE")) {
      return c.json({ error: "conflict", message: "handle already taken" }, 409);
    }
    throw e;
  }
  await c.env.CACHE.delete("marketplace");
  return c.json(seller, 201);
});

// Public storefront: seller profile + active products. Cached in KV.
catalog.get("/sellers/:handle", async (c) => {
  const handle = c.req.param("handle");
  const cacheKey = `storefront:${handle}`;
  const cached = await c.env.CACHE.get(cacheKey);
  if (cached) {
    return new Response(cached, { headers: { "content-type": "application/json", "x-cache": "HIT" } });
  }

  const sellerRow = await c.env.DB.prepare(`SELECT doc FROM sellers WHERE handle = ?`).bind(handle).first<{ doc: string }>();
  if (!sellerRow) return c.json({ error: "not_found", message: "storefront not found" }, 404);
  const seller = JSON.parse(sellerRow.doc);

  const { results } = await c.env.DB.prepare(
    `SELECT doc, stock FROM products WHERE seller_id = ? AND active = 1`,
  ).bind(seller.id).all<{ doc: string; stock: number }>();
  const products = (results ?? []).map((r) => ({ ...JSON.parse(r.doc), stock: r.stock }));

  const payload = JSON.stringify({ seller, products });
  await c.env.CACHE.put(cacheKey, payload, { expirationTtl: STOREFRONT_TTL });
  return new Response(payload, { headers: { "content-type": "application/json", "x-cache": "MISS" } });
});

// --- products ---

catalog.post("/sellers/:id/products", async (c) => {
  const sellerId = c.req.param("id");
  const seller = await c.env.DB.prepare(`SELECT doc FROM sellers WHERE id = ?`).bind(sellerId).first<{ doc: string }>();
  if (!seller) return c.json({ error: "not_found", message: "seller not found" }, 404);
  const sellerDoc = JSON.parse(seller.doc);

  const body = await c.req.json().catch(() => null);
  if (!body || !body.title || !body.price) {
    return c.json({ error: "validation_failed", message: "title and price are required" }, 422);
  }
  const product = {
    id: newID("prod"),
    sellerId,
    sku: body.sku ?? "",
    title: String(body.title),
    description: body.description ?? "",
    price: String(body.price),
    currency: body.currency || sellerDoc.currency || "VES",
    taxRate: body.taxRate || "16.00",
    stock: Number.isInteger(body.stock) ? body.stock : 0,
    images: Array.isArray(body.images) ? body.images : [],
    active: body.active !== false,
  };
  await c.env.DB.prepare(`INSERT INTO products (id, seller_id, stock, active, doc) VALUES (?, ?, ?, ?, ?)`)
    .bind(product.id, sellerId, product.stock, product.active ? 1 : 0, JSON.stringify(product))
    .run();
  // Invalidate caches so the new product appears.
  await c.env.CACHE.delete(`storefront:${sellerDoc.handle}`);
  await c.env.CACHE.delete("marketplace");
  return c.json(product, 201);
});

// --- orders ---

catalog.post("/orders", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || !body.sellerId || !Array.isArray(body.items)) {
    return c.json({ error: "validation_failed", message: "sellerId and items are required" }, 422);
  }
  const sellerRow = await c.env.DB.prepare(`SELECT doc FROM sellers WHERE id = ?`).bind(body.sellerId).first<{ doc: string }>();
  if (!sellerRow) return c.json({ error: "not_found", message: "seller not found" }, 404);
  const seller = JSON.parse(sellerRow.doc);

  const items: CartItem[] = body.items.map((i: any) => ({ productId: String(i.productId), quantity: Number(i.quantity) }));

  // Load referenced products (with authoritative stock).
  const products = new Map<string, ProductLike>();
  for (const it of items) {
    const row = await c.env.DB.prepare(`SELECT doc, stock FROM products WHERE id = ?`).bind(it.productId).first<{ doc: string; stock: number }>();
    if (!row) return c.json({ error: "validation_failed", message: `unknown product ${it.productId}` }, 422);
    products.set(it.productId, { ...JSON.parse(row.doc), stock: row.stock });
  }

  let priced;
  try {
    priced = priceOrder(seller.currency, products, items);
  } catch (e) {
    return c.json({ error: "validation_failed", message: (e as Error).message }, 422);
  }

  const order = {
    id: newID("ord"),
    sellerId: seller.id,
    channel: body.channel ?? "web",
    lines: priced.lines,
    currency: priced.currency,
    subtotal: priced.subtotal,
    taxTotal: priced.taxTotal,
    grandTotal: priced.grandTotal,
    status: "pending",
    paymentIntentId: "",
    invoiceId: "",
    buyerName: body.buyerName ?? "",
    buyerTaxId: body.buyerTaxId ?? "",
    createdAt: nowISO(),
  };

  // Reserve stock + persist order atomically. D1 batch runs as one transaction;
  // the conditional UPDATE (stock >= qty) prevents overselling, and we verify
  // every decrement applied before committing the order.
  const stmts = [];
  for (const l of order.lines) {
    stmts.push(
      c.env.DB.prepare(`UPDATE products SET stock = stock - ?, doc = json_set(doc, '$.stock', stock - ?) WHERE id = ? AND stock >= ?`)
        .bind(l.quantity, l.quantity, l.productId, l.quantity),
    );
  }
  const results = await c.env.DB.batch(stmts);
  const oversold = results.some((r) => (r.meta?.changes ?? 0) === 0);
  if (oversold) {
    // Best-effort compensation: re-add stock for any line that did decrement.
    const undo = [];
    for (let i = 0; i < order.lines.length; i++) {
      if ((results[i].meta?.changes ?? 0) > 0) {
        const l = order.lines[i];
        undo.push(c.env.DB.prepare(`UPDATE products SET stock = stock + ?, doc = json_set(doc, '$.stock', stock + ?) WHERE id = ?`).bind(l.quantity, l.quantity, l.productId));
      }
    }
    if (undo.length) await c.env.DB.batch(undo);
    return c.json({ error: "out_of_stock", message: "insufficient stock for one or more items" }, 409);
  }

  await c.env.DB.prepare(`INSERT INTO orders (id, seller_id, doc) VALUES (?, ?, ?)`)
    .bind(order.id, order.sellerId, JSON.stringify(order))
    .run();
  await c.env.CACHE.delete(`storefront:${seller.handle}`);
  return c.json(order, 201);
});

catalog.get("/orders/:id", async (c) => {
  const row = await c.env.DB.prepare(`SELECT doc FROM orders WHERE id = ?`).bind(c.req.param("id")).first<{ doc: string }>();
  if (!row) return c.json({ error: "not_found", message: "order not found" }, 404);
  return c.json(JSON.parse(row.doc));
});

catalog.post("/orders/:id/mark-paid", async (c) => {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare(`SELECT doc FROM orders WHERE id = ?`).bind(id).first<{ doc: string }>();
  if (!row) return c.json({ error: "not_found", message: "order not found" }, 404);
  const order = JSON.parse(row.doc);
  const body = await c.req.json().catch(() => ({}));
  order.paymentIntentId = body.paymentIntentId ?? order.paymentIntentId;
  order.status = "paid";
  if (body.invoiceId) { order.invoiceId = body.invoiceId; order.status = "invoiced"; }
  await c.env.DB.prepare(`UPDATE orders SET doc = ? WHERE id = ?`).bind(JSON.stringify(order), id).run();
  return c.json(order);
});
