-- Scale-up: give each store its own geo point (so thousands of stores in one
-- city spread across the map instead of collapsing onto the city centroid), and
-- add the indexes needed to paginate large catalogs efficiently.

-- Per-store coordinates. 0/0 means "not geocoded" — supermarket ranking then
-- falls back to the nearest covered-city centroid (see catalog/routes.ts).
ALTER TABLE sellers ADD COLUMN lat REAL NOT NULL DEFAULT 0;
ALTER TABLE sellers ADD COLUMN lng REAL NOT NULL DEFAULT 0;

-- Listing sorts and paginates by title; offers are filtered by (product, active)
-- and joined/sorted by price. These indexes keep that cheap at 1000s of rows.
CREATE INDEX IF NOT EXISTS products_title ON products (title);
CREATE INDEX IF NOT EXISTS offers_product_active ON offers (product_id, active);
CREATE INDEX IF NOT EXISTS sellers_geo ON sellers (lat, lng);
