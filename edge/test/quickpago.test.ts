import { test } from "node:test";
import assert from "node:assert/strict";
import { quickpago } from "../src/quickpago/routes.ts";

type Merchant = {
  id: string;
  business: string;
  rif: string;
  email: string;
  methods: string;
  status: string;
  pass_hash?: string;
  pass_salt?: string;
};
type Tx = {
  id: string;
  merchant_id: string;
  amount: string;
  currency: string;
  method: string;
  status: string;
  reference: string;
  payer: string;
  created_at: string;
};

class QpStmt {
  private args: unknown[] = [];
  private db: QpD1;
  private sql: string;
  constructor(db: QpD1, sql: string) {
    this.db = db;
    this.sql = sql;
  }
  bind(...args: unknown[]) { this.args = args; return this; }
  async first<T>() { return this.db.first<T>(this.sql, this.args); }
  async all<T>() { return this.db.all<T>(this.sql, this.args); }
  async run() { return this.db.run(this.sql, this.args); }
}

class QpD1 {
  merchants = new Map<string, Merchant>();
  sessions = new Map<string, { id: string; merchant_id: string; expires: number }>();
  txs = new Map<string, Tx>();

  prepare(sql: string) { return new QpStmt(this, sql); }

  async first<T>(sql: string, args: unknown[]): Promise<T | null> {
    if (sql.includes("FROM qp_sessions WHERE id")) {
      const row = this.sessions.get(String(args[0]));
      return (row ? { merchant_id: row.merchant_id, expires: row.expires } : null) as T | null;
    }
    if (sql.includes("FROM qp_merchants WHERE id")) {
      const row = this.merchants.get(String(args[0]));
      return (row ? { id: row.id, business: row.business, rif: row.rif, email: row.email, methods: row.methods, status: row.status } : null) as T | null;
    }
    if (sql.includes("FROM qp_transactions t JOIN qp_merchants m")) {
      const ref = String(args[0]).toUpperCase();
      const tx = [...this.txs.values()].find((t) => t.reference.toUpperCase() === ref);
      if (!tx) return null;
      const m = this.merchants.get(tx.merchant_id);
      if (!m) return null;
      return { ...tx, business: m.business, rif: m.rif, methods: m.methods } as T;
    }
    throw new Error(`QpD1.first unsupported SQL: ${sql}`);
  }

  async all<T>(sql: string, args: unknown[] = []): Promise<{ results: T[] }> {
    if (sql.includes("FROM qp_transactions WHERE merchant_id")) {
      const merchantId = String(args[0]);
      const results = [...this.txs.values()]
        .filter((t) => t.merchant_id === merchantId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)) as T[];
      return { results };
    }
    return { results: [] };
  }

  async run(sql: string, args: unknown[]) {
    if (sql.startsWith("INSERT INTO qp_transactions")) {
      const [id, merchant_id, amount, currency, method, status, reference, payer] = args.map(String);
      this.txs.set(id, { id, merchant_id, amount, currency, method, status, reference, payer, created_at: new Date().toISOString() });
      return { meta: { changes: 1 } };
    }
    if (sql.startsWith("UPDATE qp_transactions SET payer")) {
      const [payer, ref] = args.map(String);
      const tx = [...this.txs.values()].find((t) => t.reference.toUpperCase() === ref.toUpperCase());
      if (!tx || !["pending", "proof_submitted"].includes(tx.status)) return { meta: { changes: 0 } };
      tx.payer = payer;
      tx.status = "proof_submitted";
      return { meta: { changes: 1 } };
    }
    if (sql.startsWith("UPDATE qp_transactions SET status='confirmed'")) return this.updateStatus(args, "confirmed");
    if (sql.startsWith("UPDATE qp_transactions SET status='canceled'")) return this.updateStatus(args, "canceled");
    if (sql.startsWith("UPDATE qp_transactions SET status='expired'")) return this.updateStatus(args, "expired");
    throw new Error(`QpD1.run unsupported SQL: ${sql}`);
  }

  private updateStatus(args: unknown[], status: string) {
    const [id, merchantId] = args.map(String);
    const tx = this.txs.get(id);
    if (!tx || tx.merchant_id !== merchantId || !["pending", "proof_submitted"].includes(tx.status)) return { meta: { changes: 0 } };
    tx.status = status;
    return { meta: { changes: 1 } };
  }
}

function env(db: QpD1) {
  return { DB: db, CACHE: {}, API_USERS: "" } as any;
}

function seedMerchant(db: QpD1, id = "qpm_demo") {
  db.merchants.set(id, {
    id,
    business: "Demo QuickPago",
    rif: "J-09512461-4",
    email: "qp@example.com",
    methods: JSON.stringify({ transfer: { bank: "0102", account: "0102..." } }),
    status: "active",
  });
  db.sessions.set("sess_demo", { id: "sess_demo", merchant_id: id, expires: Math.floor(Date.now() / 1000) + 3600 });
}

async function createCharge(db: QpD1) {
  const res = await quickpago.request("/api/charge", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: "qp_session=sess_demo" },
    body: JSON.stringify({ amount: "150.00", currency: "VES", method: "transfer" }),
  }, env(db));
  assert.equal(res.status, 201);
  return await res.json() as any;
}

test("QuickPago charge moves from pending to proof_submitted to confirmed", async () => {
  const db = new QpD1();
  seedMerchant(db);
  const charge = await createCharge(db);
  const tx = db.txs.get(charge.id);
  assert.equal(tx?.status, "pending");
  assert.equal(charge.reference, tx?.reference);

  const proof = await quickpago.request(`/api/pay/${charge.reference}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ payerName: "Ana", payerContact: "0414", proof: "REF-123" }),
  }, env(db));
  assert.equal(proof.status, 200);
  const proofBody = await proof.json() as any;
  assert.equal(proofBody.status, "proof_submitted");
  assert.equal(tx?.status, "proof_submitted");
  assert.equal(JSON.parse(tx?.payer || "{}").proof, "REF-123");

  const confirm = await quickpago.request(`/api/tx/${charge.id}/confirm`, {
    method: "POST",
    headers: { cookie: "qp_session=sess_demo" },
  }, env(db));
  assert.equal(confirm.status, 200);
  assert.equal((await confirm.json() as any).status, "confirmed");
  assert.equal(tx?.status, "confirmed");

  const lateProof = await quickpago.request(`/api/pay/${charge.reference}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ proof: "REF-LATE" }),
  }, env(db));
  assert.equal(lateProof.status, 404);
});

test("QuickPago merchant can cancel or expire open charges only", async () => {
  const db = new QpD1();
  seedMerchant(db);
  const cancelCharge = await createCharge(db);
  const expireCharge = await createCharge(db);

  const cancel = await quickpago.request(`/api/tx/${cancelCharge.id}/cancel`, {
    method: "POST",
    headers: { cookie: "qp_session=sess_demo" },
  }, env(db));
  assert.equal(cancel.status, 200);
  assert.equal(db.txs.get(cancelCharge.id)?.status, "canceled");

  const confirmCanceled = await quickpago.request(`/api/tx/${cancelCharge.id}/confirm`, {
    method: "POST",
    headers: { cookie: "qp_session=sess_demo" },
  }, env(db));
  assert.equal(confirmCanceled.status, 404);

  const expire = await quickpago.request(`/api/tx/${expireCharge.id}/expire`, {
    method: "POST",
    headers: { cookie: "qp_session=sess_demo" },
  }, env(db));
  assert.equal(expire.status, 200);
  assert.equal(db.txs.get(expireCharge.id)?.status, "expired");
});
