// Cloudflare Worker bindings and shared helpers.

export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  // "user:pass,user2:pass2" — HTTP Basic Auth shared by all routes.
  API_USERS?: string;
  // Google Maps JavaScript API key for the home-location picker (optional;
  // the picker degrades to manual city selection when absent).
  GOOGLE_MAPS_API_KEY?: string;
}

/** Haversine distance in kilometers between two lat/lng points. */
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
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
