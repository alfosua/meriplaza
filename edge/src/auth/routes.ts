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
