// Package httpx holds small HTTP helpers shared across Meriplaza services:
// authentication middleware and config helpers. It has no third-party deps so
// every service can adopt it cheaply.
package httpx

import (
	"crypto/subtle"
	"net/http"
	"os"
	"strings"
)

// Credentials maps a username to its password for HTTP Basic Auth.
type Credentials map[string]string

// CredentialsFromEnv parses a credentials string of the form
// "user1:pass1,user2:pass2" (typically from an env var). An empty string yields
// an empty set, which BasicAuth treats as "auth disabled".
func CredentialsFromEnv(v string) Credentials {
	creds := Credentials{}
	for _, pair := range strings.Split(v, ",") {
		pair = strings.TrimSpace(pair)
		if pair == "" {
			continue
		}
		user, pass, ok := strings.Cut(pair, ":")
		if ok && user != "" {
			creds[user] = pass
		}
	}
	return creds
}

// SkipFunc reports whether a request should bypass authentication.
type SkipFunc func(*http.Request) bool

// SkipPaths returns a SkipFunc matching any of the given exact paths (e.g.
// "/healthz").
func SkipPaths(paths ...string) SkipFunc {
	set := map[string]bool{}
	for _, p := range paths {
		set[p] = true
	}
	return func(r *http.Request) bool { return set[r.URL.Path] }
}

// PublicStorefrontReads allows unauthenticated GET/HEAD of a seller's public
// storefront (GET /sellers/{handle}) while still protecting writes and other
// reads. Used by catalogd so the storefront Web Component can load without
// credentials.
func PublicStorefrontReads() SkipFunc {
	return func(r *http.Request) bool {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			return false
		}
		p := r.URL.Path
		if p == "/healthz" {
			return true
		}
		// /sellers/{handle} (single segment after /sellers/), not /sellers itself.
		const pre = "/sellers/"
		if strings.HasPrefix(p, pre) {
			rest := strings.Trim(p[len(pre):], "/")
			return rest != "" && !strings.Contains(rest, "/")
		}
		return false
	}
}

// BasicAuth wraps a handler with HTTP Basic Auth. Requests for which skip
// returns true are always allowed (pass nil to authenticate everything except
// when creds is empty). If creds is empty, auth is disabled and every request
// passes through — useful for local dev, and logged by the caller.
func BasicAuth(next http.Handler, creds Credentials, skip SkipFunc) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if len(creds) == 0 || (skip != nil && skip(r)) {
			next.ServeHTTP(w, r)
			return
		}
		user, pass, ok := r.BasicAuth()
		if !ok || !credsMatch(creds, user, pass) {
			w.Header().Set("WWW-Authenticate", `Basic realm="meriplaza"`)
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// credsMatch does a constant-time comparison to avoid timing leaks. It always
// compares against a candidate so a missing user costs the same as a wrong pass.
func credsMatch(creds Credentials, user, pass string) bool {
	want, ok := creds[user]
	if !ok {
		want = ""
	}
	match := subtle.ConstantTimeCompare([]byte(pass), []byte(want)) == 1
	return ok && match
}

// Env returns the env var value or a fallback default.
func Env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
