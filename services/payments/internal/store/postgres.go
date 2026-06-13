package store

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/catalinalabs/salesfactory/libs/pg"
	"github.com/catalinalabs/salesfactory/services/payments/internal/domain"
)

// Postgres is a durable Store for payment intents. The idempotency key is a
// unique column scoped to the merchant, so a retried create returns the prior
// intent instead of charging twice.
type Postgres struct {
	pool *pgxpool.Pool
}

var paymentsMigrations = []string{
	`CREATE TABLE IF NOT EXISTS payment_intents (
		id              TEXT PRIMARY KEY,
		merchant_id     TEXT NOT NULL,
		idempotency_key TEXT,
		doc             JSONB NOT NULL,
		created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
		updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
	)`,
	`CREATE UNIQUE INDEX IF NOT EXISTS payment_intents_idem
		ON payment_intents (merchant_id, idempotency_key)
		WHERE idempotency_key IS NOT NULL AND idempotency_key <> ''`,
}

func NewPostgres(ctx context.Context, url string) (*Postgres, error) {
	pool, err := pg.Connect(ctx, url)
	if err != nil {
		return nil, err
	}
	if err := pg.Migrate(ctx, pool, paymentsMigrations); err != nil {
		pool.Close()
		return nil, err
	}
	return &Postgres{pool: pool}, nil
}

func (p *Postgres) Close() { p.pool.Close() }

func (p *Postgres) Save(pi domain.PaymentIntent) error {
	if pi.ID == "" {
		return errors.New("store: intent id required")
	}
	doc, err := json.Marshal(pi)
	if err != nil {
		return err
	}
	var key any
	if pi.IdempotencyKey != "" {
		key = pi.IdempotencyKey
	}
	_, err = p.pool.Exec(context.Background(),
		`INSERT INTO payment_intents (id, merchant_id, idempotency_key, doc)
		 VALUES ($1, $2, $3, $4)
		 ON CONFLICT (id) DO UPDATE SET doc = EXCLUDED.doc, updated_at = now()`,
		pi.ID, pi.MerchantID, key, doc)
	return err
}

func (p *Postgres) Get(id string) (domain.PaymentIntent, error) {
	return p.scanOne(`SELECT doc FROM payment_intents WHERE id = $1`, id)
}

func (p *Postgres) FindByIdempotencyKey(merchantID, key string) (domain.PaymentIntent, bool) {
	if key == "" {
		return domain.PaymentIntent{}, false
	}
	pi, err := p.scanOne(
		`SELECT doc FROM payment_intents WHERE merchant_id = $1 AND idempotency_key = $2`,
		merchantID, key)
	if err != nil {
		return domain.PaymentIntent{}, false
	}
	return pi, true
}

func (p *Postgres) scanOne(query string, args ...any) (domain.PaymentIntent, error) {
	var doc []byte
	err := p.pool.QueryRow(context.Background(), query, args...).Scan(&doc)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.PaymentIntent{}, ErrNotFound
	}
	if err != nil {
		return domain.PaymentIntent{}, err
	}
	var pi domain.PaymentIntent
	return pi, json.Unmarshal(doc, &pi)
}
