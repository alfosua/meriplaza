// Command paymentsd runs the SalesFactory payment gateway API.
package main

import (
	"log"
	"net/http"
	"os"

	"github.com/catalinalabs/salesfactory/services/payments/internal/api"
	"github.com/catalinalabs/salesfactory/services/payments/internal/processor"
	"github.com/catalinalabs/salesfactory/services/payments/internal/store"
)

func main() {
	addr := os.Getenv("PAYMENTS_ADDR")
	if addr == "" {
		addr = ":8082"
	}
	srv := api.New(store.NewMemory(), processor.Default())
	log.Printf("paymentsd listening on %s", addr)
	if err := http.ListenAndServe(addr, srv); err != nil {
		log.Fatal(err)
	}
}
