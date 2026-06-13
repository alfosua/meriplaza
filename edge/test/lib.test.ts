import { test } from "node:test";
import assert from "node:assert/strict";
import { Money, divByRate } from "../src/lib/money.ts";
import * as ident from "../src/lib/ident.ts";
import { priceOrder, type ProductLike } from "../src/lib/pricing.ts";

test("money parse + format (same vectors as Go)", () => {
  assert.equal(Money.parse("600.66", "VES").toString(), "600.66");
  assert.equal(Money.parse("0", "VES").toString(), "0.00");
  assert.equal(Money.parse(".5", "VES").toString(), "0.50");
  assert.equal(Money.parse("-3.4", "VES").toString(), "-3.40");
  assert.equal(Money.parse("96.114", "VES").toString(), "96.11");
  assert.equal(Money.parse("96.115", "VES").toString(), "96.12");
});

test("money rejects invalid", () => {
  for (const bad of ["", "abc", "1.2.3", "1,2", "1.1234567"]) {
    assert.throws(() => Money.parse(bad, "VES"), `expected throw for ${bad}`);
  }
});

test("money add + mismatch", () => {
  const a = Money.parse("600.66", "VES");
  assert.equal(a.add(Money.parse("96.11", "VES")).toString(), "696.77");
  assert.throws(() => a.add(Money.parse("1", "USD")));
});

test("divByRate converts Bs to USD at BCV", () => {
  // 57755.00 Bs / 577.55 = 100.00 USD
  const usd = divByRate(Money.parse("57755.00", "VES"), "577.55", "USD", 2);
  assert.equal(usd.format(2), "100.00");
  assert.equal(usd.currency, "USD");
});

test("ident RIF check digit (J-09512461-4)", () => {
  const id = ident.parse("J-09512461");
  assert.equal(id.checkDigit, "4");
  assert.equal(ident.format(id), "J-09512461-4");
  assert.doesNotThrow(() => ident.parse("J-09512461-4"));
  assert.throws(() => ident.parse("J-09512461-9"));
});

test("ident cedula has no check digit", () => {
  assert.equal(ident.format(ident.parse("V28476588")), "V-28476588");
  assert.throws(() => ident.parse("X123456"));
});

test("priceOrder VAT totals match fiscal math", () => {
  const products = new Map<string, ProductLike>([
    ["p_1", { id: "p_1", title: "Cafe", price: "210.00", currency: "VES", taxRate: "16.00", stock: 10, active: true }],
    ["p_2", { id: "p_2", title: "Pan", price: "50.00", currency: "VES", taxRate: "0.00", stock: 10, active: true }],
  ]);
  const ord = priceOrder("VES", products, [
    { productId: "p_1", quantity: 1 },
    { productId: "p_2", quantity: 2 },
  ]);
  assert.equal(ord.subtotal, "310.00");
  assert.equal(ord.taxTotal, "33.60");
  assert.equal(ord.grandTotal, "343.60");
});

test("priceOrder rejects over-stock", () => {
  const products = new Map<string, ProductLike>([
    ["p_1", { id: "p_1", title: "X", price: "1.00", currency: "VES", taxRate: "0.00", stock: 1, active: true }],
  ]);
  assert.throws(() => priceOrder("VES", products, [{ productId: "p_1", quantity: 5 }]));
});
