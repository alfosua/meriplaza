# SalesFactory

A monorepo of Venezuela-focused commerce products on a shared Go backend and a
lightweight (HTML/CSS/Web Components) frontend, built for low-connectivity and
constrained POS hardware.

- **Fiscal Invoicing** — SENIAT-compatible fiscal invoices (working).
- **Payment Gateway** — from-scratch gateway for local VE methods, international
  (US/Panama), and crypto.
- **Commerce + Storefronts** — "Amazon for Venezuela" with Shopify-like,
  customizable seller fronts and social-commerce (Instagram/WhatsApp/Facebook).

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full design.

## Quick start

```sh
make test          # run all tests
make run-fiscal    # start the fiscal API on :8081
```

### Emit a fiscal invoice

```sh
curl -X POST localhost:8081/invoices -H 'Content-Type: application/json' -d @docs/examples/invoice-min.json
curl localhost:8081/invoices/<id>/render        # 80mm thermal text
```
