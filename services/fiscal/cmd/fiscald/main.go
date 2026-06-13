// Command fiscald runs the SalesFactory fiscal invoicing API.
//
// Config (env):
//
//	FISCAL_ADDR    listen address (default :8081)
//	DATABASE_URL   Postgres URL; if empty, an in-memory store is used (dev)
//	API_USERS      "user:pass,user2:pass2" for Basic Auth; if empty, auth off
package main

import (
	"context"
	"log"
	"net/http"
	"os"

	"github.com/catalinalabs/salesfactory/libs/httpx"
	"github.com/catalinalabs/salesfactory/services/fiscal/internal/api"
	"github.com/catalinalabs/salesfactory/services/fiscal/internal/store"
)

func main() {
	addr := httpx.Env("FISCAL_ADDR", ":8081")

	var st store.Store
	if url := os.Getenv("DATABASE_URL"); url != "" {
		pg, err := store.NewPostgres(context.Background(), url)
		if err != nil {
			log.Fatalf("fiscald: postgres: %v", err)
		}
		defer pg.Close()
		st = pg
		log.Print("fiscald: using Postgres store")
	} else {
		st = store.NewMemory()
		log.Print("fiscald: using in-memory store (set DATABASE_URL for persistence)")
	}

	creds := httpx.CredentialsFromEnv(os.Getenv("API_USERS"))
	if len(creds) == 0 {
		log.Print("fiscald: WARNING auth disabled (set API_USERS to enable)")
	}
	handler := httpx.BasicAuth(api.New(st), creds, httpx.SkipPaths("/healthz"))

	log.Printf("fiscald listening on %s", addr)
	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatal(err)
	}
}
