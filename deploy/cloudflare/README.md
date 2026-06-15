# Deploying Meriplaza to Cloudflare Containers

This deploys the three Go services as **Cloudflare Containers** behind a single
Worker that routes by path prefix. Postgres is **not** part of Cloudflare — the
containers connect out to a managed Postgres (Neon, Supabase, RDS, etc.).

```
client ──▶ Worker (worker.js)
              ├─ /fiscal/*    ▶ FiscalContainer    ▶ fiscald   :8080
              ├─ /payments/*  ▶ PaymentsContainer  ▶ paymentsd :8080
              └─ /catalog/*   ▶ CatalogContainer   ▶ catalogd  :8080
                                     │
                                     └──▶ managed Postgres (DATABASE_URL)
```

## Why this shape

Cloudflare Workers run JS/WASM and **cannot run our Go `net/http` binaries**.
Cloudflare Containers (GA in 2025) run real Docker images, driven by a Durable
Object per container class, with a Worker in front. So the Worker is just a
router; the actual services are the same images used in `deploy/`.

## Prerequisites

- A Cloudflare account on a plan with **Containers** enabled (Workers Paid).
- `node` + `npm`, and Docker available locally (wrangler builds the images).
- A managed Postgres database reachable over the public internet (e.g. a free
  Neon project). Grab its connection string.

## One-time setup

```sh
cd deploy/cloudflare
npm install
npx wrangler login
```

## Configure secrets

The services read two env vars. Set them as Worker secrets; they are forwarded
into the containers:

```sh
npx wrangler secret put DATABASE_URL   # postgres://user:pass@host/db?sslmode=require
npx wrangler secret put API_USERS      # admin:strongpass,pos:anotherpass
```

> Containers inherit Worker vars/secrets. If your wrangler version requires it,
> also list them under each container's `envVars` in `wrangler.jsonc`.

### Optional: Hyperdrive

For lower latency and connection pooling to Postgres, create a Hyperdrive config
and point `DATABASE_URL` at the Hyperdrive connection string instead of the
origin database. Direct connection works without it.

## Deploy

```sh
npx wrangler deploy
```

Wrangler builds `fiscal.Dockerfile`, `payments.Dockerfile`, and
`catalog.Dockerfile` (build context = repo root), pushes them to Cloudflare's
registry, and provisions the Worker + Durable Objects.

## Use

```
GET  https://meriplaza.<your-subdomain>.workers.dev/healthz
POST https://meriplaza.<your-subdomain>.workers.dev/fiscal/invoices
POST https://meriplaza.<your-subdomain>.workers.dev/catalog/sellers
```

(All non-storefront routes require the Basic Auth credentials from `API_USERS`.)

## Caveats / not done

- **Not yet deployed or load-tested** — this is verified-by-construction config.
  The container images are the same ones validated locally with podman.
- Migrations run on container cold-start; with `sleepAfter`/scale-to-zero that's
  cheap and idempotent, but for many instances prefer a one-shot migration job.
- No custom domain wired (uses `*.workers.dev`); add a route for production.
- Cross-service calls (catalog → payments → fiscal) currently go through the
  client; an internal service binding would be the next step.
