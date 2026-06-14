-- Supermarket mode: geo-locate cities so we can rank stores by how close their
-- delivery coverage is to the customer's home location, plus a "curated" flag on
-- products so a superuser can manage well-known catalog items.

ALTER TABLE cities ADD COLUMN lat REAL NOT NULL DEFAULT 0;
ALTER TABLE cities ADD COLUMN lng REAL NOT NULL DEFAULT 0;

UPDATE cities SET lat=10.4806, lng=-66.9036 WHERE slug='caracas';
UPDATE cities SET lat=10.6545, lng=-71.6451 WHERE slug='maracaibo';
UPDATE cities SET lat=10.1620, lng=-68.0077 WHERE slug='valencia';
UPDATE cities SET lat=10.0647, lng=-69.3470 WHERE slug='barquisimeto';
UPDATE cities SET lat=10.2469, lng=-67.5958 WHERE slug='maracay';
UPDATE cities SET lat=8.2966,  lng=-62.7116 WHERE slug='puerto-ordaz';
UPDATE cities SET lat=8.5980,  lng=-71.1561 WHERE slug='merida';
UPDATE cities SET lat=9.7457,  lng=-63.1832 WHERE slug='maturin';

-- Marks a product as a well-known item managed by the superuser content portal.
ALTER TABLE products ADD COLUMN curated INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS products_curated ON products (curated);
