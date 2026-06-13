// Payment gateway routes on D1. PaymentIntent lifecycle with idempotent create,
// processor-driven confirm, and cancel.

import { Hono } from "hono";
import type { Env } from "../lib/env.ts";
import { newID, nowISO } from "../lib/env.ts";
import { Money } from "../lib/money.ts";
import { confirm, isKnownMethod, type Method, type Status } from "./processors.ts";

export const payments = new Hono<{ Bindings: Env }>();

function isTerminal(s: Status): boolean {
  return s === "succeeded" || s === "canceled" || s === "failed";
}

payments.post("/payment_intents", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: "invalid_json" }, 400);

  const amount = body.amount ?? {};
  const method = String(body.method ?? "");
  const merchantId = String(body.merchantId ?? "");
  if (!merchantId) return c.json({ error: "validation_failed", message: "merchantId is required" }, 422);
  if (!isKnownMethod(method)) return c.json({ error: "validation_failed", message: `unknown method "${method}"` }, 422);
  try {
    const m = Money.parse(String(amount.value ?? ""), String(amount.currency ?? ""));
    if (m.sign() <= 0) return c.json({ error: "validation_failed", message: "amount must be positive" }, 422);
  } catch (e) {
    return c.json({ error: "validation_failed", message: `amount invalid: ${(e as Error).message}` }, 422);
  }

  const key = c.req.header("Idempotency-Key") ?? "";
  if (key) {
    const prior = await c.env.DB.prepare(
      `SELECT doc FROM payment_intents WHERE merchant_id = ? AND idempotency_key = ?`,
    ).bind(merchantId, key).first<{ doc: string }>();
    if (prior) return c.json(JSON.parse(prior.doc)); // idempotent replay
  }

  const now = nowISO();
  const pi = {
    id: newID("pi"),
    amount: { value: String(amount.value), currency: String(amount.currency).toUpperCase() },
    method: method as Method,
    status: "requires_confirmation" as Status,
    merchantId,
    orderRef: body.orderRef ?? "",
    description: body.description ?? "",
    methodData: body.methodData ?? {},
    nextAction: null as unknown,
    settlement: null as unknown,
    failureReason: "",
    createdAt: now,
    updatedAt: now,
  };

  try {
    await c.env.DB.prepare(
      `INSERT INTO payment_intents (id, merchant_id, idempotency_key, doc) VALUES (?, ?, ?, ?)`,
    ).bind(pi.id, merchantId, key || null, JSON.stringify(pi)).run();
  } catch (e) {
    // Lost an idempotent race: return the winner.
    if (key && String((e as Error).message).includes("UNIQUE")) {
      const prior = await c.env.DB.prepare(
        `SELECT doc FROM payment_intents WHERE merchant_id = ? AND idempotency_key = ?`,
      ).bind(merchantId, key).first<{ doc: string }>();
      if (prior) return c.json(JSON.parse(prior.doc));
    }
    throw e;
  }
  return c.json(pi, 201);
});

payments.get("/payment_intents/:id", async (c) => {
  const row = await c.env.DB.prepare(`SELECT doc FROM payment_intents WHERE id = ?`).bind(c.req.param("id")).first<{ doc: string }>();
  if (!row) return c.json({ error: "not_found", message: "payment intent not found" }, 404);
  return c.json(JSON.parse(row.doc));
});

payments.post("/payment_intents/:id/confirm", async (c) => {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare(`SELECT doc FROM payment_intents WHERE id = ?`).bind(id).first<{ doc: string }>();
  if (!row) return c.json({ error: "not_found", message: "payment intent not found" }, 404);
  const pi = JSON.parse(row.doc);
  if (isTerminal(pi.status)) return c.json(pi); // idempotent

  const body = await c.req.json().catch(() => ({}));
  if (body && typeof body.methodData === "object" && body.methodData) {
    pi.methodData = { ...pi.methodData, ...body.methodData };
  }

  const res = confirm(pi.method as Method, { id: pi.id, amount: pi.amount, methodData: pi.methodData }, nowISO());
  pi.status = res.status;
  pi.nextAction = res.nextAction ?? null;
  pi.settlement = res.settlement ?? null;
  pi.failureReason = res.failure ?? "";
  pi.updatedAt = nowISO();

  await c.env.DB.prepare(`UPDATE payment_intents SET doc = ?, updated_at = datetime('now') WHERE id = ?`)
    .bind(JSON.stringify(pi), id).run();
  return c.json(pi);
});

payments.post("/payment_intents/:id/cancel", async (c) => {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare(`SELECT doc FROM payment_intents WHERE id = ?`).bind(id).first<{ doc: string }>();
  if (!row) return c.json({ error: "not_found", message: "payment intent not found" }, 404);
  const pi = JSON.parse(row.doc);
  if (isTerminal(pi.status)) return c.json(pi);
  pi.status = "canceled";
  pi.updatedAt = nowISO();
  await c.env.DB.prepare(`UPDATE payment_intents SET doc = ? WHERE id = ?`).bind(JSON.stringify(pi), id).run();
  return c.json(pi);
});
