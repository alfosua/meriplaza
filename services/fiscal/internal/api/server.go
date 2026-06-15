// Package api exposes the fiscal invoicing HTTP API described in
// docs/venezuela-fiscal-invoice-api.md.
//
// Routes:
//
//	POST /invoices              validate + emit an invoice
//	GET  /invoices/{id}         fetch the canonical stored invoice
//	GET  /invoices/{id}/render  render (?format=thermal-80mm|json)
//	GET  /healthz               liveness probe
package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/catalinalabs/meriplaza/services/fiscal/internal/domain"
	"github.com/catalinalabs/meriplaza/services/fiscal/internal/render"
	"github.com/catalinalabs/meriplaza/services/fiscal/internal/store"
)

type Server struct {
	store store.Store
	mux   *http.ServeMux
	now   func() time.Time
}

func New(s store.Store) *Server {
	srv := &Server{store: s, mux: http.NewServeMux(), now: time.Now}
	srv.routes()
	return srv
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) { s.mux.ServeHTTP(w, r) }

func (s *Server) routes() {
	s.mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	s.mux.HandleFunc("POST /invoices", s.handleEmit)
	s.mux.HandleFunc("GET /invoices/{id}", s.handleGet)
	s.mux.HandleFunc("GET /invoices/{id}/render", s.handleRender)
}

func (s *Server) handleEmit(w http.ResponseWriter, r *http.Request) {
	var in domain.Invoice
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", err.Error())
		return
	}

	canonical, err := domain.Reconcile(in)
	if err != nil {
		var ve *domain.ValidationError
		if errors.As(err, &ve) {
			writeJSON(w, http.StatusUnprocessableEntity, map[string]any{
				"error":    "validation_failed",
				"problems": ve.Problems,
			})
			return
		}
		writeError(w, http.StatusBadRequest, "reconcile_failed", err.Error())
		return
	}

	// Emit: assign id, fiscal number, timestamp, and mark issued. In a real
	// fiscal-machine channel these come from the printer/provider adapter; the
	// in-process emitter is used for digital/free-form development flows.
	canonical.ID = store.NewID()
	if canonical.Document.Number == "" {
		num, err := s.store.NextNumber(seriesKey(canonical))
		if err != nil {
			writeError(w, http.StatusInternalServerError, "numbering_failed", err.Error())
			return
		}
		canonical.Document.Number = num
	}
	if canonical.Document.IssuedAt == "" {
		canonical.Document.IssuedAt = s.now().Format(time.RFC3339)
	}
	if canonical.FiscalControl == nil {
		canonical.FiscalControl = &domain.FiscalControl{AuthorityName: "SENIAT"}
	}
	canonical.Status = domain.StatusIssued

	if err := s.store.Save(canonical); err != nil {
		writeError(w, http.StatusInternalServerError, "save_failed", err.Error())
		return
	}
	w.Header().Set("Location", "/invoices/"+canonical.ID)
	writeJSON(w, http.StatusCreated, canonical)
}

func (s *Server) handleGet(w http.ResponseWriter, r *http.Request) {
	inv, err := s.store.Get(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "invoice not found")
		return
	}
	writeJSON(w, http.StatusOK, inv)
}

func (s *Server) handleRender(w http.ResponseWriter, r *http.Request) {
	inv, err := s.store.Get(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "invoice not found")
		return
	}
	switch r.URL.Query().Get("format") {
	case "", "thermal-80mm":
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(render.Thermal(inv)))
	case "json":
		writeJSON(w, http.StatusOK, inv)
	default:
		writeError(w, http.StatusBadRequest, "unsupported_format", "format must be thermal-80mm or json")
	}
}

// seriesKey groups consecutive numbering by issuer + POS terminal, matching how
// fiscal series are scoped per device.
func seriesKey(inv domain.Invoice) string {
	issuer := ""
	if inv.Issuer.Identifier != nil {
		issuer = inv.Issuer.Identifier.Value
	}
	term := ""
	if inv.POS != nil {
		term = inv.POS.TerminalCode
	}
	return strings.Join([]string{issuer, term}, "/")
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
