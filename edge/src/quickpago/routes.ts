// QuickPago — a separate Meriplaza product for merchant payments
// (PagoMovil, National Transfer, Crypto). It has its own auth (qp_session
// cookie), data (qp_merchants/qp_sessions/qp_transactions), and portal UI,
// distinct from Meriplaza. It reuses the shared PBKDF2 hashing and the
// Meriplaza payment processors conceptually.

import { Hono } from "hono";
import type { Env } from "../lib/env.ts";
import { newID } from "../lib/env.ts";
import { hashPassword, verifyPassword } from "../auth/session.ts";
import { qpChargePage, qpLanding, qpPortal } from "./pages.ts";

export const quickpago = new Hono<{ Bindings: Env }>();

const COOKIE = "qp_session";
const DAYS = 30;
const randomHex = (n: number) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return [...a].map((b) => b.toString(16).padStart(2, "0")).join(""); };
function readCookie(h: string | undefined, name: string): string | null {
  if (!h) return null;
  for (const p of h.split(";")) { const [k, ...v] = p.trim().split("="); if (k === name) return v.join("="); }
  return null;
}
async function currentMerchant(env: Env, cookie: string | undefined) {
  const tok = readCookie(cookie, COOKIE); if (!tok) return null;
  const s = await env.DB.prepare(`SELECT merchant_id, expires FROM qp_sessions WHERE id=?`).bind(tok).first<any>();
  if (!s || s.expires < Date.now() / 1000) return null;
  const m = await env.DB.prepare(`SELECT id, business, rif, email, methods, status FROM qp_merchants WHERE id=?`).bind(s.merchant_id).first<any>();
  return m ? { ...m, methods: safe(m.methods) } : null;
}
function cookie(tok: string) { return `${COOKIE}=${tok}; HttpOnly; Secure; SameSite=Lax; Path=/quickpago; Max-Age=${DAYS * 86400}`; }
function safe(s: string) { try { return JSON.parse(s); } catch { return {}; } }

// --- SSR pages ---
quickpago.get("/", async (c) => c.html(qpLanding()));
quickpago.get("/portal", async (c) => {
  const m = await currentMerchant(c.env, c.req.header("Cookie"));
  let txns: any[] = [];
  if (m) {
    const r = await c.env.DB.prepare(`SELECT id, amount, currency, method, status, reference, payer, created_at FROM qp_transactions WHERE merchant_id=? ORDER BY created_at DESC LIMIT 50`).bind(m.id).all<any>();
    txns = r.results ?? [];
  }
  return c.html(qpPortal(m, txns));
});

quickpago.get("/c/:reference", async (c) => {
  const ref = c.req.param("reference").toUpperCase();
  const row = await c.env.DB.prepare(
    `SELECT t.id, t.merchant_id, t.amount, t.currency, t.method, t.status, t.reference, t.payer, t.created_at,
            m.business, m.rif, m.methods
       FROM qp_transactions t JOIN qp_merchants m ON m.id = t.merchant_id
      WHERE upper(t.reference)=?`,
  ).bind(ref).first<any>();
  if (!row) return c.html(qpNotFound(), 404);
  const tx = { id: row.id, amount: row.amount, currency: row.currency, method: row.method, status: row.status, reference: row.reference, payer: row.payer, created_at: row.created_at };
  const merchant = { id: row.merchant_id, business: row.business, rif: row.rif, methods: safe(row.methods) };
  const origin = new URL(c.req.url).origin;
  return c.html(qpChargePage({ tx, merchant, origin }));
});

// --- API ---
quickpago.post("/api/register", async (c) => {
  const b = await c.req.json().catch(() => null);
  if (!b || !b.email || !b.password || !b.business) return c.json({ error: "validation_failed", message: "negocio, correo y contraseña requeridos" }, 422);
  const email = String(b.email).toLowerCase();
  if (await c.env.DB.prepare(`SELECT 1 FROM qp_merchants WHERE email=?`).bind(email).first()) return c.json({ error: "conflict", message: "correo ya registrado" }, 409);
  const { hash, salt } = await hashPassword(String(b.password));
  const id = newID("qpm");
  await c.env.DB.prepare(`INSERT INTO qp_merchants (id, business, rif, email, pass_hash, pass_salt, methods) VALUES (?,?,?,?,?,?,?)`)
    .bind(id, b.business, b.rif ?? "", email, hash, salt, "{}").run();
  const tok = randomHex(32);
  await c.env.DB.prepare(`INSERT INTO qp_sessions (id, merchant_id, expires) VALUES (?,?,?)`).bind(tok, id, Math.floor(Date.now() / 1000) + DAYS * 86400).run();
  return c.json({ id, business: b.business }, 201, { "Set-Cookie": cookie(tok) });
});

quickpago.post("/api/login", async (c) => {
  const b = await c.req.json().catch(() => null);
  if (!b?.email || !b?.password) return c.json({ error: "validation_failed" }, 422);
  const m = await c.env.DB.prepare(`SELECT id, pass_hash, pass_salt FROM qp_merchants WHERE email=?`).bind(String(b.email).toLowerCase()).first<any>();
  if (!m || !(await verifyPassword(String(b.password), m.pass_salt, m.pass_hash))) return c.json({ error: "invalid_credentials", message: "credenciales inválidas" }, 401);
  const tok = randomHex(32);
  await c.env.DB.prepare(`INSERT INTO qp_sessions (id, merchant_id, expires) VALUES (?,?,?)`).bind(tok, m.id, Math.floor(Date.now() / 1000) + DAYS * 86400).run();
  return c.json({ ok: true }, 200, { "Set-Cookie": cookie(tok) });
});

quickpago.post("/api/logout", async (c) => {
  const tok = readCookie(c.req.header("Cookie"), COOKIE);
  if (tok) await c.env.DB.prepare(`DELETE FROM qp_sessions WHERE id=?`).bind(tok).run();
  return c.json({ ok: true }, 200, { "Set-Cookie": `${COOKIE}=; Path=/quickpago; Max-Age=0` });
});

quickpago.post("/api/methods", async (c) => {
  const m = await currentMerchant(c.env, c.req.header("Cookie"));
  if (!m) return c.json({ error: "unauthorized" }, 401);
  const b = await c.req.json().catch(() => ({}));
  const methods = {
    pagomovil: b.pagomovil || null,   // { bank, phone, ci }
    transfer: b.transfer || null,     // { bank, account, holder }
    crypto: b.crypto || null,         // { network, asset, address }
  };
  await c.env.DB.prepare(`UPDATE qp_merchants SET methods=? WHERE id=?`).bind(JSON.stringify(methods), m.id).run();
  return c.json({ ok: true, methods });
});

// Create a charge (cobro). Produces a reference the payer can use; status flows
// pending -> proof_submitted -> confirmed, or closes as canceled/expired.
quickpago.post("/api/charge", async (c) => {
  const m = await currentMerchant(c.env, c.req.header("Cookie"));
  if (!m) return c.json({ error: "unauthorized" }, 401);
  const b = await c.req.json().catch(() => ({}));
  if (!b.amount || !b.method) return c.json({ error: "validation_failed", message: "monto y método requeridos" }, 422);
  const id = newID("qptx");
  const reference = "QP-" + id.slice(-8).toUpperCase();
  await c.env.DB.prepare(`INSERT INTO qp_transactions (id, merchant_id, amount, currency, method, status, reference, payer) VALUES (?,?,?,?,?,?,?,?)`)
    .bind(id, m.id, String(b.amount), b.currency ?? "VES", b.method, "pending", reference, b.payer ?? "").run();
  return c.json({ id, reference, status: "pending" }, 201);
});

quickpago.post("/api/pay/:reference", async (c) => {
  const ref = c.req.param("reference").toUpperCase();
  const b = await c.req.json().catch(() => ({}));
  if (!b.proof) return c.json({ error: "validation_failed", message: "referencia requerida" }, 422);
  const payer = {
    name: String(b.payerName ?? "").slice(0, 80),
    contact: String(b.payerContact ?? "").slice(0, 120),
    proof: String(b.proof ?? "").slice(0, 160),
    reportedAt: new Date().toISOString(),
  };
  const r = await c.env.DB.prepare(`UPDATE qp_transactions SET payer=?, status='proof_submitted' WHERE upper(reference)=? AND status IN ('pending','proof_submitted')`)
    .bind(JSON.stringify(payer), ref).run();
  if ((r.meta?.changes ?? 0) === 0) return c.json({ error: "not_found", message: "cobro no encontrado o ya cerrado" }, 404);
  return c.json({ ok: true, status: "proof_submitted", message: "Comprobante enviado. El comercio confirmará el pago." });
});

quickpago.post("/api/tx/:id/confirm", async (c) => {
  const m = await currentMerchant(c.env, c.req.header("Cookie"));
  if (!m) return c.json({ error: "unauthorized" }, 401);
  const r = await c.env.DB.prepare(`UPDATE qp_transactions SET status='confirmed' WHERE id=? AND merchant_id=? AND status IN ('pending','proof_submitted')`)
    .bind(c.req.param("id"), m.id).run();
  if ((r.meta?.changes ?? 0) === 0) return c.json({ error: "not_found", message: "cobro no encontrado o ya cerrado" }, 404);
  return c.json({ ok: true, status: "confirmed" });
});

quickpago.post("/api/tx/:id/cancel", async (c) => {
  const m = await currentMerchant(c.env, c.req.header("Cookie"));
  if (!m) return c.json({ error: "unauthorized" }, 401);
  const r = await c.env.DB.prepare(`UPDATE qp_transactions SET status='canceled' WHERE id=? AND merchant_id=? AND status IN ('pending','proof_submitted')`)
    .bind(c.req.param("id"), m.id).run();
  if ((r.meta?.changes ?? 0) === 0) return c.json({ error: "not_found", message: "cobro no encontrado o ya cerrado" }, 404);
  return c.json({ ok: true, status: "canceled" });
});

quickpago.post("/api/tx/:id/expire", async (c) => {
  const m = await currentMerchant(c.env, c.req.header("Cookie"));
  if (!m) return c.json({ error: "unauthorized" }, 401);
  const r = await c.env.DB.prepare(`UPDATE qp_transactions SET status='expired' WHERE id=? AND merchant_id=? AND status IN ('pending','proof_submitted')`)
    .bind(c.req.param("id"), m.id).run();
  if ((r.meta?.changes ?? 0) === 0) return c.json({ error: "not_found", message: "cobro no encontrado o ya cerrado" }, 404);
  return c.json({ ok: true, status: "expired" });
});

function qpNotFound(): string {
  return `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/assets/app.css">
  <div class="container" style="text-align:center;padding:5rem 1rem">
    <h1>Cobro no encontrado</h1>
    <p class="muted">Revisa el link de QuickPago o pide uno nuevo al comercio.</p>
    <a class="btn btn--primary" href="/quickpago">Volver a QuickPago</a>
  </div>`;
}
