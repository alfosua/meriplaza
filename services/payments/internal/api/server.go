// Package api exposes the payment gateway HTTP API.
//
// Routes:
//
//	POST /payment_intents              create an intent (Idempotency-Key honored)
//	POST /payment_intents/{id}/confirm advance the intent via its processor
//	POST /payment_intents/{id}/cancel  cancel a non-terminal intent
//	GET  /payment_intents/{id}         fetch an intent
//	GET  /healthz                      liveness probe
package api

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"time"

	"github.com/catalinalabs/meriplaza/services/payments/internal/domain"
	"github.com/catalinalabs/meriplaza/services/payments/internal/processor"
	"github.com/catalinalabs/meriplaza/services/payments/internal/store"
)

type Server struct {
	store store.Store
	procs *processor.Registry
	mux   *http.ServeMux
	now   func() time.Time
}

func New(s store.Store, p *processor.Registry) *Server {
	srv := &Server{store: s, procs: p, mux: http.NewServeMux(), now: time.Now}
	srv.routes()
	return srv
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) { s.mux.ServeHTTP(w, r) }

func (s *Server) routes() {
	s.mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	s.mux.HandleFunc("POST /payment_intents", s.handleCreate)
	s.mux.HandleFunc("GET /payment_intents/{id}", s.handleGet)
	s.mux.HandleFunc("POST /payment_intents/{id}/confirm", s.handleConfirm)
	s.mux.HandleFunc("POST /payment_intents/{id}/cancel", s.handleCancel)
}

type createRequest struct {
	Amount      domain.Amount  `json:"amount"`
	Method      domain.Method  `json:"method"`
	MerchantID  string         `json:"merchantId"`
	OrderRef    string         `json:"orderRef,omitempty"`
	Description string         `json:"description,omitempty"`
	MethodData  map[string]any `json:"methodData,omitempty"`
}

func (s *Server) handleCreate(w http.ResponseWriter, r *http.Request) {
	var req createRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", err.Error())
		return
	}
	if err := domain.ValidateCreate(req.Amount, req.Method, req.MerchantID); err != nil {
		writeError(w, http.StatusUnprocessableEntity, "validation_failed", err.Error())
		return
	}

	key := r.Header.Get("Idempotency-Key")
	if existing, ok := s.store.FindByIdempotencyKey(req.MerchantID, key); ok {
		writeJSON(w, http.StatusOK, existing)
		return
	}

	now := s.now()
	pi := domain.PaymentIntent{
		ID:             newID("pi"),
		Amount:         req.Amount,
		Method:         req.Method,
		Status:         domain.StatusRequiresConfirmation,
		MerchantID:     req.MerchantID,
		OrderRef:       req.OrderRef,
		Description:    req.Description,
		IdempotencyKey: key,
		MethodData:     req.MethodData,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	if err := s.store.Save(pi); err != nil {
		writeError(w, http.StatusInternalServerError, "save_failed", err.Error())
		return
	}
	w.Header().Set("Location", "/payment_intents/"+pi.ID)
	writeJSON(w, http.StatusCreated, pi)
}

type confirmRequest struct {
	MethodData map[string]any `json:"methodData,omitempty"`
}

func (s *Server) handleConfirm(w http.ResponseWriter, r *http.Request) {
	pi, err := s.store.Get(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "payment intent not found")
		return
	}
	if pi.Status.IsTerminal() {
		writeJSON(w, http.StatusOK, pi) // idempotent: already finished
		return
	}

	// Merge any additional method data supplied at confirm time (OTP, refs...).
	var req confirmRequest
	if r.Body != nil {
		_ = json.NewDecoder(r.Body).Decode(&req)
	}
	if len(req.MethodData) > 0 {
		if pi.MethodData == nil {
			pi.MethodData = map[string]any{}
		}
		for k, v := range req.MethodData {
			pi.MethodData[k] = v
		}
	}

	proc, err := s.procs.For(pi.Method)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, "unsupported_method", err.Error())
		return
	}
	res, err := proc.Confirm(pi)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "processor_error", err.Error())
		return
	}

	pi.Status = res.Status
	pi.NextAction = res.NextAction
	pi.Settlement = res.Settlement
	pi.FailureReason = res.Failure
	pi.UpdatedAt = s.now()
	if err := s.store.Save(pi); err != nil {
		writeError(w, http.StatusInternalServerError, "save_failed", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, pi)
}

func (s *Server) handleCancel(w http.ResponseWriter, r *http.Request) {
	pi, err := s.store.Get(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "payment intent not found")
		return
	}
	if pi.Status.IsTerminal() {
		writeJSON(w, http.StatusOK, pi)
		return
	}
	pi.Status = domain.StatusCanceled
	pi.UpdatedAt = s.now()
	_ = s.store.Save(pi)
	writeJSON(w, http.StatusOK, pi)
}

func (s *Server) handleGet(w http.ResponseWriter, r *http.Request) {
	pi, err := s.store.Get(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "payment intent not found")
		return
	}
	writeJSON(w, http.StatusOK, pi)
}

func newID(prefix string) string {
	b := make([]byte, 12)
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
