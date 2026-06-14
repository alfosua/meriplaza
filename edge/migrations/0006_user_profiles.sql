-- Saved customer checkout data: delivery addresses and fiscal invoice profiles.
-- Stored as JSON to keep the edge schema small while supporting multiple
-- addresses and RIF/CI identities per user.

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id     TEXT PRIMARY KEY,
  doc         TEXT NOT NULL DEFAULT '{}',
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
