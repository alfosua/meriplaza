// Payment method processors, mirroring the Go services/payments/processor.
// Each turns a confirmed intent into a settlement (or asks for more input).

import { Money, divByRate } from "../lib/money.ts";

export type Method =
  | "pago_movil" | "transferencia" | "divisas_cash"
  | "punto_de_venta" | "card_intl" | "crypto" | "quickpago";

export type Status =
  | "requires_confirmation" | "requires_action" | "processing"
  | "succeeded" | "canceled" | "failed";

export interface Amount { value: string; currency: string; }

export interface NextAction { type: string; data?: Record<string, unknown>; }

export interface Settlement {
  amount: Amount;
  reference?: string;
  fxRate?: string;
  fxSource?: string;
  networkTxn?: string;
  settledAt: string;
}

export interface Result {
  status: Status;
  nextAction?: NextAction;
  settlement?: Settlement;
  failure?: string;
}

export interface IntentLike {
  id: string;
  amount: Amount;
  methodData: Record<string, any>;
}

const KNOWN: Record<string, true> = {
  pago_movil: true, transferencia: true, divisas_cash: true,
  punto_de_venta: true, card_intl: true, crypto: true, quickpago: true,
};

export function isKnownMethod(m: string): m is Method { return KNOWN[m] === true; }

function s(v: unknown): string { return typeof v === "string" ? v.trim() : ""; }
function missing(d: Record<string, any>, keys: string[]): string[] {
  return keys.filter((k) => s(d[k]) === "");
}

export function confirm(method: Method, intent: IntentLike, now: string): Result {
  const d = intent.methodData ?? {};
  switch (method) {
    case "pago_movil": {
      const miss = missing(d, ["payerPhone", "payerBankCode", "payerId"]);
      if (miss.length) return { status: "failed", failure: `missing methodData fields: ${miss.join(", ")}` };
      const otp = s(d.otp);
      if (otp === "") {
        return { status: "requires_action", nextAction: { type: "pago_movil_otp", data: { message: "Ingrese el código (OTP) enviado por su banco" } } };
      }
      if (otp.length < 4) return { status: "failed", failure: "invalid OTP" };
      return { status: "succeeded", settlement: { amount: intent.amount, reference: `PM-${intent.id}`, settledAt: now } };
    }
    case "transferencia": {
      const ref = s(d.bankReference);
      if (ref === "") return { status: "requires_action", nextAction: { type: "await_bank_reference", data: { message: "Confirme la transferencia con el número de referencia bancaria" } } };
      return { status: "succeeded", settlement: { amount: intent.amount, reference: ref, settledAt: now } };
    }
    case "divisas_cash": {
      const cashCur = s(d.cashCurrency).toUpperCase();
      if (cashCur === "") return { status: "failed", failure: "cashCurrency required" };
      if (cashCur === intent.amount.currency.toUpperCase()) {
        return { status: "succeeded", settlement: { amount: intent.amount, reference: s(d.receiptRef), settledAt: now } };
      }
      const rate = s(d.fxRate);
      if (rate === "") return { status: "failed", failure: "fxRate required for cross-currency divisas" };
      try {
        const order = Money.parse(intent.amount.value, intent.amount.currency);
        const cash = divByRate(order, rate, cashCur, 2);
        return { status: "succeeded", settlement: { amount: { value: cash.format(2), currency: cashCur }, reference: s(d.receiptRef), fxRate: rate, fxSource: s(d.fxSource) || "BCV", settledAt: now } };
      } catch (e) {
        return { status: "failed", failure: (e as Error).message };
      }
    }
    case "punto_de_venta": {
      const ref = s(d.approvalRef);
      if (ref === "") return { status: "failed", failure: "approvalRef from POS terminal required" };
      return { status: "succeeded", settlement: { amount: intent.amount, reference: ref, settledAt: now } };
    }
    case "card_intl": {
      const tok = s(d.cardToken);
      if (tok === "") return { status: "failed", failure: "cardToken required" };
      if (tok.toLowerCase().includes("decline")) return { status: "failed", failure: "card declined" };
      return { status: "succeeded", settlement: { amount: intent.amount, reference: `AUTH-${intent.id}`, settledAt: now } };
    }
    case "quickpago": {
      // QuickPago is SalesFactory's own one-tap wallet/checkout. The shopper is
      // redirected to approve the cobro; once a QuickPago transaction reference
      // comes back the intent settles instantly. For the demo flow we accept a
      // reference (auto-supplied by the storefront) and settle immediately.
      const ref = s(d.qpReference);
      if (ref === "") {
        return { status: "requires_action", nextAction: { type: "quickpago_redirect", data: { message: "Aprueba el cobro en QuickPago", url: `/quickpago/pay/${intent.id}` } } };
      }
      return { status: "succeeded", settlement: { amount: intent.amount, reference: ref, networkTxn: `QP-${intent.id}`, settledAt: now } };
    }
    case "crypto": {
      const asset = (s(d.asset) || "USDT").toUpperCase();
      const txn = s(d.networkTxn);
      if (txn === "") {
        return { status: "requires_action", nextAction: { type: "crypto_deposit", data: { asset, network: s(d.network) || "TRON", address: `deposit-${intent.id}` } } };
      }
      return { status: "succeeded", settlement: { amount: intent.amount, networkTxn: txn, settledAt: now } };
    }
  }
}
