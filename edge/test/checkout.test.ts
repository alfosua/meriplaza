import { test } from "node:test";
import assert from "node:assert/strict";
import { catalog } from "../src/catalog/routes.ts";

type OfferRow = {
  id: string;
  product_id: string;
  seller_id: string;
  price: string;
  currency: string;
  tax_rate: string;
  stock: number;
  active: number;
};

class FakeStmt {
  private args: unknown[] = [];
  private db: FakeD1;
  private sql: string;
  constructor(db: FakeD1, sql: string) {
    this.db = db;
    this.sql = sql;
  }
  bind(...args: unknown[]) { this.args = args; return this; }
  async first<T>() { return this.db.first<T>(this.sql, this.args); }
  async all<T>() { return this.db.all<T>(this.sql, this.args); }
  async run() { return this.db.run(this.sql, this.args); }
}

class FakeD1 {
  sellers = new Map<string, { id: string; doc: string }>();
  products = new Map<string, { id: string; title: string }>();
  offers = new Map<string, OfferRow>();
  orders = new Map<string, { id: string; seller_id: string; doc: string }>();
  paymentIntents = new Map<string, { id: string; merchant_id: string; idempotency_key: string; doc: string }>();

  prepare(sql: string) { return new FakeStmt(this, sql); }
  async batch(stmts: FakeStmt[]) { return Promise.all(stmts.map((s) => s.run())); }

  async first<T>(sql: string, args: unknown[]): Promise<T | null> {
    if (sql.includes("FROM offers o") && sql.includes("JOIN products p") && sql.includes("JOIN sellers s")) {
      const offer = this.offers.get(String(args[0]));
      if (!offer || offer.active !== 1) return null;
      const product = this.products.get(offer.product_id);
      const seller = this.sellers.get(offer.seller_id);
      if (!product || !seller) return null;
      return {
        id: offer.id,
        price: offer.price,
        currency: offer.currency,
        tax_rate: offer.tax_rate,
        stock: offer.stock,
        seller_id: offer.seller_id,
        title: product.title,
        seller_doc: seller.doc,
      } as T;
    }
    if (sql.includes("SELECT doc FROM orders WHERE id")) {
      const row = this.orders.get(String(args[0]));
      return (row ? { doc: row.doc } : null) as T | null;
    }
    throw new Error(`FakeD1.first unsupported SQL: ${sql}`);
  }

  async all<T>(_sql: string, _args: unknown[] = []): Promise<{ results: T[] }> {
    return { results: [] };
  }

  async run(sql: string, args: unknown[]) {
    if (sql.startsWith("UPDATE offers SET stock = stock -")) {
      const quantity = Number(args[0]);
      const id = String(args[1]);
      const minStock = Number(args[2]);
      const offer = this.offers.get(id);
      if (!offer || offer.stock < minStock) return { meta: { changes: 0 } };
      offer.stock -= quantity;
      return { meta: { changes: 1 } };
    }
    if (sql.startsWith("UPDATE offers SET stock = stock +")) {
      const quantity = Number(args[0]);
      const offer = this.offers.get(String(args[1]));
      if (!offer) return { meta: { changes: 0 } };
      offer.stock += quantity;
      return { meta: { changes: 1 } };
    }
    if (sql.startsWith("INSERT INTO payment_intents")) {
      const [id, merchant_id, idempotency_key, doc] = args.map(String);
      this.paymentIntents.set(id, { id, merchant_id, idempotency_key, doc });
      return { meta: { changes: 1 } };
    }
    if (sql.startsWith("INSERT INTO orders")) {
      const [id, seller_id, doc] = args.map(String);
      this.orders.set(id, { id, seller_id, doc });
      return { meta: { changes: 1 } };
    }
    throw new Error(`FakeD1.run unsupported SQL: ${sql}`);
  }
}

class FakeKV {
  async get(_key: string) { return null; }
  async put(_key: string, _value: string) {}
  async delete(_key: string) {}
}

test("checkout confirms payment, invoices order, stores payment intent, and decrements stock", async () => {
  const db = new FakeD1();
  const seller = {
    id: "sel_demo",
    handle: "demo",
    name: "Demo Market",
    taxId: "J-09512461-4",
    merchantId: "m_demo",
    address: "Av. Principal, Caracas",
    shipping: [{ provider: "delivery" }],
  };
  db.sellers.set(seller.id, { id: seller.id, doc: JSON.stringify(seller) });
  db.products.set("prod_cafe", { id: "prod_cafe", title: "Cafe molido" });
  db.offers.set("off_cafe", {
    id: "off_cafe",
    product_id: "prod_cafe",
    seller_id: seller.id,
    price: "100.00",
    currency: "VES",
    tax_rate: "16.00",
    stock: 5,
    active: 1,
  });

  const res = await catalog.request("/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      channel: "web",
      buyer: { name: "Maria Perez", taxId: "V-28476588", email: "maria@example.com" },
      shippingAddress: { city: "Caracas", address1: "La Candelaria" },
      shipment: { method: "delivery", notes: "Tarde" },
      payment: { method: "transferencia", methodData: { bankReference: "0102-ABC" } },
      items: [{ offerId: "off_cafe", quantity: 2 }],
    }),
  }, { DB: db, CACHE: new FakeKV(), API_USERS: "" } as any);

  assert.equal(res.status, 201);
  const payload = await res.json() as any;
  assert.equal(payload.ok, true);
  assert.equal(payload.orders.length, 1);

  const order = payload.orders[0];
  assert.equal(order.status, "invoiced");
  assert.equal(order.subtotal, "200.00");
  assert.equal(order.taxTotal, "32.00");
  assert.equal(order.grandTotal, "232.00");
  assert.equal(order.payment.status, "succeeded");
  assert.equal(order.payment.settlement.reference, "0102-ABC");
  assert.equal(order.invoiceId, order.invoice.id);
  assert.equal(order.invoice.ivaAmount, "32.00");
  assert.equal(order.invoice.buyer.taxId, "V-28476588");
  assert.equal(order.invoice.merchant.rif, "J-09512461-4");
  assert.equal(order.merchant.merchantId, "m_demo");
  assert.equal(order.shipment.status, "pending");
  assert.equal(order.shipment.city, "Caracas");

  assert.equal(db.offers.get("off_cafe")?.stock, 3);
  assert.equal(db.orders.size, 1);
  assert.equal(db.paymentIntents.size, 1);
  const storedIntent = JSON.parse([...db.paymentIntents.values()][0].doc);
  assert.equal(storedIntent.status, "succeeded");
  assert.equal(storedIntent.merchantId, "m_demo");
});
