# QuickPago — Product Specification

> A **SalesFactory** product, separate from Meriplaza. Built on the same
> payments engine, but with its own brand, portal, login, and data.

## 1. What it is

QuickPago is a **payment-collection product for merchants** ("cobros para
comercios"). Any business — inside or outside Meriplaza — signs up to accept
**PagoMóvil, transferencia nacional, and crypto**, share a charge (cobro), and
reconcile transactions in one panel.

It is intentionally a **standalone product**: its own teal branding, its own
authentication and session, its own data tables, and its own portal UI. It is
not gated behind a Meriplaza account.

**Live:** https://salesfactory-edge.alfosuag.workers.dev/quickpago

## 2. Why separate from Meriplaza

- **Different audience.** Meriplaza = shoppers + marketplace sellers; QuickPago =
  any merchant collecting payments (a barbershop, a freelancer, a store not on
  Meriplaza).
- **Separate trust boundary.** Distinct credentials, session cookie scoped to
  `/quickpago`, and isolated data (`qp_*` tables) — a QuickPago merchant is not a
  Meriplaza user.
- **Reuse the engine, not the product.** Shares SalesFactory's payment
  processors and PBKDF2 hashing, but ships its own portal and lifecycle.

## 3. Architecture

| Layer | Technology |
| --- | --- |
| Runtime | Cloudflare **Workers**, server-side rendered (Hono) |
| Data | Cloudflare **D1** (`qp_merchants`, `qp_sessions`, `qp_transactions`) |
| Auth | Own signup/login; **`qp_session`** HttpOnly cookie (path `/quickpago`); PBKDF2 (Web Crypto) |
| UI | SSR pages with its own teal brand on the shared base stylesheet |
| Code | `edge/src/quickpago/` (`routes.ts`, `pages.ts`), migration `0005_quickpago.sql` |

## 4. Data model (D1)

- **qp_merchants** — `id, business, rif, email, pass_hash, pass_salt, methods
  (JSON), status, created_at`. `methods` holds per-rail config:
  - `pagomovil`: `{ bank, phone, ci }`
  - `transfer`: `{ bank, account, holder }`
  - `crypto`: `{ network, asset, address }`
- **qp_sessions** — `id (token), merchant_id, expires`.
- **qp_transactions** — `id, merchant_id, amount, currency, method, status
  (pending|confirmed), reference (QP-XXXX), payer, created_at`.

## 5. Features (implemented)

- **Merchant signup / login / logout** (separate from Meriplaza).
- **Configure cobro methods**: PagoMóvil (bank/phone/cédula), transferencia
  (bank/account/holder), crypto (network/asset/address).
- **Create a charge (cobro)**: amount + currency + method → generates a shareable
  reference (`QP-XXXXXXXX`), status `pending`.
- **Transactions list** with confirm action (`pending` → `confirmed`).
- Marketing **landing page** positioning it as a SalesFactory product built on
  the same gateway that powers Meriplaza.

## 6. Routes

| Path | Purpose |
| --- | --- |
| `GET /quickpago` | Marketing landing |
| `GET /quickpago/portal` | Merchant dashboard (login/register when signed out) |
| `POST /quickpago/api/register` | Create merchant + session |
| `POST /quickpago/api/login` / `logout` | Session management |
| `POST /quickpago/api/methods` | Save cobro method config |
| `POST /quickpago/api/charge` | Create a charge → `{ reference, status }` |
| `POST /quickpago/api/tx/:id/confirm` | Mark a transaction confirmed |

All `/quickpago/*` routes are public at the Meriplaza auth gate; QuickPago
enforces its own merchant auth internally via the `qp_session` cookie.

## 7. Relationship to SalesFactory payments

QuickPago's method set mirrors the SalesFactory payment **processors**
(`pago_movil`, `transferencia`, `crypto`, …). Today QuickPago records charges and
their lifecycle; wiring each charge through the live processors for real
settlement (C2P confirmation, on-chain confirmation, bank reference matching) is
the next step.

## 8. Demo

Demo merchant: `qp@demo.ve` / `qp123456`. Sign up a new merchant at
`/quickpago/portal`, configure methods, and create a cobro.

## 9. Known gaps / next steps

- Charges are recorded but not yet executed through the real payment processors
  (no live PagoMóvil C2P confirmation or on-chain settlement).
- No payment-link page / QR for the payer to complete the cobro (reference only).
- No webhooks, payouts, fees, or multi-user merchant teams.
- No email verification / password reset; sessions aren't rotated.

## 10. See also

- [meriplaza-spec.md](meriplaza-spec.md) — the marketplace product.
- [ARCHITECTURE.md](ARCHITECTURE.md) — SalesFactory platform overview.
