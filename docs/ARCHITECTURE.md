# SalesFactory Platform Architecture

SalesFactory is a monorepo for a group of Venezuela-focused commerce products
that share infrastructure, a Go backend, and a lightweight web frontend. The
products are designed for **low-connectivity environments and constrained POS
hardware**: small dependency footprints, ASCII-friendly rendering, offline-
tolerant flows, and cheap to self-host.

## Products

| Product | Module path | Status | Purpose |
| --- | --- | --- | --- |
| Fiscal Invoicing | `services/fiscal` | **working** | SENIAT-compatible fiscal invoices; canonical model, server-side reconciliation, thermal render. |
| Payment Gateway | `services/payments` | **working** | Stripe-like gateway built from scratch: local VE methods (pago móvil, transferencia, divisas, punto de venta), international (US/Panama), and crypto. |
| Commerce / Catalog | `services/catalog` | **working** | "Amazon for Venezuela": sellers, products, inventory, and orders linked to payments + fiscal. |
| Storefronts | `web/components/sf-storefront.js` | **working** | Shopify-like, customizable per-seller front as a vanilla Web Component on shared catalog infra. |
| Social Commerce | `services/catalog` (channel) + `services/social` | partial | Order `channel` + seller `socials` model WhatsApp/Instagram/Facebook today; a dedicated sync/conversational service is planned. |

## Shared libraries (`libs/`)

- **`libs/money`** — decimal-safe money (integer minor units + `big.Int`), no
  `float64`. Foundational for fiscal totals and payment amounts.
- **`libs/ident`** — Venezuelan identifiers (V/E cédulas, J/G RIF with modulo-11
  check digit). Reused by fiscal, payments KYC, and seller onboarding.
- **`libs/httpx`** *(planned)* — shared HTTP helpers (JSON, errors, middleware).

A single Go module (`github.com/catalinalabs/salesfactory`) keeps cross-product
imports trivial. Each product is a `services/<name>` package tree with its own
`cmd/<name>d` binary and `internal/` packages, so products stay decoupled at the
package level while sharing `libs/`.

## Design principles

1. **Money is never a float.** All amounts flow through `libs/money`; arithmetic
   uses `big.Int`/`big.Rat`. Fiscal and payment amounts round to the currency's
   minor unit (centimos).
2. **Never trust client totals.** Servers recompute and reject mismatches
   (`domain.Reconcile`). Same rule will apply to payment captures.
3. **Low-connectivity first.** Thermal/printable output is plain text. APIs are
   idempotent where possible so retries over flaky links are safe.
4. **Bolívar + divisas reality.** First-class FX disclosure (BCV rate) and
   foreign-currency payment legs are built into the core models, not bolted on.
5. **Render is separate from data.** Canonical JSON stays structured; rendering
   (thermal, PDF, HTML) is a downstream concern.

## Frontend

Plain HTML, CSS, and vanilla Web Components (`web/components/`) — no framework,
no build step required to run. Components are progressively enhanced so a
storefront degrades to static HTML on slow or offline connections.

## Running

```sh
make test          # all Go tests
make build         # all binaries
make run-fiscal    # fiscal API     :8081
make run-payments  # payment gateway :8082
make run-catalog   # commerce API    :8083
```

Open `web/demo.html` (served statically) to see the `<sf-storefront>` component
talking to `catalogd`. The component emits an `sf-checkout` event that a host
app wires to the payments gateway and then the fiscal service.

## Persistence & auth

Each service selects its store at startup: `DATABASE_URL` set → Postgres
(`libs/pg`, migrations run on boot); unset → in-memory (dev). `API_USERS`
(`user:pass,...`) enables HTTP Basic Auth via `libs/httpx`; unset → auth off
with a warning. Public storefront reads (`GET /sellers/{handle}`) stay
unauthenticated so the Web Component can load.

## Deployment

- **Single host / VPS:** `deploy/docker-compose.yml` brings up Postgres + the
  three services + the static frontend. See `deploy/.env.example`.
- **Cloudflare Containers:** `deploy/cloudflare/` — a Worker routes by path
  prefix to one container per service, with Postgres hosted externally (Neon)
  reached over the container's outbound network. See its README. (Workers
  cannot run Go `net/http`; Containers run the real images.)

Container images are tiny static binaries on distroless/nonroot — fast to pull
on low-bandwidth links. Verified locally with podman (build, run, Postgres
persistence, auth).

See each `services/<name>/README.md` for product-specific details.
