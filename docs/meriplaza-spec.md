# Meriplaza — Product Specification

> Part of the **Meriplaza** family of Venezuela-focused commerce products.
> This document summarizes what Meriplaza is, how it's built, and its current
> state. It reflects the system as deployed, not an aspirational roadmap.

## 1. What it is

Meriplaza is **"el mercado de Venezuela"** — a centralized, multi-store online
marketplace (think Amazon) where many independent stores sell on one platform,
while each store keeps its own customizable, branded storefront (think Shopify).
It targets **low-connectivity and constrained hardware** without sacrificing a
beautiful, mobile-first experience.

**Live:** https://meriplaza-edge.alfosuag.workers.dev
(`meriplaza.pages.dev` 302-redirects to it).

## 2. Goals & principles

- **Centralized + personal.** One catalog and checkout; per-seller branded
  storefronts and custom layouts (the CMS angle).
- **Performance first.** Server-side rendered at the edge; minimal JS; full
  first paint without JavaScript; lazy images; KV caching; offline-tolerant.
- **Beautiful & mobile-first.** Apple-sophisticated visual language, white
  background, blue + yellow accents, generous whitespace.
- **Venezuela reality.** Bolívares + divisas + crypto, BCV exchange display,
  local delivery (Yummy/Ridery/Tango), delivery-by-city availability, SENIAT
  fiscal invoicing (via the Meriplaza fiscal service).
- **Trust never on the client.** Totals, stock, and pricing are recomputed
  server-side; money is exact (integer minor units, never float).

## 3. Architecture

| Layer | Technology |
| --- | --- |
| Runtime | Cloudflare **Workers** (free plan), server-side rendered |
| Web framework | **Hono** (TypeScript) |
| Database | Cloudflare **D1** (SQLite at the edge) |
| Cache | Cloudflare **KV** (marketplace landing, FX rate) |
| Frontend | SSR HTML + a small progressive-enhancement script; no SPA framework |
| Hosting | Single Worker serves HTML pages + JSON API + static assets |

The Worker renders pages on the edge (`src/ssr/`) and exposes a JSON API under
`/catalog` and `/payments`. A tiny `app.js` adds the cart drawer, gallery,
filters, city selector, and form handling. Cross-page navigation uses native
view transitions + speculation-rules prefetch.

> A parallel **Go** implementation of the catalog/payments/fiscal services
> exists under `services/` for on-prem / VPS deployments (Postgres). Meriplaza's
> live edge build is the TypeScript Worker (`edge/`). Logic is mirrored with
> identical test vectors.

## 4. Data model (D1)

- **sellers** — store profile (handle, name, kind, RIF, theme colors/logo/
  layout, socials, shipping methods, currency). JSON doc + promoted columns.
- **products** — canonical catalog item (title, slug, brand, category, long
  description, images[], specs{}, rating aggregate). *No price/seller.*
- **offers** — a seller's offer for a product (price, currency, tax rate, stock,
  `compare_at`, `promo`, `featured`). **Multiple stores can offer the same
  product** → price comparison. Unique per (product, seller).
- **reviews** — per-product user reviews; recompute product rating.
- **categories** — reference list with icons.
- **cities** + **store_cities** — delivery cities and which stores cover them.
- **promotions** — home banners (deal / bundle / event / holiday).
- **orders** — placed orders (lines reference offers; per single seller).
- **users** + **sessions** — accounts (customer / store / admin), PBKDF2 + cookie.

## 5. Key features (implemented)

**Shopping**
- Search-first home; category chips; advanced **filter sidebar** (sort,
  category, store, city) with a mobile drawer.
- **Delivery city selector** (persisted); products filtered to those deliverable
  to the chosen city.
- Product cards: image, rating, price, discount %, low-stock urgency, dual
  currency (≈ Bs/$), add-to-cart.
- **Product detail page**: image gallery, brand, rating, discount + compare-at,
  dual currency, **multi-store offer comparison** (cheapest highlighted), specs,
  shipping providers + ETA, delivery cities, trust badge, related products,
  sticky mobile add-to-cart, reviews + review form.
- Unified **cart drawer** and full `/carrito` page grouped by store; checkout
  creates one order per store, confirms payment intents server-side, and emits
  fiscal invoice metadata for successful payments.
- Promotions: home banners, featured "Ofertas destacadas", sale badges.

**Stores (sellers)**
- Branded storefront at `/t/{handle}` honoring theme (colors, logo, tagline) and
  `layout` (grid / list / featured) — custom frontends on shared infra.
- Shipping methods shown; store dashboard at `/tienda/panel`.

**Accounts & portals**
- Customer / store / operator roles; signup, login, sessions.
- **Merchant onboarding** `/comercios` and hidden legacy `/admin` redirect.
- **Merchant/operator portal** `/comercios/portal`: stats, recent orders, add
  product, add offer.
- **Store dashboard** `/tienda/panel`: orders, shipment updates, checkout payment
  instructions, publish offers, my offers.
- Account `/cuenta`: saved delivery address, fiscal profile, orders, payment
  methods.

**Payments & money**
- Methods: PagoMóvil, transferencia, divisas, punto de venta, card (US/Panamá),
  crypto (via the Meriplaza payments engine).
- Multi-currency display using the **BCV** reference rate (KV-cached).
- Fiscal invoices via the Meriplaza fiscal service (SENIAT-compatible).

**SEO & UX**
- Per-page title/description/canonical, Open Graph + Twitter, **JSON-LD**
  (WebSite + Product), semantic structured data.
- Native cross-page view transitions; link prefetch.

## 6. Routes

| Path | Purpose |
| --- | --- |
| `GET /` | Home: search, categories, promos, featured, filter sidebar, stores |
| `GET /p/:slug` | Product detail |
| `GET /t/:handle` | Store storefront |
| `GET /cuenta` | Account / login + register |
| `GET /comercios` | Merchant onboarding landing page |
| `GET /comercios/portal` | Merchant/operator portal (operator role) |
| `GET /admin` | Legacy redirect to `/comercios` |
| `GET /tienda/panel` | Store dashboard (store role) |
| `GET /set-city/:slug` | Persist delivery city |
| `GET /catalog/*`, `POST /catalog/*` | JSON API (products, offers, sellers, orders, reviews, promotions, cities) |
| `POST /payments/*` | Payment intents |
| `GET /assets/app.css`, `/assets/app.js` | Static assets |

**Auth model:** browsing + placing orders + paying + reviews are public
(Stripe-publishable-key style). Store/catalog management requires an
operator/store session or HTTP Basic Auth.

## 7. Demo data

14 stores (incl. Traki with ~200 products, Samsung, Farmatodo, Locatel, EPA,
Beco, Santo Tomé, Miyake, plus independents), ~637 products, hundreds of offers,
8 cities, reviews, and promo banners. Seeded via `edge/scripts/seed-v3.mjs`;
images sourced via `edge/scripts/fetch-images.mjs` (Wikimedia) → `images.json`
with category image pools for generated catalog rows.

Demo logins: operator `admin@meriplaza.ve` / `admin1234`.

## 8. Known gaps / next steps

- BCV live rate scraping is best-effort; rate is a KV value with a fallback.
- Search API paginates at ~60 results (store pages show all); no infinite scroll.
- Live payment processors are simulated in the edge demo; production bank/crypto
  settlement adapters still need real provider credentials/webhooks.
- Some product images are imperfect category matches.
- No email verification / password reset; sessions aren't rotated.

## 9. Repo map (edge build)

```
edge/
  src/index.ts            Worker entry: routes, auth gate, SSR wiring
  src/ssr/                theme.ts (CSS), app-js.ts, pages.ts, account.ts, brand.ts
  src/catalog/routes.ts   products/offers/reviews/sellers/orders/cities/promotions
  src/payments/           payment intents + processors
  src/auth/               accounts (PBKDF2 + sessions)
  src/quickpago/          QuickPago product (see quickpago-spec.md)
  src/lib/                money, ident, pricing, fx, env, pg
  migrations/             D1 schema (0001..0005)
  scripts/                seed-v2/v3, fetch-images
```
