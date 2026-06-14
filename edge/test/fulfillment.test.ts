import { test } from "node:test";
import assert from "node:assert/strict";
import { catalog } from "../src/catalog/routes.ts";

class FulfillmentStmt {
  private args: unknown[] = [];
  private db: FulfillmentD1;
  private sql: string;
  constructor(db: FulfillmentD1, sql: string) {
    this.db = db;
    this.sql = sql;
  }
  bind(...args: unknown[]) { this.args = args; return this; }
  async first<T>() { return this.db.first<T>(this.sql, this.args); }
  async all<T>() { return this.db.all<T>(); }
  async run() { return this.db.run(this.sql, this.args); }
}

class FulfillmentD1 {
  users = new Map<string, any>();
  sessions = new Map<string, { user_id: string; expires: number }>();
  orders = new Map<string, { id: string; seller_id: string; doc: string }>();

  prepare(sql: string) { return new FulfillmentStmt(this, sql); }

  async first<T>(sql: string, args: unknown[]): Promise<T | null> {
    if (sql.includes("SELECT doc FROM orders WHERE id")) {
      const row = this.orders.get(String(args[0]));
      return (row ? { doc: row.doc } : null) as T | null;
    }
    if (sql.includes("FROM sessions WHERE id")) {
      const s = this.sessions.get(String(args[0]));
      return (s ? { user_id: s.user_id, expires: s.expires } : null) as T | null;
    }
    if (sql.includes("FROM users WHERE id")) {
      const u = this.users.get(String(args[0]));
      return (u ? { id: u.id, email: u.email, name: u.name, role: u.role, seller_id: u.seller_id } : null) as T | null;
    }
    throw new Error(`FulfillmentD1.first unsupported SQL: ${sql}`);
  }

  async all<T>(): Promise<{ results: T[] }> {
    return { results: [] };
  }

  async run(sql: string, args: unknown[]) {
    if (sql.startsWith("UPDATE orders SET doc")) {
      const [doc, id] = args.map(String);
      const row = this.orders.get(id);
      if (!row) return { meta: { changes: 0 } };
      row.doc = doc;
      return { meta: { changes: 1 } };
    }
    throw new Error(`FulfillmentD1.run unsupported SQL: ${sql}`);
  }
}

function env(db: FulfillmentD1) {
  return { DB: db, CACHE: {}, API_USERS: "" } as any;
}

function seed(db: FulfillmentD1) {
  db.users.set("usr_store", {
    id: "usr_store",
    email: "tienda@example.com",
    name: "Tienda",
    role: "store",
    seller_id: "sel_demo",
  });
  db.users.set("usr_other", {
    id: "usr_other",
    email: "otra@example.com",
    name: "Otra tienda",
    role: "store",
    seller_id: "sel_other",
  });
  const expires = Math.floor(Date.now() / 1000) + 3600;
  db.sessions.set("sess_store", { user_id: "usr_store", expires });
  db.sessions.set("sess_other", { user_id: "usr_other", expires });
  const order = {
    id: "ord_demo",
    sellerId: "sel_demo",
    status: "invoiced",
    shipment: { status: "pending", method: "delivery" },
    grandTotal: "232.00",
    currency: "VES",
    lines: [{ title: "Cafe", quantity: 2 }],
  };
  db.orders.set(order.id, { id: order.id, seller_id: order.sellerId, doc: JSON.stringify(order) });
}

test("store fulfillment update records shipment details and marks delivered orders fulfilled", async () => {
  const db = new FulfillmentD1();
  seed(db);
  const res = await catalog.request("/orders/ord_demo/fulfillment", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: "mp_session=sess_store" },
    body: JSON.stringify({ status: "delivered", carrier: "MRW", tracking: "MRW-123", notes: "Entregado en recepción" }),
  }, env(db));

  assert.equal(res.status, 200);
  const order = await res.json() as any;
  assert.equal(order.status, "fulfilled");
  assert.equal(order.shipment.status, "delivered");
  assert.equal(order.shipment.carrier, "MRW");
  assert.equal(order.shipment.tracking, "MRW-123");
  assert.equal(order.shipment.notes, "Entregado en recepción");
  assert.ok(order.shipment.updatedAt);
  assert.equal(JSON.parse(db.orders.get("ord_demo")?.doc || "{}").status, "fulfilled");
});

test("store fulfillment update enforces seller ownership and valid status", async () => {
  const db = new FulfillmentD1();
  seed(db);
  const forbidden = await catalog.request("/orders/ord_demo/fulfillment", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: "mp_session=sess_other" },
    body: JSON.stringify({ status: "shipped" }),
  }, env(db));
  assert.equal(forbidden.status, 403);

  const invalid = await catalog.request("/orders/ord_demo/fulfillment", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: "mp_session=sess_store" },
    body: JSON.stringify({ status: "lost" }),
  }, env(db));
  assert.equal(invalid.status, 422);
});
