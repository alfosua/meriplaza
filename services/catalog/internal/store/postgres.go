package store

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/catalinalabsve/meriplaza/libs/pg"
	"github.com/catalinalabsve/meriplaza/services/catalog/internal/domain"
)

// Postgres is a durable Store. Sellers/products/orders are stored as JSONB with
// a few promoted columns (handle, seller_id, stock) for lookups and atomic
// stock control. Stock lives in its own column so DecrementStock can use
// row-level locking (SELECT ... FOR UPDATE) for safe concurrent checkouts.
type Postgres struct {
	pool *pgxpool.Pool
}

var catalogMigrations = []string{
	`CREATE TABLE IF NOT EXISTS sellers (
		id      TEXT PRIMARY KEY,
		handle  TEXT NOT NULL UNIQUE,
		doc     JSONB NOT NULL
	)`,
	`CREATE TABLE IF NOT EXISTS products (
		id         TEXT PRIMARY KEY,
		seller_id  TEXT NOT NULL,
		stock      INTEGER NOT NULL DEFAULT 0,
		doc        JSONB NOT NULL
	)`,
	`CREATE INDEX IF NOT EXISTS products_seller ON products (seller_id)`,
	`CREATE TABLE IF NOT EXISTS orders (
		id         TEXT PRIMARY KEY,
		doc        JSONB NOT NULL,
		created_at TIMESTAMPTZ NOT NULL DEFAULT now()
	)`,
}

func NewPostgres(ctx context.Context, url string) (*Postgres, error) {
	pool, err := pg.Connect(ctx, url)
	if err != nil {
		return nil, err
	}
	if err := pg.Migrate(ctx, pool, catalogMigrations); err != nil {
		pool.Close()
		return nil, err
	}
	return &Postgres{pool: pool}, nil
}

func (p *Postgres) Close() { p.pool.Close() }

func (p *Postgres) SaveSeller(s domain.Seller) error {
	doc, err := json.Marshal(s)
	if err != nil {
		return err
	}
	_, err = p.pool.Exec(context.Background(),
		`INSERT INTO sellers (id, handle, doc) VALUES ($1, $2, $3)
		 ON CONFLICT (id) DO UPDATE SET handle = EXCLUDED.handle, doc = EXCLUDED.doc`,
		s.ID, s.Handle, doc)
	if err != nil && isUniqueViolation(err) {
		return errors.New("handle already taken")
	}
	return err
}

func (p *Postgres) Seller(id string) (domain.Seller, error) {
	return scanSeller(p.pool.QueryRow(context.Background(), `SELECT doc FROM sellers WHERE id = $1`, id))
}

func (p *Postgres) SellerByHandle(h string) (domain.Seller, error) {
	return scanSeller(p.pool.QueryRow(context.Background(), `SELECT doc FROM sellers WHERE handle = $1`, h))
}

func (p *Postgres) SaveProduct(prod domain.Product) error {
	doc, err := json.Marshal(prod)
	if err != nil {
		return err
	}
	_, err = p.pool.Exec(context.Background(),
		`INSERT INTO products (id, seller_id, stock, doc) VALUES ($1, $2, $3, $4)
		 ON CONFLICT (id) DO UPDATE SET seller_id = EXCLUDED.seller_id, stock = EXCLUDED.stock, doc = EXCLUDED.doc`,
		prod.ID, prod.SellerID, prod.Stock, doc)
	return err
}

func (p *Postgres) Product(id string) (domain.Product, error) {
	return scanProduct(p.pool.QueryRow(context.Background(), `SELECT doc, stock FROM products WHERE id = $1`, id))
}

func (p *Postgres) ProductsBySeller(sellerID string) []domain.Product {
	rows, err := p.pool.Query(context.Background(), `SELECT doc, stock FROM products WHERE seller_id = $1`, sellerID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var out []domain.Product
	for rows.Next() {
		if prod, err := scanProduct(rows); err == nil {
			out = append(out, prod)
		}
	}
	return out
}

func (p *Postgres) SaveOrder(o domain.Order) error {
	doc, err := json.Marshal(o)
	if err != nil {
		return err
	}
	_, err = p.pool.Exec(context.Background(),
		`INSERT INTO orders (id, doc) VALUES ($1, $2)
		 ON CONFLICT (id) DO UPDATE SET doc = EXCLUDED.doc`, o.ID, doc)
	return err
}

func (p *Postgres) Order(id string) (domain.Order, error) {
	var doc []byte
	err := p.pool.QueryRow(context.Background(), `SELECT doc FROM orders WHERE id = $1`, id).Scan(&doc)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Order{}, ErrNotFound
	}
	if err != nil {
		return domain.Order{}, err
	}
	var o domain.Order
	return o, json.Unmarshal(doc, &o)
}

// DecrementStock locks the affected product rows, verifies availability, then
// applies the decrements and syncs the stock value back into the JSONB doc, all
// in one transaction.
func (p *Postgres) DecrementStock(lines []domain.OrderLine) error {
	ctx := context.Background()
	tx, err := p.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	for _, l := range lines {
		var stock int
		err := tx.QueryRow(ctx, `SELECT stock FROM products WHERE id = $1 FOR UPDATE`, l.ProductID).Scan(&stock)
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		if err != nil {
			return err
		}
		if stock < l.Quantity {
			return errors.New("insufficient stock")
		}
		if _, err := tx.Exec(ctx,
			`UPDATE products SET stock = stock - $2,
			    doc = jsonb_set(doc, '{stock}', to_jsonb(stock - $2))
			 WHERE id = $1`, l.ProductID, l.Quantity); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanSeller(row rowScanner) (domain.Seller, error) {
	var doc []byte
	err := row.Scan(&doc)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Seller{}, ErrNotFound
	}
	if err != nil {
		return domain.Seller{}, err
	}
	var s domain.Seller
	return s, json.Unmarshal(doc, &s)
}

// scanProduct reads the doc and the authoritative stock column, overriding the
// doc's stock so reads always reflect the latest committed quantity.
func scanProduct(row rowScanner) (domain.Product, error) {
	var doc []byte
	var stock int
	err := row.Scan(&doc, &stock)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Product{}, ErrNotFound
	}
	if err != nil {
		return domain.Product{}, err
	}
	var prod domain.Product
	if err := json.Unmarshal(doc, &prod); err != nil {
		return domain.Product{}, err
	}
	prod.Stock = stock
	return prod, nil
}

func isUniqueViolation(err error) bool {
	return err != nil && (containsAny(err.Error(), "duplicate key", "unique constraint", "23505"))
}

func containsAny(s string, subs ...string) bool {
	for _, sub := range subs {
		if len(sub) > 0 && indexOf(s, sub) >= 0 {
			return true
		}
	}
	return false
}

func indexOf(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}
