// Cloudflare Worker bindings and shared helpers.

export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  // "user:pass,user2:pass2" — HTTP Basic Auth shared by all routes.
  API_USERS?: string;
}

/** Short, unique, time-prefixed id. crypto.randomUUID is available in Workers. */
export function newID(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

/** Zero-padded 9-digit number for fiscal-style sequences. */
export function pad9(n: number): string {
  return String(n).padStart(9, "0");
}

export function nowISO(): string {
  return new Date().toISOString();
}
