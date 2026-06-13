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

interface HeaderOpts { categories?: Array<{ slug: string; name: string; icon: string }>; activeCat?: string; q?: string; city?: string; }

function header(o: HeaderOpts = {}): string {
  const cats = o.categories ?? [];
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
        <button class="iconbtn" data-open-cart aria-label="Carrito">🛒<span class="cart-count" hidden>0</span></button>
      </div>
    </div>
  </header>
  ${cats.length ? `<nav class="cats"><div class="container">
    <a class="chip ${!o.activeCat ? "active" : ""}" href="/">✨ Todo</a>
    ${cats.map((c) => `<a class="chip ${o.activeCat === c.name ? "active" : ""}" href="/?category=${encodeURIComponent(c.name)}">${esc(c.icon)} ${esc(c.name)}</a>`).join("")}
  </div></nav>` : ""}`;
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
    <div><h4>SalesFactory</h4><ul><li><a href="/quickpago">QuickPago</a></li><li><a href="/admin">Portal admin</a></li><li><a href="#">Vender en Meriplaza</a></li></ul></div>
  </div>
  <div class="muted" style="color:#6b7280;border-top:1px solid #1f2330;margin-top:1.5rem;padding-top:1rem;font-size:.78rem">© 2026 Meriplaza · un producto de SalesFactory · Hecho en Venezuela 🇻🇪</div>
</div></footer>
<script src="/assets/app.js" defer></script>
</body></html>`;
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
        <span class="priceblock"><span class="price">${p.offerCount > 1 ? `<span class="pre">desde</span>` : ""}${esc(p.minPrice ?? "—")} ${esc(p.currency)}</span></span>
        ${add}
      </div>
    </div>
  </article>`;
}

// ---- home ----
export function homePage(data: { products: any[]; sellers: any[]; categories: any[]; q?: string; category?: string }): string {
  const browsing = !data.q && !data.category;
  const heading = data.q ? `Resultados para “${esc(data.q)}”` : data.category ? esc(data.category) : "Ofertas destacadas";
  const body = `
  <div class="container">
    ${browsing ? `<section><div class="hero fade-up"><div class="hero-in">
      <h1>Todo Venezuela, en una sola plaza</h1>
      <p>Compara precios entre tiendas, paga en bolívares, divisas o cripto, y recibe con entrega local.</p>
      <a class="btn btn--accent" href="#tiendas">Explorar tiendas</a>
    </div></div></section>` : ""}

    <section>
      <div class="section-head"><h2>${heading}</h2><span class="muted">${data.products.length} producto(s)</span></div>
      <div class="grid stagger">${data.products.length ? data.products.map(productCard).join("") : `<p class="muted">No se encontraron productos.</p>`}</div>
    </section>

    ${browsing ? `<section id="tiendas">
      <div class="section-head"><h2>Nuestras tiendas</h2></div>
      <div class="stores stagger">${data.sellers.map(storeCard).join("")}</div>
    </section>` : ""}
  </div>`;
  return layout({ title: data.q ? `${data.q} — Meriplaza` : "Meriplaza — El mercado de Venezuela", body, header: { categories: data.categories, activeCat: data.category, q: data.q } });
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
export function productPage(p: any, categories: any[]): string {
  const imgs: string[] = p.images && p.images.length ? p.images : [];
  const main = imgs.length ? `<img src="${esc(imgs[0])}" alt="${esc(p.title)}">` : iconFor(p.category);
  const best = p.offers[0];
  const specRows = Object.entries(p.specs || {}).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("");
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
        <div class="rating" style="font-size:.95rem">${stars(p.rating)} <span>${p.rating ? p.rating.toFixed(1) : "—"} · ${p.ratingCount} reseña(s)</span></div>
        ${best ? `<div style="margin:1rem 0"><span class="price" style="font-size:1.8rem">${esc(best.price)} ${esc(best.currency)}</span>
          ${p.offers.length > 1 ? `<span class="muted"> · mejor precio de ${p.offers.length} tiendas</span>` : ""}</div>` : `<p class="muted">No disponible actualmente.</p>`}
        <p style="line-height:1.55">${esc(p.description)}</p>

        <div class="offers">
          ${p.offers.map((o: any, i: number) => `<div class="offer ${i === 0 ? "best" : ""}">
            <div class="who"><a href="/t/${esc(o.sellerHandle)}">${esc(o.sellerName)}</a>
              <small>${o.stock > 0 ? `${o.stock} disponibles` : "Agotado"}${i === 0 ? " · mejor precio" : ""}</small></div>
            <div class="row" style="gap:1rem">
              <span class="price">${esc(o.price)} ${esc(o.currency)}</span>
              <button class="btn btn--accent" ${o.stock > 0 ? "" : "disabled"} data-add="${esc(o.id)}" data-title="${esc(p.title)}" data-price="${esc(o.price)}" data-currency="${esc(o.currency)}" data-seller="${esc(o.sellerId)}" data-seller-name="${esc(o.sellerName)}">Agregar</button>
            </div>
          </div>`).join("")}
        </div>

        ${specRows ? `<h2 style="font-size:1.05rem;margin:1.2rem 0 .3rem">Especificaciones</h2><table class="specs"><tbody>${specRows}</tbody></table>` : ""}
      </div>
    </div>

    <section class="reviews">
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
  </div>`;
  return layout({ title: `${p.title} — Meriplaza`, body, header: { categories, activeCat: p.category } });
}

// ---- store ----
export function storePage(sf: { seller: any; products: any[] }, categories: any[]): string {
  const s = sf.seller, t = s.theme || {};
  const layoutKind = ["grid", "list", "featured"].includes(t.layout) ? t.layout : "grid";
  const initial = (s.name || "?").trim()[0] || "?";
  const socials = [
    s.socials?.instagram && `<a href="https://instagram.com/${esc(s.socials.instagram)}" style="color:#fff;border-bottom:2px solid rgba(255,255,255,.5)">Instagram</a>`,
    s.socials?.whatsapp && `<a href="https://wa.me/${esc(s.socials.whatsapp)}" style="color:#fff;border-bottom:2px solid rgba(255,255,255,.5)">WhatsApp</a>`,
    s.socials?.facebook && `<a href="https://facebook.com/${esc(s.socials.facebook)}" style="color:#fff;border-bottom:2px solid rgba(255,255,255,.5)">Facebook</a>`,
  ].filter(Boolean).join("&nbsp;&nbsp;");
  const body = `
  <div style="--p:${esc(t.primaryColor || "#1b39c9")};--a:${esc(t.accentColor || "#ff5a3c")}">
    <div class="hero" style="margin:0;border-radius:0;background:linear-gradient(135deg,var(--p),var(--a))">
      <div class="container"><div class="row" style="gap:1.25rem;padding:1.5rem 0">
        <div style="width:76px;height:76px;border-radius:18px;background:rgba(255,255,255,.95);color:var(--p);display:grid;place-items:center;font-weight:900;font-size:2rem;flex:none">${initial}</div>
        <div>
          <span class="badge" style="background:rgba(255,255,255,.2);color:#fff">${kindLabel(s.kind)}</span>
          <h1 style="margin:.3rem 0;font-size:clamp(1.5rem,4vw,2.2rem)">${esc(s.name)}</h1>
          ${t.tagline ? `<p style="margin:0 0 .5rem;opacity:.95">${esc(t.tagline)}</p>` : ""}
          <div>${socials}</div>
        </div>
      </div></div>
    </div>
    <div class="container">
      <section>
        <div class="section-head"><h2>Productos</h2><span class="muted">${sf.products.length} artículo(s)</span></div>
        <div class="grid stagger">${sf.products.length ? sf.products.map((o) => storeOfferCard(o, s)).join("") : `<p class="muted">Esta tienda aún no tiene productos.</p>`}</div>
      </section>
    </div>
  </div>`;
  return layout({ title: `${s.name} — Meriplaza`, body, header: { categories } });
}

function storeOfferCard(o: any, seller: any): string {
  const out = o.stock <= 0;
  return `<article class="card">
    <a href="/p/${esc(o.slug)}" class="thumb">${o.image ? `<img loading="lazy" src="${esc(o.image)}" alt="${esc(o.title)}">` : `<span class="ph">${iconFor(o.category)}</span>`}${out ? `<span class="badge badge--out">Agotado</span>` : ""}</a>
    <div class="body">
      <a href="/p/${esc(o.slug)}" style="color:inherit"><h3>${esc(o.title)}</h3></a>
      ${o.ratingCount ? `<div class="rating">${stars(o.rating)} <span>(${o.ratingCount})</span></div>` : ""}
      <div class="foot">
        <span class="price">${esc(o.price)} ${esc(o.currency)}</span>
        <button class="add" ${out ? "disabled" : ""} data-add="${esc(o.offerId)}" data-title="${esc(o.title)}" data-price="${esc(o.price)}" data-currency="${esc(o.currency)}" data-seller="${esc(seller.id)}" data-seller-name="${esc(seller.name)}">+</button>
      </div>
    </div>
  </article>`;
}
