import { test } from "node:test";
import assert from "node:assert/strict";
import { distanceKm } from "../src/lib/env.ts";
import { resolveImage, fallbackImage } from "../src/ssr/images.ts";

test("distanceKm is ~0 for same point and grows with separation", () => {
  assert.ok(distanceKm(10.48, -66.90, 10.48, -66.90) < 0.001);
  // Caracas -> Maracaibo is roughly 520 km.
  const d = distanceKm(10.4806, -66.9036, 10.6545, -71.6451);
  assert.ok(d > 480 && d < 560, `expected ~520km, got ${d}`);
});

test("distanceKm orders nearer city before farther one", () => {
  const home = { lat: 10.6545, lng: -71.6451 }; // Maracaibo
  const toMaracaibo = distanceKm(home.lat, home.lng, 10.6545, -71.6451);
  const toMaturin = distanceKm(home.lat, home.lng, 9.7457, -63.1832);
  assert.ok(toMaracaibo < toMaturin);
});

test("resolveImage keeps a valid own image", () => {
  const own = "https://example.com/real.jpg";
  assert.equal(resolveImage(own, "Taladro", "Hogar", "seed1"), own);
});

test("resolveImage falls back to a product-accurate keyword image", () => {
  const url = resolveImage(null, "Taladro inalámbrico Clásico 100", "Hogar", "prod_abc");
  assert.match(url, /loremflickr\.com/);
  assert.match(url, /taladro/);
  assert.match(url, /home,household/);
});

test("fallbackImage is deterministic and varies by product", () => {
  const a1 = fallbackImage("Bombillo LED", "Hogar", "prod_1");
  const a2 = fallbackImage("Bombillo LED", "Hogar", "prod_1");
  const b = fallbackImage("Bombillo LED", "Hogar", "prod_2");
  assert.equal(a1, a2);              // stable for the same seed
  assert.notEqual(a1, b);           // different products get different photos
});
