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
import { catalog } from "./catalog/routes.ts";
import { payments } from "./payments/routes.ts";

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
app.get("/", (c) => c.json({ status: "ok", products: ["catalog", "payments"] }));

// Auth middleware: constant-ish-time Basic Auth with public storefront reads.
app.use("*", async (c, next) => {
  const creds = parseCreds(c.env.API_USERS ?? "");
  if (creds.size === 0) return next(); // dev: auth disabled
  if (isPublic(c.req.method, new URL(c.req.url).pathname)) return next();

  const header = c.req.header("Authorization") ?? "";
  if (!checkBasic(header, creds)) {
    return c.json({ error: "unauthorized" }, 401, { "WWW-Authenticate": 'Basic realm="salesfactory"' });
  }
  return next();
});

app.route("/catalog", catalog);
app.route("/payments", payments);

export default app;

// --- auth helpers ---

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

  // Customer write actions (public): place an order, create/confirm/cancel a
  // payment. NOT mark-paid (that's a back-office/webhook action).
  if (method === "POST") {
    if (path === "/catalog/orders") return true;
    if (path === "/payments/payment_intents") return true;
    if (/^\/payments\/payment_intents\/[^/]+\/(confirm|cancel)$/.test(path)) return true;
    return false;
  }

  if (method !== "GET" && method !== "HEAD") return false;
  // Public reads: marketplace, product search, a storefront, an order, an intent.
  if (path === "/catalog/marketplace" || path === "/catalog/products") return true;
  if (/^\/catalog\/sellers\/[^/]+$/.test(path)) return true;        // GET /catalog/sellers/{handle}
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
