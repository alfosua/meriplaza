// SalesFactory edge backend: ecommerce + payment gateway on Cloudflare Workers
// (free plan) backed by D1 + KV. A single Worker mounts both products.
//
//   /catalog/*   -> sellers, products, orders (storefront reads cached in KV)
//   /payments/*  -> payment intents
//
// Auth: HTTP Basic Auth from API_USERS ("user:pass,..."), except public
// storefront reads (GET /catalog/sellers/{handle}) and /healthz.

import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./lib/env.ts";
import { catalog, listProducts, countProducts, getProduct, getStorefront, marketplaceData, supermarketData } from "./catalog/routes.ts";
import { payments } from "./payments/routes.ts";
import { APP_CSS } from "./ssr/theme.ts";
import { APP_JS } from "./ssr/app-js.ts";
import { cartPage, homePage, orderPage, productPage, sellerLandingPage, storePage, storesPage, productCardsHtml } from "./ssr/pages.ts";
import { accountPage, adminPage, storeDashboardPage, superAdminPage } from "./ssr/account.ts";
import { supermarketPage, compareCardsHtml } from "./ssr/supermarket.ts";
import { auth } from "./auth/routes.ts";
import { currentUser } from "./auth/session.ts";
import { getRate, approxAlt } from "./lib/fx.ts";
import { quickpago } from "./quickpago/routes.ts";

const app = new Hono<{ Bindings: Env }>();

// Browser storefronts call this API cross-origin. Allow it; auth still gates
// writes via the Authorization header.
app.use("*", cors({
  origin: (o) => o ?? "*",
  allowMethods: ["GET", "HEAD", "POST", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
  maxAge: 86400,
}));

app.get("/healthz", (c) => c.json({ status: "ok", products: ["catalog", "payments"] }));

// --- Static assets (long-cached) ---
app.get("/assets/app.css", (c) => c.body(APP_CSS, 200, { "content-type": "text/css; charset=utf-8", "cache-control": "public, max-age=3600" }));
app.get("/assets/app.js", (c) => c.body(APP_JS, 200, { "content-type": "text/javascript; charset=utf-8", "cache-control": "public, max-age=3600" }));

// --- Server-rendered pages (public, defined before the auth gate) ---
function readCookieVal(h: string | undefined, name: string): string {
  if (!h) return "";
  for (const part of h.split(";")) { const [k, ...v] = part.trim().split("="); if (k === name) return decodeURIComponent(v.join("=")); }
  return "";
}
const withAlt = (rate: any) => (p: any) => ({ ...p, alt: approxAlt(p.minPrice ?? p.price, p.currency, rate) });

const PAGE_SIZE = 48;
app.get("/", async (c) => {
  const q = c.req.query("q") || "", category = c.req.query("category") || "";
  const store = c.req.query("store") || "", sort = c.req.query("sort") || "";
  const city = c.req.query("city") || readCookieVal(c.req.header("Cookie"), "mp_city");
  const page = Math.max(1, parseInt(c.req.query("page") || "1", 10) || 1);
  const browsing = !q && !category && !store;
  const home1 = browsing && page === 1; // show promo material only on the landing
  const filter = { q, category, store, city, sort };
  const railList = (cat: string, s: string) => home1 ? listProducts(c.env, { category: cat, city, sort: s, limit: 12 }) : Promise.resolve([]);
  const [products, total, featured, alimentos, tecnologia, hogar, bebidas, mk, rate] = await Promise.all([
    listProducts(c.env, { ...filter, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    countProducts(c.env, filter),
    home1 ? listProducts(c.env, { featured: true, limit: 12 }) : Promise.resolve([]),
    railList("Alimentos", "price_asc"), railList("Tecnología", "rating"), railList("Hogar", ""), railList("Bebidas", ""),
    marketplaceData(c.env), getRate(c.env),
  ]);
  const add = withAlt(rate);
  const cityName = mk.cities.find((x: any) => x.slug === city)?.name || "Caracas";
  const rails = home1 ? [
    { title: "🍞 Mercado: lo esencial", href: "/?category=Alimentos", products: alimentos.map(add) },
    { title: "📱 Tecnología destacada", href: "/?category=Tecnolog%C3%ADa", products: tecnologia.map(add) },
    { title: "🏠 Para tu hogar", href: "/?category=Hogar", products: hogar.map(add) },
  ].filter((r) => r.products.length) : [];
  const bundles = home1 ? [
    makeBundle("Combo Despensa Básica", alimentos, "/?category=Alimentos"),
    makeBundle("Combo Refresca tu Día", bebidas, "/?category=Bebidas"),
    makeBundle("Combo Hogar Limpio", hogar, "/?category=Hogar"),
  ].filter(Boolean) : [];
  // Playful "bento" mosaics — a fun headline tile next to a few real products.
  const mosaics = home1 ? [
    { emoji: "🫓", title: "Para la arepa perfecta", sub: "Harina, queso y todo lo que falta", tone: "warm", ctaLabel: "Llenar la despensa", href: "/?category=Alimentos", products: alimentos.slice(2, 6).map(add) },
    { emoji: "🌙", title: "Antojos de medianoche", sub: "Snacks y bebidas para cualquier hora", tone: "grape", ctaLabel: "Ver bebidas", href: "/?category=Bebidas", products: bebidas.slice(0, 4).map(add) },
    { emoji: "🎮", title: "Tech que vas a amar", sub: "Gadgets y accesorios al mejor precio", tone: "cool", ctaLabel: "Explorar tecnología", href: "/?category=Tecnolog%C3%ADa", products: tecnologia.slice(0, 4).map(add) },
  ].filter((m) => m.products.length >= 4) : [];
  return c.html(homePage({
    products: products.map(add), featured: featured.map(add),
    sellers: mk.sellers, categories: mk.categories, cities: mk.cities, promotions: mk.promotions,
    q, category, store, city, cityName, sort, rate, rails, bundles, mosaics,
    page, pages: Math.ceil(total / PAGE_SIZE), total,
  }));
});

// Build a 3-item "combo" bundle card from a product list, with a small bundle
// discount vs. buying separately.
function makeBundle(title: string, products: any[], href: string): any | null {
  const items = (products || []).slice(0, 3).filter((p) => p.minPrice != null);
  if (items.length < 3) return null;
  const sum = items.reduce((s, p) => s + parseFloat(p.minPrice), 0);
  const total = sum * 0.9; // 10% combo discount
  return {
    title, href, currency: items[0].currency || "VES",
    items: items.map((p) => ({ title: p.title, image: p.image, price: p.minPrice })),
    total: total.toFixed(2), compareTotal: sum.toFixed(2), savings: 10,
  };
}
app.get("/p/:slug", async (c) => {
  const p = await getProduct(c.env, c.req.param("slug"));
  if (!p) return c.html(notFound(), 404);
  const [mk, rate] = await Promise.all([marketplaceData(c.env), getRate(c.env)]);
  // attach dual-currency strings + related products
  p.offers = p.offers.map((o: any) => ({ ...o, alt: approxAlt(o.price, o.currency, rate) }));
  const related = (await listProducts(c.env, { category: p.category, limit: 6 })).filter((r: any) => r.slug !== p.slug).slice(0, 5).map(withAlt(rate));
  return c.html(productPage(p, mk.categories, { rate, related, cities: mk.cities }));
});
app.get("/tiendas", async (c) => {
  const mk = await marketplaceData(c.env);
  return c.html(storesPage(mk.sellers, mk.categories, mk.cities));
});
app.get("/t/:handle", async (c) => {
  const sf = await getStorefront(c.env, c.req.param("handle"));
  if (!sf) return c.html(notFound(), 404);
  const [mk, rate] = await Promise.all([marketplaceData(c.env), getRate(c.env)]);
  sf.products = sf.products.map((o: any) => ({ ...o, alt: approxAlt(o.price, o.currency, rate) }));
  return c.html(storePage(sf, mk.categories, mk.cities));
});
// Persist the chosen delivery city, then return to referrer.
app.get("/set-city/:slug", (c) => {
  const slug = c.req.param("slug");
  const back = c.req.query("back") || "/";
  return c.body(null, 302, { "Set-Cookie": `mp_city=${encodeURIComponent(slug)}; Path=/; Max-Age=15552000; SameSite=Lax`, "Location": back });
});

app.get("/vender", (c) => c.html(sellerLandingPage()));
app.get("/comercios", (c) => c.html(sellerLandingPage()));

app.get("/carrito", async (c) => {
  const mk = await marketplaceData(c.env);
  return c.html(cartPage(mk.cities));
});

app.get("/pedido/:id", async (c) => {
  const row = await c.env.DB.prepare(`SELECT doc FROM orders WHERE id=?`).bind(c.req.param("id")).first<{ doc: string }>();
  if (!row) return c.html(notFound(), 404);
  const ids = (c.req.query("ids") || c.req.param("id")).split(",").map((x) => x.trim()).filter(Boolean);
  return c.html(orderPage(JSON.parse(row.doc), ids));
});

// Account, admin, store dashboard (render login/forbidden when unauthenticated).
app.get("/cuenta", async (c) => {
  const u = await currentUser(c.env, c.req.header("Cookie"));
  let orders: any[] = [];
  let profile: any = { addresses: [], fiscalProfiles: [] };
  if (u) {
    const [rows, profileRow] = await Promise.all([
      c.env.DB.prepare(`SELECT doc FROM orders ORDER BY created_at DESC LIMIT 200`).all<{ doc: string }>(),
      c.env.DB.prepare(`SELECT doc FROM user_profiles WHERE user_id=?`).bind(u.id).first<{ doc: string }>(),
    ]);
    orders = (rows.results ?? []).map((r) => JSON.parse(r.doc)).filter((o) => o.userId === u.id).slice(0, 25);
    if (profileRow) { try { profile = JSON.parse(profileRow.doc); } catch {} }
  }
  return c.html(accountPage(u, orders, profile, { mapsKey: c.env.GOOGLE_MAPS_API_KEY || "" }));
});

// Read the home-location cookie (JSON: {lat,lng,label,city}) set by the picker.
function readHome(cookie: string | undefined): { lat?: number; lng?: number; label?: string; city?: string } {
  const raw = readCookieVal(cookie, "mp_home");
  if (!raw) return {};
  try { const h = JSON.parse(raw); return { lat: Number(h.lat), lng: Number(h.lng), label: h.label, city: h.city }; }
  catch { return {}; }
}

// Supermarket mode: nearby stores + grocery price comparison.
app.get("/super", async (c) => {
  const home = readHome(c.req.header("Cookie"));
  const cityCookie = readCookieVal(c.req.header("Cookie"), "mp_city");
  const stores = (c.req.query("stores") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const q = c.req.query("q") || "", category = c.req.query("category") || "";
  const sort = c.req.query("sort") || "";
  const certified = c.req.query("certified") === "1", instant = c.req.query("instant") === "1", inStock = c.req.query("instock") === "1";
  const superPageSize = 60;
  const page = Math.max(1, parseInt(c.req.query("page") || "1", 10) || 1);
  const [mk, rate] = await Promise.all([marketplaceData(c.env), getRate(c.env)]);
  const cityName = home.city || mk.cities.find((x: any) => x.slug === cityCookie)?.name || "";
  const data = await supermarketData(c.env, {
    lat: home.lat, lng: home.lng, cityName, stores, q, category,
    sort, certified, instant, inStock,
    limit: superPageSize, offset: (page - 1) * superPageSize,
  });
  return c.html(supermarketPage({
    ...data, q, category, selectedStores: stores, rate,
    sort, certified, instant, inStock,
    cities: mk.cities, cityName: cityName || data.home.cityName || "Caracas",
    home, mapsKey: c.env.GOOGLE_MAPS_API_KEY || "",
    page, pages: Math.ceil((data.total ?? 0) / superPageSize), total: data.total ?? 0, totalStores: data.totalStores ?? data.stores.length,
  }));
});

// Infinite-scroll partials: return just the next page of product-card HTML so
// app.js can append it (progressive loading instead of pagination).
app.get("/partials/products", async (c) => {
  const page = Math.max(1, parseInt(c.req.query("page") || "1", 10) || 1);
  const city = c.req.query("city") || readCookieVal(c.req.header("Cookie"), "mp_city");
  const [items, rate] = await Promise.all([
    listProducts(c.env, {
      q: c.req.query("q") || "", category: c.req.query("category") || "",
      store: c.req.query("store") || "", city, sort: c.req.query("sort") || "",
      limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE,
    }),
    getRate(c.env),
  ]);
  return c.html(productCardsHtml(items.map(withAlt(rate))));
});

app.get("/partials/supermarket", async (c) => {
  const home = readHome(c.req.header("Cookie"));
  const cityCookie = readCookieVal(c.req.header("Cookie"), "mp_city");
  const stores = (c.req.query("stores") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const page = Math.max(1, parseInt(c.req.query("page") || "1", 10) || 1);
  const size = 60;
  const data = await supermarketData(c.env, {
    lat: home.lat, lng: home.lng, cityName: home.city || cityCookie || "",
    stores, q: c.req.query("q") || "", category: c.req.query("category") || "",
    sort: c.req.query("sort") || "", certified: c.req.query("certified") === "1",
    instant: c.req.query("instant") === "1", inStock: c.req.query("instock") === "1",
    limit: size, offset: (page - 1) * size,
  });
  return c.html(compareCardsHtml(data.products));
});

// Superuser content-management portal for well-known products.
app.get("/super-admin", async (c) => {
  const u = await currentUser(c.env, c.req.header("Cookie"));
  if (!u || u.role !== "admin") return c.html(accountPage(u, [], { addresses: [], fiscalProfiles: [] }, { mapsKey: c.env.GOOGLE_MAPS_API_KEY || "" }));
  const q = c.req.query("q") || "";
  const curatedFirst = await listProducts(c.env, { q, limit: 60 });
  const [mk] = await Promise.all([marketplaceData(c.env)]);
  return c.html(superAdminPage(u, { products: curatedFirst, q, categories: mk.categories }));
});

app.get("/admin", (c) => c.redirect("/comercios", 302));

app.get("/comercios/portal", async (c) => {
  const u = await currentUser(c.env, c.req.header("Cookie"));
  if (!u || u.role !== "admin") return c.html(adminPage(u, { stores: [], products: [], orders: [], stats: {} }));
  const [stores, products, orders, counts] = await Promise.all([
    c.env.DB.prepare(`SELECT id, doc FROM sellers`).all<any>(),
    c.env.DB.prepare(`SELECT id, title FROM products ORDER BY title`).all<any>(),
    c.env.DB.prepare(`SELECT doc FROM orders ORDER BY created_at DESC LIMIT 12`).all<{ doc: string }>(),
    c.env.DB.prepare(`SELECT (SELECT COUNT(*) FROM sellers) s,(SELECT COUNT(*) FROM products) p,(SELECT COUNT(*) FROM offers) o,(SELECT COUNT(*) FROM orders) r`).first<any>(),
  ]);
  const orderDocs = (orders.results ?? []).map((r) => JSON.parse(r.doc));
  const sales: Record<string, number> = {};
  const allOrders = await c.env.DB.prepare(`SELECT doc FROM orders`).all<{ doc: string }>();
  for (const r of allOrders.results ?? []) { const o = JSON.parse(r.doc); if (o.status !== "pending") sales[o.currency] = (sales[o.currency] || 0) + parseFloat(o.grandTotal); }
  const salesText = Object.entries(sales).map(([c2, v]) => `${v.toFixed(0)} ${c2}`).join(" · ") || "—";
  return c.html(adminPage(u, {
    stores: (stores.results ?? []).map((r) => ({ id: r.id, ...JSON.parse(r.doc) })),
    products: products.results ?? [], orders: orderDocs,
    stats: { stores: counts.s, products: counts.p, offers: counts.o, orders: counts.r, salesText },
  }));
});

app.get("/tienda/panel", async (c) => {
  const u = await currentUser(c.env, c.req.header("Cookie"));
  if (!u || (u.role !== "store" && u.role !== "admin")) return c.html(storeDashboardPage(u, { seller: null, products: [], offers: [], orders: [], allProducts: [] }));
  const sellerRow = await c.env.DB.prepare(`SELECT id, doc FROM sellers WHERE id = ?`).bind(u.sellerId).first<any>();
  const seller = sellerRow ? { id: sellerRow.id, ...JSON.parse(sellerRow.doc) } : null;
  const offers = seller ? await c.env.DB.prepare(
    `SELECT o.price, o.currency, o.stock, p.title FROM offers o JOIN products p ON p.id=o.product_id WHERE o.seller_id=? AND o.active=1`).bind(seller.id).all<any>() : { results: [] };
  const orders = seller ? await c.env.DB.prepare(`SELECT doc FROM orders WHERE seller_id=? ORDER BY created_at DESC LIMIT 50`).bind(seller.id).all<{ doc: string }>() : { results: [] };
  const allProducts = await c.env.DB.prepare(`SELECT id, title FROM products ORDER BY title`).all<any>();
  return c.html(storeDashboardPage(u, {
    seller, products: [], offers: offers.results ?? [],
    orders: (orders.results ?? []).map((r) => JSON.parse(r.doc)), allProducts: allProducts.results ?? [],
  }));
});

// Auth gate for management writes. Order of precedence:
//  1. Public customer/browse routes pass through.
//  2. Basic Auth (machine/seed) passes.
//  3. A logged-in admin passes; a logged-in store passes for catalog writes.
app.use("*", async (c, next) => {
  const path = new URL(c.req.url).pathname;
  if (isPublic(c.req.method, path)) return next();

  const creds = parseCreds(c.env.API_USERS ?? "");
  if (creds.size === 0) return next(); // dev: auth disabled
  if (checkBasic(c.req.header("Authorization") ?? "", creds)) return next();

  const user = await currentUser(c.env, c.req.header("Cookie"));
  if (user?.role === "admin") return next();
  if (user?.role === "store" && c.req.method === "POST" &&
      (path === "/catalog/offers" || path === "/catalog/products" ||
       /^\/catalog\/orders\/[^/]+\/fulfillment$/.test(path) ||
       /^\/catalog\/sellers\/[^/]+\/payment-methods$/.test(path))) return next();

  return c.json({ error: "unauthorized" }, 401, { "WWW-Authenticate": 'Basic realm="salesfactory"' });
});

app.route("/auth", auth);
app.route("/quickpago", quickpago);
app.route("/catalog", catalog);
app.route("/payments", payments);

export default app;

// --- auth helpers ---

function notFound(): string {
  return `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/assets/app.css">
  <div class="container" style="text-align:center;padding:5rem 1rem">
    <h1 style="font-size:3rem;margin:0">404</h1>
    <p class="muted">No encontramos lo que buscabas.</p>
    <a class="btn btn--primary" href="/">Volver a Meriplaza</a>
  </div>`;
}

function parseCreds(v: string): Map<string, string> {
  const m = new Map<string, string>();
  for (const pair of v.split(",")) {
    const t = pair.trim();
    if (!t) continue;
    const i = t.indexOf(":");
    if (i > 0) m.set(t.slice(0, i), t.slice(i + 1));
  }
  return m;
}

// Auth model: store/catalog *management* (creating sellers, products, marking
// orders paid) requires the admin credential. *Customer-facing* actions —
// browsing, placing an order, and paying — are public, like a Stripe
// publishable key. Orders/intents are addressed by unguessable ids.
function isPublic(method: string, path: string): boolean {
  if (path === "/healthz" || path === "/") return true;

  // Auth endpoints and the QuickPago product manage their own credentials.
  if (path.startsWith("/auth/")) return true;
  if (path === "/quickpago" || path.startsWith("/quickpago/")) return true;

  // Customer write actions (public): place an order, create/confirm/cancel a
  // payment, write a product review. NOT mark-paid (back-office/webhook).
  if (method === "POST") {
    if (path === "/catalog/orders") return true;
    if (path === "/catalog/checkout") return true;
    if (/^\/catalog\/products\/[^/]+\/reviews$/.test(path)) return true;
    if (path === "/payments/payment_intents") return true;
    if (/^\/payments\/payment_intents\/[^/]+\/(confirm|cancel)$/.test(path)) return true;
    return false;
  }

  if (method !== "GET" && method !== "HEAD") return false;
  // Public reads: marketplace, product search/detail, storefront, order, intent.
  if (path === "/catalog/marketplace" || path === "/catalog/products") return true;
  if (path === "/catalog/supermarket") return true;
  if (/^\/catalog\/products\/[^/]+$/.test(path)) return true;        // GET /catalog/products/{slug}
  if (/^\/catalog\/sellers\/[^/]+$/.test(path)) return true;        // GET /catalog/sellers/{handle}
  if (/^\/catalog\/sellers\/by-id\/[^/]+\/payment-methods$/.test(path)) return true;
  if (/^\/catalog\/orders\/[^/]+$/.test(path)) return true;          // GET /catalog/orders/{id}
  if (/^\/payments\/payment_intents\/[^/]+$/.test(path)) return true; // GET /payments/payment_intents/{id}
  return false;
}

function checkBasic(header: string, creds: Map<string, string>): boolean {
  if (!header.startsWith("Basic ")) return false;
  let decoded: string;
  try { decoded = atob(header.slice(6).trim()); } catch { return false; }
  const i = decoded.indexOf(":");
  if (i < 0) return false;
  const user = decoded.slice(0, i);
  const pass = decoded.slice(i + 1);
  const want = creds.get(user);
  return want !== undefined && timingSafeEqual(pass, want);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
