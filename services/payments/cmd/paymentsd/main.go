// Command paymentsd runs the SalesFactory payment gateway API.
//
// Config (env):
//
//	PAYMENTS_ADDR  listen address (default :8082)
//	DATABASE_URL   Postgres URL; if empty, an in-memory store is used (dev)
//	API_USERS      "user:pass,..." for Basic Auth; if empty, auth off
package main

import (
	"context"
	"log"
	"net/http"
	"os"

	"github.com/catalinalabs/salesfactory/libs/httpx"
	"github.com/catalinalabs/salesfactory/services/payments/internal/api"
	"github.com/catalinalabs/salesfactory/services/payments/internal/processor"
	"github.com/catalinalabs/salesfactory/services/payments/internal/store"
)

func main() {
	addr := httpx.Env("PAYMENTS_ADDR", ":8082")

	var st store.Store
	if url := os.Getenv("DATABASE_URL"); url != "" {
		pg, err := store.NewPostgres(context.Background(), url)
		if err != nil {
			log.Fatalf("paymentsd: postgres: %v", err)
		}
		defer pg.Close()
		st = pg
		log.Print("paymentsd: using Postgres store")
	} else {
		st = store.NewMemory()
		log.Print("paymentsd: using in-memory store (set DATABASE_URL for persistence)")
	}

	creds := httpx.CredentialsFromEnv(os.Getenv("API_USERS"))
	if len(creds) == 0 {
		log.Print("paymentsd: WARNING auth disabled (set API_USERS to enable)")
	}
	handler := httpx.BasicAuth(api.New(st, processor.Default()), creds, httpx.SkipPaths("/healthz"))

	log.Printf("paymentsd listening on %s", addr)
	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatal(err)
	}
}
