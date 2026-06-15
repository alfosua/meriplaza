// Command catalogd runs the Meriplaza commerce/catalog API.
//
// Config (env):
//
//	CATALOG_ADDR   listen address (default :8083)
//	DATABASE_URL   Postgres URL; if empty, an in-memory store is used (dev)
//	API_USERS      "user:pass,..." for Basic Auth; if empty, auth off
package main

import (
	"context"
	"log"
	"net/http"
	"os"

	"github.com/catalinalabsve/meriplaza/libs/httpx"
	"github.com/catalinalabsve/meriplaza/services/catalog/internal/api"
	"github.com/catalinalabsve/meriplaza/services/catalog/internal/store"
)

func main() {
	addr := httpx.Env("CATALOG_ADDR", ":8083")

	var st store.Store
	if url := os.Getenv("DATABASE_URL"); url != "" {
		pg, err := store.NewPostgres(context.Background(), url)
		if err != nil {
			log.Fatalf("catalogd: postgres: %v", err)
		}
		defer pg.Close()
		st = pg
		log.Print("catalogd: using Postgres store")
	} else {
		st = store.NewMemory()
		log.Print("catalogd: using in-memory store (set DATABASE_URL for persistence)")
	}

	creds := httpx.CredentialsFromEnv(os.Getenv("API_USERS"))
	if len(creds) == 0 {
		log.Print("catalogd: WARNING auth disabled (set API_USERS to enable)")
	}
	// Public storefront reads bypass auth; everything else requires it.
	handler := httpx.BasicAuth(api.New(st), creds, httpx.PublicStorefrontReads())

	log.Printf("catalogd listening on %s", addr)
	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatal(err)
	}
}
