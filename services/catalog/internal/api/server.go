// Package api exposes the commerce/catalog HTTP API.
//
// Routes:
//
//	POST /sellers                         register a seller (storefront)
//	GET  /sellers/{handle}                public storefront profile + products
//	POST /sellers/{id}/products           add a product
//	POST /orders                          price + place an order from a cart
//	POST /orders/{id}/mark-paid           record payment intent success
//	GET  /orders/{id}                     fetch an order
//	GET  /healthz
package api

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"time"

	"github.com/catalinalabs/salesfactory/libs/ident"
	"github.com/catalinalabs/salesfactory/services/catalog/internal/domain"
	"github.com/catalinalabs/salesfactory/services/catalog/internal/store"
)

type Server struct {
	store *store.Memory
	mux   *http.ServeMux
}

func New(s *store.Memory) *Server {
	srv := &Server{store: s, mux: http.NewServeMux()}
	srv.routes()
	return srv
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) { s.mux.ServeHTTP(w, r) }

func (s *Server) routes() {
	s.mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	s.mux.HandleFunc("POST /sellers", s.handleCreateSeller)
	s.mux.HandleFunc("GET /sellers/{handle}", s.handleStorefront)
	s.mux.HandleFunc("POST /sellers/{id}/products", s.handleAddProduct)
	s.mux.HandleFunc("POST /orders", s.handlePlaceOrder)
	s.mux.HandleFunc("POST /orders/{id}/mark-paid", s.handleMarkPaid)
	s.mux.HandleFunc("GET /orders/{id}", s.handleGetOrder)
}

func (s *Server) handleCreateSeller(w http.ResponseWriter, r *http.Request) {
	var seller domain.Seller
	if err := json.NewDecoder(r.Body).Decode(&seller); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", err.Error())
		return
	}
	if seller.Handle == "" || seller.Name == "" {
		writeError(w, http.StatusUnprocessableEntity, "validation_failed", "handle and name are required")
		return
	}
	if seller.TaxID != "" {
		if _, err := ident.Parse(seller.TaxID); err != nil {
			writeError(w, http.StatusUnprocessableEntity, "validation_failed", "invalid taxId: "+err.Error())
			return
		}
	}
	seller.ID = newID("sel")
	if seller.MerchantID == "" {
		seller.MerchantID = "m_" + seller.ID
	}
	if seller.Currency == "" {
		seller.Currency = "VES"
	}
	seller.CreatedAt = time.Now()
	if err := s.store.SaveSeller(seller); err != nil {
		writeError(w, http.StatusConflict, "conflict", err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, seller)
}

type storefrontResponse struct {
	Seller   domain.Seller    `json:"seller"`
	Products []domain.Product `json:"products"`
}

func (s *Server) handleStorefront(w http.ResponseWriter, r *http.Request) {
	seller, err := s.store.SellerByHandle(r.PathValue("handle"))
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "storefront not found")
		return
	}
	var active []domain.Product
	for _, p := range s.store.ProductsBySeller(seller.ID) {
		if p.Active {
			active = append(active, p)
		}
	}
	writeJSON(w, http.StatusOK, storefrontResponse{Seller: seller, Products: active})
}

func (s *Server) handleAddProduct(w http.ResponseWriter, r *http.Request) {
	seller, err := s.store.Seller(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "seller not found")
		return
	}
	var p domain.Product
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", err.Error())
		return
	}
	if p.Title == "" || p.Price == "" {
		writeError(w, http.StatusUnprocessableEntity, "validation_failed", "title and price are required")
		return
	}
	p.ID = newID("prod")
	p.SellerID = seller.ID
	if p.Currency == "" {
		p.Currency = seller.Currency
	}
	if p.TaxRate == "" {
		p.TaxRate = "16.00"
	}
	if err := s.store.SaveProduct(p); err != nil {
		writeError(w, http.StatusInternalServerError, "save_failed", err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, p)
}

type placeOrderRequest struct {
	SellerID   string            `json:"sellerId"`
	Channel    string            `json:"channel,omitempty"`
	Items      []domain.CartItem `json:"items"`
	BuyerName  string            `json:"buyerName,omitempty"`
	BuyerTaxID string            `json:"buyerTaxId,omitempty"`
}

func (s *Server) handlePlaceOrder(w http.ResponseWriter, r *http.Request) {
	var req placeOrderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", err.Error())
		return
	}
	seller, err := s.store.Seller(req.SellerID)
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "seller not found")
		return
	}
	products := map[string]domain.Product{}
	for _, ci := range req.Items {
		p, err := s.store.Product(ci.ProductID)
		if err != nil {
			writeError(w, http.StatusUnprocessableEntity, "validation_failed", "unknown product "+ci.ProductID)
			return
		}
		products[p.ID] = p
	}
	order, err := domain.PriceOrder(seller, products, req.Items)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, "validation_failed", err.Error())
		return
	}
	order.ID = newID("ord")
	order.Channel = req.Channel
	order.BuyerName = req.BuyerName
	order.BuyerTaxID = req.BuyerTaxID
	order.CreatedAt = time.Now()

	// Reserve stock at order time so concurrent checkouts can't oversell.
	if err := s.store.DecrementStock(order.Lines); err != nil {
		writeError(w, http.StatusConflict, "out_of_stock", err.Error())
		return
	}
	if err := s.store.SaveOrder(order); err != nil {
		writeError(w, http.StatusInternalServerError, "save_failed", err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, order)
}

type markPaidRequest struct {
	PaymentIntentID string `json:"paymentIntentId"`
	InvoiceID       string `json:"invoiceId,omitempty"`
}

func (s *Server) handleMarkPaid(w http.ResponseWriter, r *http.Request) {
	order, err := s.store.Order(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "order not found")
		return
	}
	var req markPaidRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", err.Error())
		return
	}
	order.PaymentIntentID = req.PaymentIntentID
	order.Status = domain.OrderPaid
	if req.InvoiceID != "" {
		order.InvoiceID = req.InvoiceID
		order.Status = domain.OrderInvoiced
	}
	_ = s.store.SaveOrder(order)
	writeJSON(w, http.StatusOK, order)
}

func (s *Server) handleGetOrder(w http.ResponseWriter, r *http.Request) {
	order, err := s.store.Order(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "order not found")
		return
	}
	writeJSON(w, http.StatusOK, order)
}

func newID(prefix string) string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return prefix + "_" + hex.EncodeToString(b)
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(code)
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	_ = enc.Encode(v)
}

func writeError(w http.ResponseWriter, code int, kind, msg string) {
	writeJSON(w, code, map[string]string{"error": kind, "message": msg})
}
