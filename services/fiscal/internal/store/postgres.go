package store

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/catalinalabsve/meriplaza/libs/pg"
	"github.com/catalinalabsve/meriplaza/services/fiscal/internal/domain"
)

// Postgres is a durable Store backed by Postgres. Invoices are stored as JSONB
// to preserve the canonical document exactly (a fiscal requirement); fiscal
// numbering uses an atomic upsert so concurrent emissions never collide.
type Postgres struct {
	pool *pgxpool.Pool
}

// Migrations are idempotent and safe to run on every startup.
var fiscalMigrations = []string{
	`CREATE TABLE IF NOT EXISTS invoices (
		id          TEXT PRIMARY KEY,
		doc         JSONB NOT NULL,
		created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
	)`,
	`CREATE TABLE IF NOT EXISTS fiscal_sequences (
		series      TEXT PRIMARY KEY,
		last_value  BIGINT NOT NULL DEFAULT 0
	)`,
}

// NewPostgres connects, migrates, and returns a Postgres-backed store.
func NewPostgres(ctx context.Context, url string) (*Postgres, error) {
	pool, err := pg.Connect(ctx, url)
	if err != nil {
		return nil, err
	}
	if err := pg.Migrate(ctx, pool, fiscalMigrations); err != nil {
		pool.Close()
		return nil, err
	}
	return &Postgres{pool: pool}, nil
}

func (p *Postgres) Close() { p.pool.Close() }

func (p *Postgres) Save(inv domain.Invoice) error {
	if inv.ID == "" {
		return errors.New("store: invoice id required")
	}
	doc, err := json.Marshal(inv)
	if err != nil {
		return err
	}
	_, err = p.pool.Exec(context.Background(),
		`INSERT INTO invoices (id, doc) VALUES ($1, $2)
		 ON CONFLICT (id) DO UPDATE SET doc = EXCLUDED.doc`, inv.ID, doc)
	return err
}

func (p *Postgres) Get(id string) (domain.Invoice, error) {
	var doc []byte
	err := p.pool.QueryRow(context.Background(), `SELECT doc FROM invoices WHERE id = $1`, id).Scan(&doc)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Invoice{}, ErrNotFound
	}
	if err != nil {
		return domain.Invoice{}, err
	}
	var inv domain.Invoice
	return inv, json.Unmarshal(doc, &inv)
}

func (p *Postgres) NextNumber(series string) (string, error) {
	var n int64
	err := p.pool.QueryRow(context.Background(),
		`INSERT INTO fiscal_sequences (series, last_value) VALUES ($1, 1)
		 ON CONFLICT (series) DO UPDATE SET last_value = fiscal_sequences.last_value + 1
		 RETURNING last_value`, series).Scan(&n)
	if err != nil {
		return "", err
	}
	return pad9(n), nil
}

func (p *Postgres) List() []domain.Invoice {
	rows, err := p.pool.Query(context.Background(), `SELECT doc FROM invoices ORDER BY created_at`)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var out []domain.Invoice
	for rows.Next() {
		var doc []byte
		if rows.Scan(&doc) == nil {
			var inv domain.Invoice
			if json.Unmarshal(doc, &inv) == nil {
				out = append(out, inv)
			}
		}
	}
	return out
}

func pad9(n int64) string {
	s := []byte("000000000")
	d := []byte{}
	for n > 0 {
		d = append([]byte{byte('0' + n%10)}, d...)
		n /= 10
	}
	if len(d) >= len(s) {
		return string(d)
	}
	copy(s[len(s)-len(d):], d)
	return string(s)
}
