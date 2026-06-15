-- Meriplaza edge schema for Cloudflare D1 (SQLite).
-- Applied with: wrangler d1 migrations apply meriplaza

CREATE TABLE IF NOT EXISTS sellers (
  id          TEXT PRIMARY KEY,
  handle      TEXT NOT NULL UNIQUE,
  doc         TEXT NOT NULL,          -- JSON
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id          TEXT PRIMARY KEY,
  seller_id   TEXT NOT NULL,
  stock       INTEGER NOT NULL DEFAULT 0,
  active      INTEGER NOT NULL DEFAULT 1,
  doc         TEXT NOT NULL,          -- JSON
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS products_seller ON products (seller_id);

CREATE TABLE IF NOT EXISTS orders (
  id          TEXT PRIMARY KEY,
  seller_id   TEXT NOT NULL,
  doc         TEXT NOT NULL,          -- JSON
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS orders_seller ON orders (seller_id);

CREATE TABLE IF NOT EXISTS payment_intents (
  id              TEXT PRIMARY KEY,
  merchant_id     TEXT NOT NULL,
  idempotency_key TEXT,
  doc             TEXT NOT NULL,      -- JSON
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
-- One intent per (merchant, idempotency key) so retries don't double-charge.
CREATE UNIQUE INDEX IF NOT EXISTS payment_intents_idem
  ON payment_intents (merchant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND idempotency_key <> '';
