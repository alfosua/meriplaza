// Package pg provides a shared Postgres connection pool and a minimal,
// idempotent migration runner used by every SalesFactory service that persists
// state. It wraps jackc/pgx.
package pg

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Connect opens a pooled connection to the given Postgres URL and verifies it
// with a ping. The caller owns Close.
func Connect(ctx context.Context, url string) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		return nil, fmt.Errorf("pg: parse config: %w", err)
	}
	cfg.MaxConns = 8
	cfg.MaxConnIdleTime = 5 * time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("pg: connect: %w", err)
	}
	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("pg: ping: %w", err)
	}
	return pool, nil
}

// Migrate runs each statement in order inside a single transaction. Statements
// must be idempotent (CREATE TABLE IF NOT EXISTS, etc.) so startup is safe to
// repeat on every deploy.
func Migrate(ctx context.Context, pool *pgxpool.Pool, statements []string) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	for i, stmt := range statements {
		if _, err := tx.Exec(ctx, stmt); err != nil {
			return fmt.Errorf("pg: migration %d failed: %w", i, err)
		}
	}
	return tx.Commit(ctx)
}
