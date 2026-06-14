// Server-rendered Meriplaza pages. Full HTML is produced on the edge so the
// first paint is complete without JS; app.js then progressively enhances.
import { HEADER_LOGO, MARK_SVG } from "./brand.ts";

const ICON: Record<string, string> = {
  Alimentos: "🍞", Bebidas: "🧃", Salud: "💊", "Cuidado personal": "🧴",
  Tecnología: "📱", Hogar: "🏠", Artesanía: "🧶", Accesorios: "🎒", Moda: "👗", Mascotas: "🐾",
};
const iconFor = (c: string) => ICON[c] || "🛍️";

export function esc(s: unknown): string {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
function stars(r: number): string {
  const full = Math.round(r);
  return `<span class="stars">${"★".repeat(full)}${"☆".repeat(5 - full)}</span>`;
}
const kindLabel = (k: string) => ({ supermarket: "Supermercado", store: "Tienda", independent: "Emprendedor" }[k] || "Tienda");

interface HeaderOpts { categories?: Array<{ slug: string; name: string; icon: string }>; activeCat?: string; q?: string; city?: string; cities?: Array<{ slug: string; name: string; state: string }>; }

function header(o: HeaderOpts = {}): string {
  const cats = o.categories ?? [];
  const cities = o.cities ?? [];
  const city = o.city || "Caracas";
  return `
  <header class="head">
    <div class="container">
      <a class="logo" href="/">${HEADER_LOGO}</a>
      <form class="search" action="/" method="get">
        <button type="submit" aria-label="Buscar">🔍</button>
        <input type="search" name="q" value="${esc(o.q ?? "")}" placeholder="Buscar en todas las tiendas…" aria-label="Buscar">
      </form>
      <button class="city-pill" data-open-city aria-label="Elegir ciudad">📍 <b>${esc(city)}</b></button>
      <div class="icons">
        <a class="iconbtn" href="/cuenta" aria-label="Cuenta">👤<span class="hide-sm" style="font-size:.85rem">Cuenta</span></a>
        <a class="iconbtn" href="/carrito" aria-label="Carrito">🛒<span class="cart-count" hidden>0</span></a>
      </div>
    </div>
  </header>
  ${cats.length ? `<nav class="cats"><div class="container">
    <a class="chip ${!o.activeCat ? "active" : ""}" href="/">✨ Todo</a>
    ${cats.map((c) => `<a class="chip ${o.activeCat === c.name ? "active" : ""}" href="/?category=${encodeURIComponent(c.name)}">${esc(c.icon)} ${esc(c.name)}</a>`).join("")}
  </div></nav>` : ""}
  ${cities.length ? `<div class="scrim" id="city-scrim"></div>
  <div class="citysheet" id="city-sheet" role="dialog" aria-label="Elegir ciudad">
    <div class="spread" style="margin-bottom:.5rem"><b>¿A dónde enviamos?</b><button class="iconbtn" data-close-city>✕</button></div>
    <p class="muted" style="margin:0 0 .8rem;font-size:.85rem">Verás productos disponibles en tu ciudad.</p>
    <div class="citygrid">${cities.map((ct) => `<button class="cityopt ${ct.name === city ? "on" : ""}" data-city="${esc(ct.slug)}">📍 ${esc(ct.name)}<small>${esc(ct.state)}</small></button>`).join("")}</div>
  </div>` : ""}`;
}

export interface LayoutOpts {
  title: string; body: string; header?: HeaderOpts;
  description?: string; canonical?: string; ogImage?: string; jsonLd?: object;
}

export function layout(opts: LayoutOpts): string {
  const desc = opts.description || "Meriplaza — el mercado de Venezuela. Compara precios entre tiendas y recibe con entrega local.";
  const url = opts.canonical || "https://salesfactory-edge.alfosuag.workers.dev/";
  const favicon = "data:image/svg+xml," + encodeURIComponent(MARK_SVG);
  return `<!doctype html><html lang="es-VE"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#ffffff">
<title>${esc(opts.title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(url)}">
<link rel="icon" href="${favicon}" type="image/svg+xml">
<meta property="og:type" content="website"><meta property="og:site_name" content="Meriplaza">
<meta property="og:title" content="${esc(opts.title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}">${opts.ogImage ? `<meta property="og:image" content="${esc(opts.ogImage)}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="/assets/app.css">
${opts.jsonLd ? `<script type="application/ld+json">${JSON.stringify(opts.jsonLd)}</script>` : ""}
</head><body>
${header(opts.header)}
<main>${opts.body}</main>
<footer class="site"><div class="container">
  <div class="cols">
    <div>
      <div class="fbrand"><span class="brand-mark">${MARK_SVG}</span><b style="color:#fff;font-size:1.1rem">Meriplaza</b></div>
      <p class="muted" style="color:#9aa4b2;margin:.2rem 0 0;max-width:30ch">El mercado de Venezuela. Muchas tiendas, un solo lugar. Paga en bolívares, divisas o cripto.</p>
    </div>
    <div><h4>Comprar</h4><ul><li><a href="/">Inicio</a></li><li><a href="/?category=Tecnología">Tecnología</a></li><li><a href="/?category=Alimentos">Alimentos</a></li><li><a href="/?category=Moda">Moda</a></li></ul></div>
    <div><h4>Cuenta</h4><ul><li><a href="/cuenta">Mi cuenta</a></li><li><a href="/cuenta">Mis pedidos</a></li><li><a href="/tienda/panel">Panel de tienda</a></li></ul></div>
    <div><h4>SalesFactory</h4><ul><li><a href="/quickpago">QuickPago</a></li><li><a href="/comercios">Vender en Meriplaza</a></li><li><a href="/comercios/portal">Portal de comercios</a></li></ul></div>
  </div>
  <div class="muted" style="color:#6b7280;border-top:1px solid #1f2330;margin-top:1.5rem;padding-top:1rem;font-size:.78rem">© 2026 Meriplaza · un producto de SalesFactory · Hecho en Venezuela 🇻🇪</div>
</div></footer>
<script type="speculationrules">{"prefetch":[{"source":"document","where":{"and":[{"href_matches":"/*"},{"not":{"href_matches":"/quickpago/api/*"}},{"not":{"selector_matches":"[data-add],[data-open-cart]"}}]},"eagerness":"moderate"}]}</script>
<script src="/assets/app.js" defer></script>
</body></html>`;
}

export function sellerLandingPage(): string {
  const body = `
  <section class="hero">
    <div class="container hero__grid">
      <div>
        <span class="eyebrow">Para comercios venezolanos</span>
        <h1>Abre tu tienda en Meriplaza</h1>
        <p>Publica productos, recibe pedidos por ciudad, cobra con SalesFactory y entrega con tus métodos locales.</p>
        <div class="hero__actions">
          <a class="btn btn--accent" href="/cuenta">Crear cuenta de tienda</a>
          <a class="btn btn--ghost" href="/quickpago">Conocer QuickPago</a>
        </div>
      </div>
      <div class="seller-demo" aria-label="Resumen de comercio">
        <div class="spark">✦</div>
        <h3>Portal de comercios</h3>
        <div class="metric"><span>Pedidos hoy</span><b>24</b></div>
        <div class="metric"><span>Facturas IVA</span><b>100%</b></div>
        <div class="metric"><span>Cobros confirmados</span><b>Bs · $ · USDT</b></div>
      </div>
    </div>
  </section>
  <section class="container">
    <div class="section-head"><h2>Lo que recibe tu tienda</h2></div>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">
      ${[
        ["Catálogo multi-tienda","Tus ofertas compiten en un mercado central y también viven en tu storefront propio."],
        ["Checkout con pago","Pedidos conectados a intents de pago, referencia bancaria y conciliación."],
        ["Factura fiscal","IVA, RIF/CI del comprador, datos del comercio e invoice metadata en cada orden pagada."],
        ["Envíos locales","Direcciones, ciudad, método de despacho y estado de shipment por pedido."]
      ].map(([h,p])=>`<article class="card" style="padding:1.1rem"><h3 style="margin-top:0">${esc(h)}</h3><p class="muted">${esc(p)}</p></article>`).join("")}
    </div>
  </section>
  <style>
    .hero__grid{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(260px,.8fr);gap:1.5rem;align-items:center;padding:clamp(2rem,6vw,4rem) clamp(1rem,4vw,2rem)}
    .eyebrow{display:inline-flex;margin-bottom:.7rem;color:var(--blue);font-weight:750;font-size:.82rem}
    .hero__actions{display:flex;gap:.65rem;flex-wrap:wrap}
    .seller-demo{position:relative;background:linear-gradient(180deg,#fff,#f8fbff);border:1px solid var(--line);border-radius:18px;padding:1.2rem;box-shadow:var(--shadow-2);animation:floaty 5s ease-in-out infinite}
    .spark{position:absolute;right:1rem;top:.8rem;color:var(--yellow-600);font-size:1.5rem}
    .metric{display:flex;justify-content:space-between;gap:1rem;border-top:1px solid var(--line);padding:.8rem 0}.metric b{color:var(--blue)}
    @keyframes floaty{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
    @media(max-width:760px){.hero__grid{grid-template-columns:1fr}.seller-demo{animation:none}}
  </style>`;
  return layout({ title: "Vender en Meriplaza — Portal de comercios", body, description: "Crea una tienda en Meriplaza, cobra con SalesFactory y gestiona pedidos, envíos y facturas fiscales.", canonical: "https://salesfactory-edge.alfosuag.workers.dev/comercios" });
}

export function cartPage(cities: Array<{ slug: string; name: string; state: string }> = []): string {
  const cityOptions = cities.length
    ? cities.map((c) => `<option value="${esc(c.name)}">${esc(c.name)} · ${esc(c.state)}</option>`).join("")
    : `<option>Caracas</option><option>Valencia</option><option>Maracaibo</option><option>Barquisimeto</option>`;
  const body = `
  <div class="container checkout-page">
    <section class="checkout-head">
      <div>
        <span class="eyebrow">Checkout seguro</span>
        <h1>Tu carrito</h1>
        <p class="muted">Revisa productos, dirección, datos fiscales y pago antes de confirmar.</p>
      </div>
      <a class="btn btn--ghost" href="/">Seguir comprando</a>
    </section>

    <section class="checkout-grid">
      <div>
        <div class="card checkout-card" data-cart-lines>
          <div class="emptycart">
            <h2>Tu carrito está vacío</h2>
            <p class="muted">Agrega productos del mercado para continuar.</p>
            <a class="btn btn--primary" href="/">Explorar productos</a>
          </div>
        </div>
      </div>

      <aside class="checkout-side">
        <form id="checkout-form" class="card checkout-form">
          <h2>Entrega y factura</h2>
          <label>Nombre o razón social<input name="buyerName" autocomplete="name" required placeholder="Consumidor final"></label>
          <label>RIF/CI<input name="buyerTaxId" autocomplete="off" placeholder="V-12345678 o J-12345678-9"></label>
          <label>Correo para recibo<input name="buyerEmail" type="email" autocomplete="email" placeholder="correo@ejemplo.com"></label>
          <div class="frow">
            <label>Ciudad<select name="city">${cityOptions}</select></label>
            <label>Método de envío<select name="shipmentMethod"><option value="delivery">Delivery local</option><option value="pickup">Retiro en tienda</option><option value="courier">Courier nacional</option></select></label>
          </div>
          <label>Dirección<textarea name="address1" rows="3" autocomplete="street-address" placeholder="Calle, edificio, referencia"></textarea></label>
          <label>Notas de entrega<input name="shipmentNotes" placeholder="Horario, punto de referencia, teléfono alterno"></label>

          <h2>Pago</h2>
          <label>Método<select name="paymentMethod">
            <option value="transferencia">Transferencia nacional</option>
            <option value="pago_movil">Pago móvil</option>
            <option value="divisas_cash">Divisas en efectivo</option>
            <option value="punto_de_venta">Punto de venta</option>
            <option value="crypto">Cripto</option>
          </select></label>
          <label>Referencia bancaria / comprobante<input name="bankReference" placeholder="000123456 o WEB-..."></label>
          <div class="pay-instructions" data-payment-instructions></div>
          <div class="checkout-total" data-cart-totals>Total: 0.00</div>
          <button class="btn btn--accent btn--block" type="submit" data-checkout-submit>Confirmar pedido</button>
          <p class="muted" data-checkout-msg></p>
        </form>
      </aside>
    </section>
  </div>`;
  return layout({ title: "Carrito — Meriplaza", body, description: "Completa tu compra en Meriplaza con dirección, datos fiscales, IVA y pago." });
}

export function orderPage(order: any, relatedIds: string[] = []): string {
  const invoice = order.invoice || {};
  const buyer = invoice.buyer || {};
  const merchant = order.merchant || invoice.merchant || {};
  const ship = order.shipment || {};
  const addr = order.shippingAddress || buyer.address || {};
  const body = `
  <div class="container receipt-page">
    <section class="checkout-head">
      <div>
        <span class="eyebrow">Pedido confirmado</span>
        <h1>Pedido ${esc(order.id?.slice(-8) || "")}</h1>
        <p class="muted">Guarda este enlace para consultar pago, factura y entrega.</p>
      </div>
      <div class="row" style="flex-wrap:wrap"><a class="btn btn--ghost" href="/cuenta">Mis pedidos</a><a class="btn btn--primary" href="/">Seguir comprando</a></div>
    </section>

    ${relatedIds.length > 1 ? `<div class="receipt-switch card">${relatedIds.map((id) => `<a class="${id === order.id ? "on" : ""}" href="/pedido/${esc(id)}?ids=${esc(relatedIds.join(","))}">Pedido ${esc(id.slice(-6))}</a>`).join("")}</div>` : ""}

    <section class="receipt-grid">
      <article class="card receipt-card">
        <h2>Estado</h2>
        ${timeline(order)}
      </article>
      <article class="card receipt-card">
        <h2>Pago</h2>
        <div class="payline"><span>Método</span><b>${esc(order.payment?.method || "")}</b></div>
        <div class="payline"><span>Estado</span><b>${esc(paymentLabel(order.payment?.status || order.status))}</b></div>
        <div class="payline payline--id"><span>Referencia</span><b>${esc(order.payment?.settlement?.reference || order.payment?.settlement?.networkTxn || "Pendiente")}</b></div>
      </article>
      <article class="card receipt-card">
        <h2>Factura fiscal</h2>
        <div class="payline payline--id"><span>Factura</span><b>${esc(order.invoiceId || invoice.id || "Pendiente")}</b></div>
        <div class="payline"><span>Control</span><b>${esc(invoice.controlNumber || "Pendiente")}</b></div>
        <div class="payline"><span>IVA</span><b>${esc(order.taxTotal || invoice.ivaAmount || "0.00")} ${esc(order.currency)}</b></div>
        <div class="payline"><span>RIF/CI</span><b>${esc(order.buyerTaxId || buyer.taxId || "Consumidor final")}</b></div>
      </article>
      <article class="card receipt-card">
        <h2>Entrega</h2>
        <div class="payline"><span>Estado</span><b>${esc(shipmentLabel(ship.status || "pending"))}</b></div>
        <div class="payline"><span>Ciudad</span><b>${esc(addr.city || ship.city || "")}</b></div>
        <div class="payline"><span>Dirección</span><b>${esc(addr.address1 || "")}</b></div>
        <div class="payline"><span>Tracking</span><b>${esc(ship.tracking || "Pendiente")}</b></div>
      </article>
    </section>

    <section class="receipt-grid receipt-grid--wide">
      <article class="card receipt-card">
        <h2>Artículos</h2>
        ${(order.lines || []).map((l: any) => `<div class="receipt-line"><span>${esc(l.title)} <small>x${esc(l.quantity)}</small></span><b>${esc(l.unitPrice)} ${esc(order.currency)}</b></div>`).join("")}
        <div class="receipt-total"><span>Subtotal</span><b>${esc(order.subtotal)} ${esc(order.currency)}</b></div>
        <div class="receipt-total"><span>IVA</span><b>${esc(order.taxTotal)} ${esc(order.currency)}</b></div>
        <div class="receipt-total grand"><span>Total</span><b>${esc(order.grandTotal)} ${esc(order.currency)}</b></div>
      </article>
      <article class="card receipt-card">
        <h2>Comercio</h2>
        <div class="payline"><span>Tienda</span><b>${esc(merchant.name || "")}</b></div>
        <div class="payline"><span>RIF</span><b>${esc(merchant.rif || "")}</b></div>
        <div class="payline payline--id"><span>Merchant ID</span><b>${esc(merchant.merchantId || "")}</b></div>
      </article>
    </section>
  </div>`;
  return layout({ title: `Pedido ${order.id?.slice(-8) || ""} — Meriplaza`, body, description: "Confirmación de pedido, pago, factura fiscal y entrega en Meriplaza." });
}

function timeline(order: any): string {
  const ship = order.shipment || {};
  const steps = [
    ["created", "Pedido creado", true],
    ["paid", "Pago confirmado", ["paid", "invoiced", "fulfilled"].includes(order.status) || order.payment?.status === "succeeded"],
    ["invoice", "Factura emitida", !!order.invoiceId],
    ["preparing", "Preparando", ["preparing", "ready", "shipped", "delivered"].includes(ship.status)],
    ["shipped", "En camino", ["shipped", "delivered"].includes(ship.status)],
    ["delivered", "Entregado", ship.status === "delivered" || order.status === "fulfilled"],
  ];
  return `<ol class="receipt-timeline">${steps.map(([, label, done]) => `<li class="${done ? "done" : ""}"><span></span>${esc(label)}</li>`).join("")}</ol>`;
}
function paymentLabel(s: string): string {
  return { succeeded: "Confirmado", requires_action: "Requiere acción", failed: "Fallido", pending_payment: "Pendiente", payment_action_required: "Requiere acción", payment_failed: "Fallido", invoiced: "Confirmado" }[s] || s || "Pendiente";
}
function shipmentLabel(s: string): string {
  return { pending: "Pendiente", preparing: "Preparando", ready: "Listo para retirar", shipped: "En camino", delivered: "Entregado", canceled: "Cancelado" }[s] || s;
}

// ---- product card (shared by home + store + search) ----
function productCard(p: any): string {
  const out = p.bestOffer && p.bestOffer.stock <= 0;
  const add = p.bestOffer && !out
    ? `<button class="add" data-add="${esc(p.bestOffer.id)}" data-title="${esc(p.title)}" data-price="${esc(p.minPrice)}" data-currency="${esc(p.currency)}" data-seller="${esc(p.bestOffer.sellerId)}" data-seller-name="${esc(p.bestOffer.sellerName)}" aria-label="Agregar">+</button>`
    : `<button class="add" disabled>+</button>`;
  const lowStock = p.bestOffer && p.bestOffer.stock > 0 && p.bestOffer.stock <= 5;
  return `<article class="card">
    <a href="/p/${esc(p.slug)}" class="thumb">
      ${p.image ? `<img loading="lazy" decoding="async" src="${esc(p.image)}" alt="${esc(p.title)}">` : `<span class="ph">${iconFor(p.category)}</span>`}
      ${p.discountPct ? `<span class="badge badge--sale">-${p.discountPct}%</span>` : out ? `<span class="badge badge--out">Agotado</span>` : ""}
    </a>
    <div class="body">
      <a href="/p/${esc(p.slug)}" style="color:inherit">
        <span class="store">${p.offerCount > 1 ? `${p.offerCount} tiendas` : esc(p.bestOffer?.sellerName || "")}</span>
        <h3>${esc(p.title)}</h3>
      </a>
      ${p.ratingCount ? `<div class="rating">${stars(p.rating)} <span>(${p.ratingCount})</span></div>` : `<div class="rating muted">Nuevo</div>`}
      ${lowStock ? `<div class="rating" style="color:var(--yellow-600);font-weight:600">¡Solo ${p.bestOffer.stock} disponibles!</div>` : ""}
      <div class="foot">
        <span class="priceblock"><span class="price">${p.offerCount > 1 ? `<span class="pre">desde</span>` : ""}${esc(p.minPrice ?? "—")} ${esc(p.currency)}${p.compareAt ? `<span class="was">${esc(p.compareAt)}</span>` : ""}</span>${p.alt ? `<span class="altprice">${esc(p.alt)}</span>` : ""}</span>
        ${add}
      </div>
    </div>
  </article>`;
}

// ---- home ----
interface HomeData { products: any[]; featured?: any[]; sellers: any[]; categories: any[]; cities?: any[]; promotions?: any[]; q?: string; category?: string; store?: string; city?: string; cityName?: string; sort?: string; rate?: any; }

function qsHref(cur: HomeData, change: Record<string, string>): string {
  const p = new URLSearchParams();
  const merged: any = { q: cur.q, category: cur.category, store: cur.store, sort: cur.sort, ...change };
  for (const k of ["q", "category", "store", "sort"]) if (merged[k]) p.set(k, merged[k]);
  const s = p.toString();
  return s ? `/?${s}` : "/";
}

function filtersAside(d: HomeData): string {
  const storeName = d.store ? (d.sellers.find((s) => s.handle === d.store)?.name || d.store) : "";
  const sorts = [["", "Más relevantes"], ["price_asc", "Precio: menor"], ["price_desc", "Precio: mayor"], ["rating", "Mejor valorados"]];
  return `<aside class="filters" id="filters">
    <div class="spread" style="margin-bottom:.5rem"><b>Filtros</b><button class="iconbtn filterbtn" data-close-filters>✕</button></div>
    ${(d.q || d.category || d.store) ? `<a class="link" href="/">✕ Limpiar filtros</a>` : ""}
    <h3>Ordenar</h3>
    ${sorts.map(([v, label]) => `<a class="${(d.sort || "") === v ? "on" : ""}" href="${qsHref(d, { sort: v })}">${label}</a>`).join("")}
    <h3>Categorías</h3>
    <a class="${!d.category ? "on" : ""}" href="${qsHref(d, { category: "" })}">Todas</a>
    ${d.categories.map((c) => `<a class="${d.category === c.name ? "on" : ""}" href="${qsHref(d, { category: c.name })}">${esc(c.icon)} ${esc(c.name)}</a>`).join("")}
    <h3>Tiendas</h3>
    <a class="${!d.store ? "on" : ""}" href="${qsHref(d, { store: "" })}">Todas</a>
    ${d.sellers.map((s) => `<a class="${d.store === s.handle ? "on" : ""}" href="${qsHref(d, { store: s.handle })}">${esc(s.name)}</a>`).join("")}
    <h3>Ciudad de entrega</h3>
    <a data-open-city style="cursor:pointer">📍 ${esc(d.cityName || "Caracas")} · cambiar</a>
    ${storeName ? `` : ""}
  </aside>`;
}

export function homePage(d: HomeData): string {
  const browsing = !d.q && !d.category && !d.store;
  const heading = d.q ? `Resultados para “${esc(d.q)}”`
    : d.category ? esc(d.category)
    : d.store ? esc(d.sellers.find((s) => s.handle === d.store)?.name || "Tienda")
    : "Explorar todo";
  const promos = d.promotions ?? [];
  const featured = d.featured ?? [];
  const body = `
  <div class="container">
    ${browsing ? `
    <section><div class="hero fade-up"><div class="hero-deco"></div><div class="hero-in">
      <h1>Todo Venezuela, <span class="y">en una sola plaza</span></h1>
      <p>Compara precios entre tiendas, paga en bolívares, divisas o cripto, y recibe con Yummy, Ridery o Tango.</p>
      <a class="btn btn--dark" href="#explorar">Explorar productos</a>
    </div></div></section>

    ${promos.length ? `<section><div class="promostrip">${promos.map(promoCard).join("")}</div></section>` : ""}

    ${featured.length ? `<section>
      <div class="section-head"><h2>⚡ Ofertas destacadas</h2><span class="muted">Promocionado</span></div>
      <div class="deal-row stagger">${featured.map(productCard).join("")}</div>
    </section>` : ""}

    <section id="tiendas">
      <div class="section-head"><h2>Tiendas populares</h2></div>
      <div class="stores stagger">${d.sellers.map(storeCard).join("")}</div>
    </section>` : ""}

    <section id="explorar">
      <div class="section-head"><h2>${heading}</h2>
        <span class="row"><button class="btn btn--ghost filterbtn" data-open-filters>⚙ Filtros</button><span class="muted hide-sm">${d.products.length} producto(s)</span></span></div>
      <div class="with-aside">
        ${filtersAside(d)}
        <div class="grid stagger">${d.products.length ? d.products.map(productCard).join("") : `<p class="muted">No se encontraron productos${d.cityName ? ` con entrega en ${esc(d.cityName)}` : ""}.</p>`}</div>
      </div>
    </section>
  </div>`;
  return layout({
    title: d.q ? `${d.q} — Meriplaza` : d.category ? `${d.category} — Meriplaza` : "Meriplaza — El mercado de Venezuela",
    body,
    header: { categories: d.categories, activeCat: d.category, q: d.q, city: d.cityName, cities: d.cities },
    jsonLd: { "@context": "https://schema.org", "@type": "WebSite", name: "Meriplaza", url: "https://salesfactory-edge.alfosuag.workers.dev/", potentialAction: { "@type": "SearchAction", target: "https://salesfactory-edge.alfosuag.workers.dev/?q={search_term_string}", "query-input": "required name=search_term_string" } },
  });
}

function promoCard(pr: any): string {
  const cls = pr.color === "yellow" ? "promo--yellow" : pr.color === "dark" ? "promo--dark" : "promo--blue";
  const tag = { holiday: "🎄 Temporada", deal: "🔥 Oferta", bundle: "📦 Combo", event: "🎉 Evento" }[pr.kind as string] || "Promo";
  return `<a class="promo ${cls}" href="${esc(pr.href)}"><span class="badge" style="background:rgba(255,255,255,.25);align-self:flex-start;margin-bottom:auto">${tag}</span><h3>${esc(pr.title)}</h3><p>${esc(pr.subtitle)}</p></a>`;
}

function storeCard(s: any): string {
  const t = s.theme || {};
  const initial = (s.name || "?").trim()[0] || "?";
  return `<a class="card" href="/t/${esc(s.handle)}" style="--p:${esc(t.primaryColor || "#1b39c9")};--a:${esc(t.accentColor || "#ff5a3c")}">
    <div class="store-cover" style="background:linear-gradient(135deg,var(--p),var(--a))">
      ${t.logoUrl ? `<img src="${esc(t.logoUrl)}" alt="" style="width:54px;height:54px;border-radius:14px;object-fit:cover">` : `<span class="av" style="color:var(--p)">${esc(initial)}</span>`}
    </div>
    <div class="store-meta">
      <span class="badge badge--kind">${kindLabel(s.kind)}</span>
      <h3>${esc(s.name)}</h3>
      ${t.tagline ? `<p class="muted" style="margin:.1rem 0 0;font-size:.85rem">${esc(t.tagline)}</p>` : ""}
      <div class="store-foot"><span>${s.productCount ?? 0} productos</span><span style="color:var(--good);font-weight:700">${esc(s.currency)}</span></div>
    </div>
  </a>`;
}

// ---- product detail ----
export function productPage(p: any, categories: any[], opts: { rate?: any; related?: any[]; cities?: any[] } = {}): string {
  const imgs: string[] = p.images && p.images.length ? p.images : [];
  const main = imgs.length ? `<img src="${esc(imgs[0])}" alt="${esc(p.title)}">` : `<span>${iconFor(p.category)}</span>`;
  const best = p.offers[0];
  const shipping = best?.shipping || [];
  const related = opts.related || [];
  const specRows = Object.entries(p.specs || {}).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("");
  const buyData = best ? `data-add="${esc(best.id)}" data-title="${esc(p.title)}" data-price="${esc(best.price)}" data-currency="${esc(best.currency)}" data-seller="${esc(best.sellerId)}" data-seller-name="${esc(best.sellerName)}"` : "";
  const body = `
  <div class="container">
    <nav class="muted" style="padding:.9rem 0;font-size:.85rem"><a href="/">Inicio</a> › <a href="/?category=${encodeURIComponent(p.category)}">${esc(p.category)}</a> › ${esc(p.title)}</nav>
    <div class="pdp">
      <div class="gallery fade-up">
        <div class="main">${main}</div>
        ${imgs.length > 1 ? `<div class="thumbs">${imgs.map((u, i) => `<button class="${i === 0 ? "active" : ""}" data-img="${esc(u)}"><img src="${esc(u)}" alt=""></button>`).join("")}</div>` : ""}
      </div>
      <div class="info fade-up">
        ${p.brand ? `<div class="brand-line">${esc(p.brand)}</div>` : ""}
        <h1>${esc(p.title)}</h1>
        <div class="rating" style="font-size:.95rem">${stars(p.rating)} <span>${p.rating ? p.rating.toFixed(1) : "—"} · ${p.ratingCount} reseña(s) · <a href="#resenas" class="link">ver</a></span></div>
        ${best ? `<div style="margin:1rem 0 .3rem">
          ${best.discountPct ? `<span class="badge badge--sale" style="vertical-align:middle">-${best.discountPct}%</span> ` : ""}
          <span class="price" style="font-size:2rem">${esc(best.price)} ${esc(best.currency)}</span>
          ${best.compareAt ? `<span class="was" style="font-size:1rem">${esc(best.compareAt)} ${esc(best.currency)}</span>` : ""}
          ${p.offers.length > 1 ? `<span class="muted"> · mejor de ${p.offers.length} tiendas</span>` : ""}
          ${best.alt ? `<div class="muted" style="font-size:.85rem">${esc(best.alt)} · IVA incluido</div>` : ""}
        </div>
        <div class="row" style="gap:.6rem;margin:.8rem 0">
          <button class="btn btn--primary" style="flex:1" ${best.stock > 0 ? "" : "disabled"} ${buyData}>${best.stock > 0 ? "🛒 Agregar al carrito" : "Agotado"}</button>
          <button class="btn btn--ghost" aria-label="Favorito">♡</button>
        </div>
        ${best.stock > 0 && best.stock <= 5 ? `<div style="color:var(--yellow-600);font-weight:600;font-size:.85rem">¡Solo ${best.stock} disponibles!</div>` : ""}` : `<p class="muted">No disponible actualmente.</p>`}

        <div class="infocards">
          ${shipping.slice(0, 3).map((s: any) => `<div class="infocard"><b>🛵 ${esc(s.provider)}</b>${esc(s.eta)} · ${esc(s.fee)}</div>`).join("") || `<div class="infocard"><b>🛵 Entrega local</b>Consulta en la tienda</div>`}
          <div class="infocard"><b>✔ Compra protegida</b>Devolución hasta 7 días</div>
          ${p.deliveryCities && p.deliveryCities.length ? `<div class="infocard"><b>📍 Entrega en</b>${esc(p.deliveryCities.slice(0, 4).join(", "))}</div>` : ""}
        </div>

        <p style="line-height:1.6">${esc(p.description)}</p>

        <h2 style="font-size:1.05rem;margin:1.2rem 0 .4rem">Disponible en ${p.offers.length} tienda(s)</h2>
        <div class="offers">
          ${p.offers.map((o: any, i: number) => `<div class="offer ${i === 0 ? "best" : ""}">
            <div class="who"><a href="/t/${esc(o.sellerHandle)}">${esc(o.sellerName)}</a>
              <small>${o.stock > 0 ? `${o.stock} disponibles` : "Agotado"}${i === 0 ? " · mejor precio ⭐" : ""}</small></div>
            <div class="row" style="gap:1rem">
              <span class="price">${esc(o.price)} ${esc(o.currency)}${o.alt ? `<span class="altprice">${esc(o.alt)}</span>` : ""}</span>
              <button class="btn btn--accent" ${o.stock > 0 ? "" : "disabled"} data-add="${esc(o.id)}" data-title="${esc(p.title)}" data-price="${esc(o.price)}" data-currency="${esc(o.currency)}" data-seller="${esc(o.sellerId)}" data-seller-name="${esc(o.sellerName)}">Agregar</button>
            </div>
          </div>`).join("")}
        </div>

        ${specRows ? `<h2 style="font-size:1.05rem;margin:1.4rem 0 .3rem">Especificaciones</h2><table class="specs"><tbody>${specRows}</tbody></table>` : ""}
      </div>
    </div>

    ${related.length ? `<section><div class="section-head"><h2>Productos relacionados</h2></div><div class="deal-row stagger">${related.map(productCard).join("")}</div></section>` : ""}

    <section class="reviews" id="resenas">
      <div class="section-head"><h2>Reseñas (${p.ratingCount})</h2></div>
      ${p.reviews.length ? p.reviews.map((r: any) => `<div class="review">
        <div class="rh"><b>${esc(r.author)}</b><span class="stars">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</span></div>
        ${r.title ? `<div style="font-weight:600;margin:.2rem 0">${esc(r.title)}</div>` : ""}
        <p class="muted" style="margin:.2rem 0">${esc(r.body)}</p>
      </div>`).join("") : `<p class="muted">Sé el primero en opinar.</p>`}

      <form class="review-form" id="review-form" data-slug="${esc(p.slug)}">
        <h3 style="margin:.2rem 0 .5rem">Escribe una reseña</h3>
        <div class="row" style="gap:1rem;flex-wrap:wrap">
          <input name="author" placeholder="Tu nombre" style="flex:1;min-width:160px">
          <select name="rating" aria-label="Calificación"><option value="5">★★★★★</option><option value="4">★★★★</option><option value="3">★★★</option><option value="2">★★</option><option value="1">★</option></select>
        </div>
        <input name="title" placeholder="Título (opcional)">
        <textarea name="body" rows="3" placeholder="¿Qué te pareció el producto?"></textarea>
        <button class="btn btn--primary" style="margin-top:.6rem" type="submit">Publicar reseña</button>
      </form>
    </section>

    ${best ? `<div class="buybar">
      <div><div class="price">${esc(best.price)} ${esc(best.currency)}</div>${best.alt ? `<div class="altprice">${esc(best.alt)}</div>` : ""}</div>
      <button class="btn btn--primary" style="flex:1" ${best.stock > 0 ? "" : "disabled"} ${buyData}>${best.stock > 0 ? "Agregar al carrito" : "Agotado"}</button>
    </div>` : ""}
  </div>`;
  const jsonLd = {
    "@context": "https://schema.org", "@type": "Product", name: p.title, description: p.description,
    image: imgs, brand: p.brand || undefined, sku: p.id,
    aggregateRating: p.ratingCount ? { "@type": "AggregateRating", ratingValue: p.rating?.toFixed(1), reviewCount: p.ratingCount } : undefined,
    offers: best ? { "@type": "AggregateOffer", lowPrice: best.price, priceCurrency: best.currency, offerCount: p.offers.length } : undefined,
  };
  return layout({ title: `${p.title} — ${p.brand || "Meriplaza"}`, description: p.description?.slice(0, 155), body,
    header: { categories, activeCat: p.category, cities: opts.cities }, ogImage: imgs[0], jsonLd });
}

// ---- store ----
export function storePage(sf: { seller: any; products: any[] }, categories: any[], cities: any[] = []): string {
  const s = sf.seller, t = s.theme || {};
  const layoutKind = ["grid", "list", "featured"].includes(t.layout) ? t.layout : "grid";
  const initial = (s.name || "?").trim()[0] || "?";
  const shipping = s.shipping || [];
  const socials = [
    s.socials?.instagram && `<a href="https://instagram.com/${esc(s.socials.instagram)}" style="color:#fff;border-bottom:2px solid rgba(255,255,255,.5)">Instagram</a>`,
    s.socials?.whatsapp && `<a href="https://wa.me/${esc(s.socials.whatsapp)}" style="color:#fff;border-bottom:2px solid rgba(255,255,255,.5)">WhatsApp</a>`,
    s.socials?.facebook && `<a href="https://facebook.com/${esc(s.socials.facebook)}" style="color:#fff;border-bottom:2px solid rgba(255,255,255,.5)">Facebook</a>`,
  ].filter(Boolean).join("&nbsp;&nbsp;");
  const body = `
  <div style="--p:${esc(t.primaryColor || "#1b39c9")};--a:${esc(t.accentColor || "#ff5a3c")}">
    <div class="hero" style="margin:0;border-radius:0;background:linear-gradient(135deg,var(--p),var(--a))">
      <div class="container"><div class="row" style="gap:1.25rem;padding:1.5rem 0">
        <div style="width:76px;height:76px;border-radius:18px;background:rgba(255,255,255,.95);color:var(--p);display:grid;place-items:center;font-weight:900;font-size:2rem;flex:none;overflow:hidden">${t.logoUrl ? `<img src="${esc(t.logoUrl)}" alt="" style="width:100%;height:100%;object-fit:contain;padding:8px">` : esc(initial)}</div>
        <div>
          <span class="badge" style="background:rgba(255,255,255,.2);color:#fff">${kindLabel(s.kind)}</span>
          <h1 style="margin:.3rem 0;font-size:clamp(1.5rem,4vw,2.2rem)">${esc(s.name)}</h1>
          ${t.tagline ? `<p style="margin:0 0 .5rem;opacity:.95">${esc(t.tagline)}</p>` : ""}
          <div>${socials}</div>
        </div>
      </div></div>
    </div>
    <div class="container">
      ${shipping.length ? `<section style="padding-bottom:0"><div class="ship-list" style="grid-auto-flow:column;grid-auto-columns:minmax(180px,1fr);display:grid;overflow-x:auto">
        ${shipping.map((m: any) => `<div class="ship-item"><span class="p">🛵 ${esc(m.provider)}</span><small>${esc(m.eta)} · ${esc(m.fee)}</small></div>`).join("")}
      </div></section>` : ""}
      <section>
        <div class="section-head"><h2>Productos</h2><span class="muted">${sf.products.length} artículo(s)</span></div>
        <div class="${layoutKind === "list" ? "" : "grid"} stagger">${sf.products.length ? sf.products.map((o) => storeOfferCard(o, s)).join("") : `<p class="muted">Esta tienda aún no tiene productos.</p>`}</div>
      </section>
    </div>
  </div>`;
  return layout({ title: `${s.name} — Meriplaza`, description: t.tagline, body, header: { categories, cities } });
}

function storeOfferCard(o: any, seller: any): string {
  const out = o.stock <= 0;
  return `<article class="card">
    <a href="/p/${esc(o.slug)}" class="thumb">${o.image ? `<img loading="lazy" src="${esc(o.image)}" alt="${esc(o.title)}">` : `<span class="ph">${iconFor(o.category)}</span>`}${out ? `<span class="badge badge--out">Agotado</span>` : ""}</a>
    <div class="body">
      <a href="/p/${esc(o.slug)}" style="color:inherit"><h3>${esc(o.title)}</h3></a>
      ${o.ratingCount ? `<div class="rating">${stars(o.rating)} <span>(${o.ratingCount})</span></div>` : ""}
      <div class="foot">
        <span class="priceblock"><span class="price">${esc(o.price)} ${esc(o.currency)}</span>${o.alt ? `<span class="altprice">${esc(o.alt)}</span>` : ""}</span>
        <button class="add" ${out ? "disabled" : ""} data-add="${esc(o.offerId)}" data-title="${esc(o.title)}" data-price="${esc(o.price)}" data-currency="${esc(o.currency)}" data-seller="${esc(seller.id)}" data-seller-name="${esc(seller.name)}">+</button>
      </div>
    </div>
  </article>`;
}
