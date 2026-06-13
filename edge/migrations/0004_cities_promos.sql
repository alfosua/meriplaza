-- Delivery cities + store coverage, offer-level promotions/discounts, and
-- home promotion banners (deals, bundles, events, holidays).

CREATE TABLE IF NOT EXISTS cities (
  slug  TEXT PRIMARY KEY,
  name  TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT '',
  sort  INTEGER NOT NULL DEFAULT 0
);

-- Which cities a store delivers to (its coverage).
CREATE TABLE IF NOT EXISTS store_cities (
  seller_id  TEXT NOT NULL,
  city_slug  TEXT NOT NULL,
  PRIMARY KEY (seller_id, city_slug)
);
CREATE INDEX IF NOT EXISTS store_cities_city ON store_cities (city_slug);

-- Offer promotions: a compare-at (original) price, a promo label, and a
-- featured flag for promoted placement.
ALTER TABLE offers ADD COLUMN compare_at TEXT NOT NULL DEFAULT '';
ALTER TABLE offers ADD COLUMN promo TEXT NOT NULL DEFAULT '';
ALTER TABLE offers ADD COLUMN featured INTEGER NOT NULL DEFAULT 0;

-- Home promotion banners / campaigns.
CREATE TABLE IF NOT EXISTS promotions (
  id        TEXT PRIMARY KEY,
  kind      TEXT NOT NULL DEFAULT 'deal',   -- deal | bundle | event | holiday
  title     TEXT NOT NULL,
  subtitle  TEXT NOT NULL DEFAULT '',
  href      TEXT NOT NULL DEFAULT '/',
  color     TEXT NOT NULL DEFAULT 'blue',    -- blue | yellow | dark
  active    INTEGER NOT NULL DEFAULT 1,
  sort      INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO cities (slug, name, state, sort) VALUES
  ('caracas','Caracas','Distrito Capital',1),
  ('maracaibo','Maracaibo','Zulia',2),
  ('valencia','Valencia','Carabobo',3),
  ('barquisimeto','Barquisimeto','Lara',4),
  ('maracay','Maracay','Aragua',5),
  ('puerto-ordaz','Puerto Ordaz','Bolívar',6),
  ('merida','Mérida','Mérida',7),
  ('maturin','Maturín','Monagas',8);
