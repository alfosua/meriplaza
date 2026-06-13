// Multi-currency support. Prices are stored in each offer's own currency
// (VES or USD); for display we show an approximate equivalent in the other
// currency using the official BCV reference rate (Bs per 1 USD), cached in KV.

import type { Env } from "./env.ts";

const KEY = "fx:usd_ves";
const DEFAULT_RATE = 40.0; // fallback Bs/USD until refreshed from BCV
const TTL = 6 * 3600;

export interface Rate { usdVes: number; source: string; updatedAt: string; }

export async function getRate(env: Env): Promise<Rate> {
  const cached = await env.CACHE.get(KEY);
  if (cached) { try { return JSON.parse(cached); } catch {} }
  return { usdVes: DEFAULT_RATE, source: "BCV (referencia)", updatedAt: "" };
}

export async function setRate(env: Env, usdVes: number, source = "BCV"): Promise<Rate> {
  const r: Rate = { usdVes, source, updatedAt: new Date().toISOString() };
  await env.CACHE.put(KEY, JSON.stringify(r), { expirationTtl: TTL });
  return r;
}

/** Best-effort fetch of the BCV USD rate; falls back silently. */
export async function refreshFromBCV(env: Env): Promise<Rate> {
  try {
    const res = await fetch("https://www.bcv.org.ve/", { cf: { cacheTtl: 3600 } as any });
    const html = await res.text();
    // The USD figure sits in #dolar .centrado strong; grab the first es-VE number near "Dólar".
    const m = html.match(/D[óo]lar[\s\S]{0,400}?([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]+)/i);
    if (m) {
      const num = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
      if (num > 0) return await setRate(env, num, "BCV");
    }
  } catch { /* ignore */ }
  return await getRate(env);
}

/** Approximate equivalent in the other major currency, as a display string. */
export function approxAlt(amount: string, currency: string, rate: Rate): string | null {
  const n = parseFloat(amount);
  if (!isFinite(n) || !rate.usdVes) return null;
  const cur = currency.toUpperCase();
  if (cur === "VES") return `≈ $${(n / rate.usdVes).toFixed(2)}`;
  if (cur === "USD") return `≈ Bs ${(n * rate.usdVes).toFixed(2)}`;
  return null;
}
