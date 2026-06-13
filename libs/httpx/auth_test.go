package httpx

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func okHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusTeapot) })
}

func TestBasicAuthDisabledWhenNoCreds(t *testing.T) {
	h := BasicAuth(okHandler(), CredentialsFromEnv(""), nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/x", nil))
	if rec.Code != http.StatusTeapot {
		t.Fatalf("expected pass-through, got %d", rec.Code)
	}
}

func TestBasicAuthRejectsAndAccepts(t *testing.T) {
	creds := CredentialsFromEnv("admin:secret,pos:p4ss")
	h := BasicAuth(okHandler(), creds, SkipPaths("/healthz"))

	// no auth -> 401
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/orders", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}

	// bypass path -> allowed
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/healthz", nil))
	if rec.Code != http.StatusTeapot {
		t.Fatalf("healthz should bypass, got %d", rec.Code)
	}

	// correct creds -> allowed
	rec = httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/orders", nil)
	req.SetBasicAuth("admin", "secret")
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusTeapot {
		t.Fatalf("valid creds should pass, got %d", rec.Code)
	}

	// wrong pass -> 401
	rec = httptest.NewRecorder()
	req = httptest.NewRequest("GET", "/orders", nil)
	req.SetBasicAuth("admin", "nope")
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("wrong pass should 401, got %d", rec.Code)
	}
}

func TestPublicStorefrontReads(t *testing.T) {
	creds := CredentialsFromEnv("admin:secret")
	h := BasicAuth(okHandler(), creds, PublicStorefrontReads())

	// GET storefront -> public
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/sellers/bodega-maria", nil))
	if rec.Code != http.StatusTeapot {
		t.Fatalf("storefront read should be public, got %d", rec.Code)
	}
	// POST seller -> requires auth
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("POST", "/sellers", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("seller create should require auth, got %d", rec.Code)
	}
	// GET order -> requires auth (not a storefront path)
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/orders/ord_1", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("order read should require auth, got %d", rec.Code)
	}
	// POST add product (two segments) -> requires auth
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("POST", "/sellers/sel_1/products", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("add product should require auth, got %d", rec.Code)
	}
}
