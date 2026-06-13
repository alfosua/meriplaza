import { test } from "node:test";
import assert from "node:assert/strict";
import { confirm } from "../src/payments/processors.ts";

const NOW = "2026-06-13T00:00:00.000Z";

test("pago_movil requires OTP then succeeds", () => {
  const base = { id: "pi_1", amount: { value: "100.00", currency: "VES" }, methodData: { payerPhone: "0414", payerBankCode: "0102", payerId: "V-28476588" } };
  assert.equal(confirm("pago_movil", base, NOW).status, "requires_action");
  base.methodData = { ...base.methodData, otp: "123456" } as any;
  const ok = confirm("pago_movil", base, NOW);
  assert.equal(ok.status, "succeeded");
  assert.equal(ok.settlement?.reference, "PM-pi_1");
});

test("divisas cross-currency converts at BCV", () => {
  const r = confirm("divisas_cash", { id: "pi_2", amount: { value: "57755.00", currency: "VES" }, methodData: { cashCurrency: "USD", fxRate: "577.55" } }, NOW);
  assert.equal(r.status, "succeeded");
  assert.equal(r.settlement?.amount.value, "100.00");
  assert.equal(r.settlement?.amount.currency, "USD");
});

test("card decline", () => {
  assert.equal(confirm("card_intl", { id: "x", amount: { value: "1", currency: "USD" }, methodData: { cardToken: "tok_decline" } }, NOW).status, "failed");
});

test("crypto deposit then confirm", () => {
  const base = { id: "pi_3", amount: { value: "50.00", currency: "USD" }, methodData: { asset: "USDT" } as any };
  assert.equal(confirm("crypto", base, NOW).status, "requires_action");
  base.methodData = { ...base.methodData, networkTxn: "0xabc" };
  const ok = confirm("crypto", base, NOW);
  assert.equal(ok.status, "succeeded");
  assert.equal(ok.settlement?.networkTxn, "0xabc");
});
