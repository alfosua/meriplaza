// Cloudflare Worker that fronts the three SalesFactory containers.
//
// Cloudflare Containers are driven by a Durable Object per container class. The
// Worker routes by the first path segment and rewrites the URL so each Go
// service still sees its own root paths:
//
//   /fiscal/invoices       -> fiscal container,   /invoices
//   /payments/payment_...  -> payments container, /payment_...
//   /catalog/sellers/...   -> catalog container,  /sellers/...
//
// Secrets (DATABASE_URL, API_USERS) are injected into the containers via
// `envVars` configured in wrangler.jsonc / `wrangler secret`.
import { Container, getContainer } from "@cloudflare/containers";

class BaseService extends Container {
  defaultPort = 8080;
  sleepAfter = "10m"; // scale to zero after idle to save cost
}

export class FiscalContainer extends BaseService {}
export class PaymentsContainer extends BaseService {}
export class CatalogContainer extends BaseService {}

const ROUTES = {
  fiscal: "FISCAL",
  payments: "PAYMENTS",
  catalog: "CATALOG",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const [, head, ...rest] = url.pathname.split("/");

    if (head === "healthz" || url.pathname === "/") {
      return new Response(JSON.stringify({ status: "ok", services: Object.keys(ROUTES) }), {
        headers: { "content-type": "application/json" },
      });
    }

    const binding = ROUTES[head];
    if (!binding) {
      return new Response(JSON.stringify({ error: "not_found", message: `unknown service "${head}"` }), {
        status: 404, headers: { "content-type": "application/json" },
      });
    }

    // Rewrite "/fiscal/invoices?x=1" -> "/invoices?x=1" for the container.
    const innerPath = "/" + rest.join("/");
    const innerUrl = new URL(innerPath + url.search, url.origin);
    const innerReq = new Request(innerUrl, request);

    // One container instance per service (id "main"); scale via instances in wrangler.
    const container = getContainer(env[binding], "main");
    return container.fetch(innerReq);
  },
};
