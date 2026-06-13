-- Catalog v2: separate the canonical PRODUCT (what a thing is) from per-seller
-- OFFERS (who sells it, at what price/stock), so multiple stores can sell the
-- same product — the Amazon model. Plus product reviews and a categories table.
--
-- The v1 seller-scoped `products` table is replaced; data is reseeded.

DROP TABLE IF EXISTS products;

CREATE TABLE IF NOT EXISTS categories (
  slug  TEXT PRIMARY KEY,
  name  TEXT NOT NULL,
  icon  TEXT NOT NULL DEFAULT '',
  sort  INTEGER NOT NULL DEFAULT 0
);

-- Canonical catalog product (no seller, no price).
CREATE TABLE IF NOT EXISTS products (
  id           TEXT PRIMARY KEY,
  slug         TEXT NOT NULL UNIQUE,
  title        TEXT NOT NULL,
  category     TEXT NOT NULL DEFAULT '',
  brand        TEXT NOT NULL DEFAULT '',
  description  TEXT NOT NULL DEFAULT '',
  images       TEXT NOT NULL DEFAULT '[]',   -- JSON array of image URLs
  specs        TEXT NOT NULL DEFAULT '{}',   -- JSON object of spec key/values
  rating_avg   REAL NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS products_category ON products (category);

-- A seller's offer for a product.
CREATE TABLE IF NOT EXISTS offers (
  id          TEXT PRIMARY KEY,
  product_id  TEXT NOT NULL,
  seller_id   TEXT NOT NULL,
  price       TEXT NOT NULL,
  currency    TEXT NOT NULL DEFAULT 'VES',
  tax_rate    TEXT NOT NULL DEFAULT '16.00',
  stock       INTEGER NOT NULL DEFAULT 0,
  condition   TEXT NOT NULL DEFAULT 'new',
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS offers_product ON offers (product_id);
CREATE INDEX IF NOT EXISTS offers_seller  ON offers (seller_id);
CREATE UNIQUE INDEX IF NOT EXISTS offers_product_seller ON offers (product_id, seller_id);

CREATE TABLE IF NOT EXISTS reviews (
  id          TEXT PRIMARY KEY,
  product_id  TEXT NOT NULL,
  author      TEXT NOT NULL DEFAULT 'Cliente',
  rating      INTEGER NOT NULL,
  title       TEXT NOT NULL DEFAULT '',
  body        TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS reviews_product ON reviews (product_id);

-- Reference categories (idempotent).
INSERT OR IGNORE INTO categories (slug, name, icon, sort) VALUES
  ('alimentos','Alimentos','🍞',1),
  ('bebidas','Bebidas','🧃',2),
  ('salud','Salud','💊',3),
  ('cuidado-personal','Cuidado personal','🧴',4),
  ('tecnologia','Tecnología','📱',5),
  ('hogar','Hogar','🏠',6),
  ('artesania','Artesanía','🧶',7),
  ('accesorios','Accesorios','🎒',8),
  ('moda','Moda','👗',9),
  ('mascotas','Mascotas','🐾',10);
