// Auth routes: register, login, logout, me. Customers and stores self-register;
// a store registration also provisions a seller and links it to the user.

import { Hono } from "hono";
import type { Env } from "../lib/env.ts";
import { newID, nowISO } from "../lib/env.ts";
import { hashPassword, verifyPassword, createSession, sessionCookie, clearCookie, currentUser, destroySession } from "./session.ts";

export const auth = new Hono<{ Bindings: Env }>();

const emailOk = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

auth.post("/register", async (c) => {
  const b = await c.req.json().catch(() => null);
  if (!b || !emailOk(b.email || "") || !b.password || String(b.password).length < 6) {
    return c.json({ error: "validation_failed", message: "email válido y contraseña de 6+ caracteres requeridos" }, 422);
  }
  const role = b.role === "store" ? "store" : "customer";
  const email = String(b.email).toLowerCase();
  const exists = await c.env.DB.prepare(`SELECT 1 FROM users WHERE email = ?`).bind(email).first();
  if (exists) return c.json({ error: "conflict", message: "ese correo ya está registrado" }, 409);

  const { hash, salt } = await hashPassword(String(b.password));
  const id = newID("usr");
  let sellerId = "";

  if (role === "store") {
    // Provision a seller for the store account.
    const handle = (b.handle ? String(b.handle) : String(b.storeName || b.name || "tienda"))
      .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "tienda";
    sellerId = newID("sel");
    const seller = { id: sellerId, handle: `${handle}-${sellerId.slice(-4)}`, name: b.storeName || b.name || "Mi Tienda",
      kind: b.kind || "store", taxId: b.taxId || "", merchantId: `m_${sellerId}`,
      theme: { primaryColor: b.primaryColor || "#1b39c9", accentColor: b.accentColor || "#ff5a3c", tagline: b.tagline || "", layout: "grid" },
      socials: {}, currency: b.currency || "VES", createdAt: nowISO() };
    await c.env.DB.prepare(`INSERT INTO sellers (id, handle, doc) VALUES (?,?,?)`).bind(seller.id, seller.handle, JSON.stringify(seller)).run();
    await c.env.CACHE.delete("marketplace");
  }

  await c.env.DB.prepare(`INSERT INTO users (id, email, name, role, pass_hash, pass_salt, seller_id, phone) VALUES (?,?,?,?,?,?,?,?)`)
    .bind(id, email, b.name || "", role, hash, salt, sellerId, b.phone || "").run();

  const token = await createSession(c.env, { id, role });
  return c.json({ id, email, name: b.name || "", role, sellerId }, 201, { "Set-Cookie": sessionCookie(token) });
});

auth.post("/login", async (c) => {
  const b = await c.req.json().catch(() => null);
  if (!b || !b.email || !b.password) return c.json({ error: "validation_failed" }, 422);
  const u = await c.env.DB.prepare(`SELECT id, email, name, role, pass_hash, pass_salt, seller_id FROM users WHERE email = ?`)
    .bind(String(b.email).toLowerCase()).first<any>();
  if (!u || !(await verifyPassword(String(b.password), u.pass_salt, u.pass_hash))) {
    return c.json({ error: "invalid_credentials", message: "correo o contraseña incorrectos" }, 401);
  }
  const token = await createSession(c.env, { id: u.id, role: u.role });
  return c.json({ id: u.id, email: u.email, name: u.name, role: u.role, sellerId: u.seller_id }, 200, { "Set-Cookie": sessionCookie(token) });
});

auth.post("/logout", async (c) => {
  await destroySession(c.env, c.req.header("Cookie"));
  return c.json({ ok: true }, 200, { "Set-Cookie": clearCookie() });
});

auth.get("/me", async (c) => {
  const u = await currentUser(c.env, c.req.header("Cookie"));
  if (!u) return c.json({ user: null });
  return c.json({ user: u });
});

auth.get("/profile", async (c) => {
  const u = await currentUser(c.env, c.req.header("Cookie"));
  if (!u) return c.json({ user: null, profile: null });
  const profile = await loadProfile(c.env, u.id);
  return c.json({ user: u, profile });
});

auth.post("/profile", async (c) => {
  const u = await currentUser(c.env, c.req.header("Cookie"));
  if (!u) return c.json({ error: "unauthorized" }, 401);
  const b = await c.req.json().catch(() => ({}));
  // Merge: only overwrite the sections present in the request so a partial save
  // (e.g. just the home location) doesn't erase saved addresses/fiscal data.
  const existing = await loadProfile(c.env, u.id);
  const incoming = normalizeProfile(b);
  const profile: any = { ...existing };
  if (Array.isArray(b.addresses)) profile.addresses = incoming.addresses;
  if (Array.isArray(b.fiscalProfiles)) profile.fiscalProfiles = incoming.fiscalProfiles;
  if (b.home !== undefined) {
    if (incoming.home) profile.home = incoming.home; else delete profile.home;
  }
  profile.addresses = profile.addresses || [];
  profile.fiscalProfiles = profile.fiscalProfiles || [];
  await c.env.DB.prepare(
    `INSERT INTO user_profiles (user_id, doc, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET doc=excluded.doc, updated_at=datetime('now')`,
  ).bind(u.id, JSON.stringify(profile)).run();
  const headers: Record<string, string> = {};
  if (profile.home) {
    headers["Set-Cookie"] = `mp_home=${encodeURIComponent(JSON.stringify(profile.home))}; Path=/; Max-Age=15552000; SameSite=Lax`;
  }
  return c.json({ ok: true, profile }, 200, headers);
});

async function loadProfile(env: Env, userId: string) {
  const row = await env.DB.prepare(`SELECT doc FROM user_profiles WHERE user_id=?`).bind(userId).first<{ doc: string }>();
  return row ? safeProfile(row.doc) : { addresses: [], fiscalProfiles: [] };
}

function safeProfile(s: string) {
  try { return normalizeProfile(JSON.parse(s)); } catch { return { addresses: [], fiscalProfiles: [] }; }
}

function normalizeProfile(b: any) {
  const addresses = Array.isArray(b.addresses) ? b.addresses.map((a: any, i: number) => ({
    id: String(a.id || `addr_${i + 1}`).slice(0, 40),
    label: String(a.label || "Principal").slice(0, 60),
    recipient: String(a.recipient || "").slice(0, 100),
    phone: String(a.phone || "").slice(0, 40),
    city: String(a.city || "").slice(0, 80),
    address1: String(a.address1 || "").slice(0, 240),
    notes: String(a.notes || "").slice(0, 240),
    isDefault: !!a.isDefault,
  })).filter((a: any) => a.city || a.address1 || a.recipient).slice(0, 5) : [];
  const fiscalProfiles = Array.isArray(b.fiscalProfiles) ? b.fiscalProfiles.map((f: any, i: number) => ({
    id: String(f.id || `fiscal_${i + 1}`).slice(0, 40),
    label: String(f.label || "Personal").slice(0, 60),
    name: String(f.name || "").slice(0, 120),
    taxId: String(f.taxId || "").slice(0, 40),
    email: String(f.email || "").slice(0, 120),
    fiscalAddress: String(f.fiscalAddress || "").slice(0, 240),
    isDefault: !!f.isDefault,
  })).filter((f: any) => f.name || f.taxId || f.email).slice(0, 5) : [];
  markOneDefault(addresses);
  markOneDefault(fiscalProfiles);
  const home = normalizeHome(b.home);
  return { addresses, fiscalProfiles, ...(home ? { home } : {}) };
}

function normalizeHome(h: any) {
  if (!h || typeof h !== "object") return null;
  const lat = Number(h.lat), lng = Number(h.lng);
  const label = String(h.label || "").slice(0, 160);
  const city = String(h.city || "").slice(0, 80);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (!label && !city)) return null;
  return { lat, lng, label, city };
}

function markOneDefault(items: Array<{ isDefault: boolean }>) {
  if (!items.length) return;
  const first = items.findIndex((x) => x.isDefault);
  items.forEach((x, i) => { x.isDefault = i === (first >= 0 ? first : 0); });
}
