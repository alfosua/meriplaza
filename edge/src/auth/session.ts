// Authentication primitives for Meriplaza: PBKDF2 password hashing (Web Crypto,
// available in Workers) and D1-backed sessions carried in an HttpOnly cookie.

import type { Env } from "../lib/env.ts";

const ITERATIONS = 100_000;
const COOKIE = "mp_session";
const SESSION_DAYS = 30;

export interface SessionUser { id: string; email: string; name: string; role: string; sellerId: string; }

const enc = new TextEncoder();
const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
function randomHex(bytes: number): string {
  const a = new Uint8Array(bytes); crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashPassword(password: string, saltHex = randomHex(16)): Promise<{ hash: string; salt: string }> {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(saltHex), iterations: ITERATIONS, hash: "SHA-256" }, key, 256);
  return { hash: toHex(bits), salt: saltHex };
}

export async function verifyPassword(password: string, saltHex: string, hashHex: string): Promise<boolean> {
  const { hash } = await hashPassword(password, saltHex);
  // constant-time-ish compare
  if (hash.length !== hashHex.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ hashHex.charCodeAt(i);
  return diff === 0;
}

export async function createSession(env: Env, user: { id: string; role: string }): Promise<string> {
  const token = randomHex(32);
  const expires = Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400;
  await env.DB.prepare(`INSERT INTO sessions (id, user_id, role, expires) VALUES (?,?,?,?)`)
    .bind(token, user.id, user.role, expires).run();
  return token;
}

export function sessionCookie(token: string): string {
  return `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 86400}`;
}
export function clearCookie(): string {
  return `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

/** Resolve the current user from the session cookie, or null. */
export async function currentUser(env: Env, cookieHeader: string | undefined): Promise<SessionUser | null> {
  const token = readCookie(cookieHeader, COOKIE);
  if (!token) return null;
  const s = await env.DB.prepare(`SELECT user_id, expires FROM sessions WHERE id = ?`).bind(token).first<{ user_id: string; expires: number }>();
  if (!s || s.expires < Math.floor(Date.now() / 1000)) return null;
  const u = await env.DB.prepare(`SELECT id, email, name, role, seller_id FROM users WHERE id = ?`).bind(s.user_id).first<any>();
  if (!u) return null;
  return { id: u.id, email: u.email, name: u.name, role: u.role, sellerId: u.seller_id };
}

export async function destroySession(env: Env, cookieHeader: string | undefined): Promise<void> {
  const token = readCookie(cookieHeader, COOKIE);
  if (token) await env.DB.prepare(`DELETE FROM sessions WHERE id = ?`).bind(token).run();
}
