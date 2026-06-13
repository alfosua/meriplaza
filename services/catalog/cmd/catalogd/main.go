// Command catalogd runs the SalesFactory commerce/catalog API.
package main

import (
	"log"
	"net/http"
	"os"

	"github.com/catalinalabs/salesfactory/services/catalog/internal/api"
	"github.com/catalinalabs/salesfactory/services/catalog/internal/store"
)

func main() {
	addr := os.Getenv("CATALOG_ADDR")
	if addr == "" {
		addr = ":8083"
	}
	srv := api.New(store.NewMemory())
	log.Printf("catalogd listening on %s", addr)
	if err := http.ListenAndServe(addr, srv); err != nil {
		log.Fatal(err)
	}
}
