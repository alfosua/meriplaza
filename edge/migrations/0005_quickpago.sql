-- QuickPago: a separate Meriplaza product (merchant payments). It has its
-- own merchants, sessions, and transactions — independent from Meriplaza's
-- users/sellers.

CREATE TABLE IF NOT EXISTS qp_merchants (
  id          TEXT PRIMARY KEY,
  business    TEXT NOT NULL,
  rif         TEXT NOT NULL DEFAULT '',
  email       TEXT NOT NULL UNIQUE,
  pass_hash   TEXT NOT NULL,
  pass_salt   TEXT NOT NULL,
  methods     TEXT NOT NULL DEFAULT '{}',   -- JSON: pagomovil/transfer/crypto config
  status      TEXT NOT NULL DEFAULT 'active',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS qp_sessions (
  id          TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  expires     INTEGER NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS qp_transactions (
  id          TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  amount      TEXT NOT NULL,
  currency    TEXT NOT NULL DEFAULT 'VES',
  method      TEXT NOT NULL,                -- pagomovil | transfer | crypto
  status      TEXT NOT NULL DEFAULT 'pending',
  reference   TEXT NOT NULL DEFAULT '',
  payer       TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS qp_tx_merchant ON qp_transactions (merchant_id);
