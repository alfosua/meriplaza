// Command fiscald runs the SalesFactory fiscal invoicing API.
package main

import (
	"log"
	"net/http"
	"os"

	"github.com/catalinalabs/salesfactory/services/fiscal/internal/api"
	"github.com/catalinalabs/salesfactory/services/fiscal/internal/store"
)

func main() {
	addr := os.Getenv("FISCAL_ADDR")
	if addr == "" {
		addr = ":8081"
	}
	srv := api.New(store.NewMemory())
	log.Printf("fiscald listening on %s", addr)
	if err := http.ListenAndServe(addr, srv); err != nil {
		log.Fatal(err)
	}
}
