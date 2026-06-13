-- User accounts (customers, stores, admins) and sessions.

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL DEFAULT '',
  role        TEXT NOT NULL DEFAULT 'customer',   -- customer | store | admin
  pass_hash   TEXT NOT NULL,
  pass_salt   TEXT NOT NULL,
  seller_id   TEXT NOT NULL DEFAULT '',           -- linked store for role=store
  phone       TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,                    -- random token (cookie value)
  user_id     TEXT NOT NULL,
  role        TEXT NOT NULL,
  expires     INTEGER NOT NULL,                    -- unix seconds
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id);
