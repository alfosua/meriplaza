// Supermarket mode: a convenience storefront that ranks stores by how close
// their delivery coverage is to the customer's home location and compares
// grocery prices across the stores they pick.
import { layout, esc, infiniteSentinel } from "./pages.ts";

const GROCERY_ICON: Record<string, string> = {
  Alimentos: "🍞", Bebidas: "🧃", Salud: "💊", "Cuidado personal": "🧴", Hogar: "🏠", Mascotas: "🐾",
};

interface SuperData {
  home: { lat?: number; lng?: number; label?: string; city?: string; cityName?: string };
  stores: any[]; products: any[]; categories: string[];
  q: string; category: string; selectedStores: string[];
  cities: any[]; cityName: string; rate?: any; mapsKey?: string;
  page?: number; pages?: number; total?: number; totalStores?: number;
  sort?: string; certified?: boolean; instant?: boolean; inStock?: boolean;
}

// Query string (without page) describing the current supermarket comparison.
function superListParams(d: SuperData): string {
  const p = new URLSearchParams();
  if (d.selectedStores.length) p.set("stores", d.selectedStores.join(","));
  if (d.q) p.set("q", d.q);
  if (d.category) p.set("category", d.category);
  if (d.sort) p.set("sort", d.sort);
  if (d.certified) p.set("certified", "1");
  if (d.instant) p.set("instant", "1");
  if (d.inStock) p.set("instock", "1");
  return p.toString();
}

function storesHref(d: SuperData, change: { stores?: string[]; category?: string; q?: string; sort?: string; certified?: boolean; instant?: boolean; inStock?: boolean; page?: number }): string {
  const p = new URLSearchParams();
  const stores = change.stores ?? d.selectedStores;
  const category = change.category ?? d.category;
  const q = change.q ?? d.q;
  const sort = change.sort ?? d.sort ?? "";
  const certified = change.certified ?? d.certified;
  const instant = change.instant ?? d.instant;
  const inStock = change.inStock ?? d.inStock;
  if (stores.length) p.set("stores", stores.join(","));
  if (category) p.set("category", category);
  if (q) p.set("q", q);
  if (sort) p.set("sort", sort);
  if (certified) p.set("certified", "1");
  if (instant) p.set("instant", "1");
  if (inStock) p.set("instock", "1");
  if (change.page && change.page > 1) p.set("page", String(change.page));
  const s = p.toString();
  return s ? `/super?${s}` : "/super";
}

function toggleStore(d: SuperData, handle: string): string {
  const set = new Set(d.selectedStores);
  if (set.has(handle)) set.delete(handle); else set.add(handle);
  return storesHref(d, { stores: [...set] });
}

function storeChip(d: SuperData, s: any): string {
  const on = d.selectedStores.includes(s.handle);
  const dist = s.distanceKm != null ? `${s.distanceKm} km` : "—";
  const badges = `${s.certified ? `<span class="sb sb--cert" title="Tienda certificada">✓ Certificada</span>` : ""}${s.instant ? `<span class="sb sb--inst" title="Entrega instantánea">⚡ Instantánea</span>` : ""}`;
  return `<a class="super-chip ${on ? "on" : ""}" data-store-name="${esc((s.name || "").toLowerCase())}" href="${toggleStore(d, s.handle)}">
    <span class="super-chip__dot">${on ? "✓" : "+"}</span>
    <span class="super-chip__body"><b>${esc(s.name)}</b><small>${esc(s.nearestCity || "")} · ${dist}</small>${badges ? `<span class="super-chip__badges">${badges}</span>` : ""}</span>
  </a>`;
}

// Filter bar: certified / instant / in-stock toggles + a sort selector.
function filterBar(d: SuperData): string {
  const toggle = (label: string, on: boolean, change: any) =>
    `<a class="super-toggle ${on ? "on" : ""}" href="${storesHref(d, { ...change, page: 1 })}">${label}</a>`;
  const sorts: Array<[string, string]> = [["", "Cercanía"], ["price_asc", "Precio: menor"], ["price_desc", "Precio: mayor"], ["savings", "Mayor ahorro"], ["rating", "Mejor valorados"]];
  return `<div class="super-filterbar">
    ${toggle("✓ Certificadas", !!d.certified, { certified: !d.certified })}
    ${toggle("⚡ Entrega instantánea", !!d.instant, { instant: !d.instant })}
    ${toggle("📦 Solo disponibles", !!d.inStock, { inStock: !d.inStock })}
    <span class="super-sort">Ordenar:
      ${sorts.map(([v, l]) => `<a class="${(d.sort || "") === v ? "on" : ""}" href="${storesHref(d, { sort: v, page: 1 })}">${l}</a>`).join("")}
    </span>
  </div>`;
}

export function compareCardsHtml(products: any[]): string { return products.map((p) => compareCard(p)).join(""); }
function compareCard(p: any): string {
  const offers = [...p.offers].sort((a: any, b: any) => parseFloat(a.price) - parseFloat(b.price));
  const best = offers[0];
  const rows = offers.slice(0, 4).map((o: any, i: number) => `<div class="cmp-row ${i === 0 ? "best" : ""}">
    <span class="cmp-store">${esc(o.sellerName)}${o.distanceKm != null ? ` <small>· ${o.distanceKm} km</small>` : ""}</span>
    <span class="cmp-price">${esc(parseFloat(o.price).toFixed(2))} ${esc(o.currency)}${i === 0 && offers.length > 1 ? " ⭐" : ""}</span>
    <button class="add" ${o.stock > 0 ? "" : "disabled"} data-add="${esc(o.offerId)}" data-title="${esc(p.title)}" data-price="${esc(o.price)}" data-currency="${esc(o.currency)}" data-seller="${esc(o.sellerId)}" data-seller-name="${esc(o.sellerName)}" aria-label="Agregar">+</button>
  </div>`).join("");
  return `<article class="card super-card">
    <a href="/p/${esc(p.slug)}" class="super-thumb">
      ${p.image ? `<img loading="lazy" decoding="async" src="${esc(p.image)}" alt="${esc(p.title)}">` : `<span class="ph">${GROCERY_ICON[p.category] || "🛒"}</span>`}
      ${p.savingsPct ? `<span class="badge badge--sale">ahorra ${p.savingsPct}%</span>` : ""}
    </a>
    <div class="super-body">
      <a href="/p/${esc(p.slug)}" style="color:inherit"><h3>${esc(p.title)}</h3></a>
      <div class="super-best"><b>${esc(p.minPrice)} ${esc(p.currency)}</b> <small class="muted">mejor de ${p.storeCount} tienda(s)</small></div>
      <div class="cmp">${rows}</div>
      <button class="btn btn--accent btn--block" ${best && best.stock > 0 ? "" : "disabled"} data-add="${esc(best?.offerId || "")}" data-title="${esc(p.title)}" data-price="${esc(best?.price || "")}" data-currency="${esc(best?.currency || "VES")}" data-seller="${esc(best?.sellerId || "")}" data-seller-name="${esc(best?.sellerName || "")}">Agregar el más barato</button>
    </div>
  </article>`;
}

export function supermarketPage(d: SuperData): string {
  const hasHome = !!(d.home?.lat && d.home?.lng);
  const cats = d.categories || [];
  const body = `
  <div class="container super">
    <section class="super-head">
      <div>
        <span class="eyebrow">Modo supermercado</span>
        <h1>Compra rápido, compara y ahorra</h1>
        <p class="muted">Elige supermercados cercanos a ti y compara precios producto por producto.</p>
      </div>
      <a class="btn btn--ghost" href="/">← Volver al mercado</a>
    </section>

    <div class="super-loc card ${hasHome ? "" : "warn"}">
      <span>📍 <b>${hasHome ? esc(d.home.label || d.home.city || d.cityName) : "Ubicación no definida"}</b>${hasHome && d.home.lat && d.home.lng ? ` <small class="muted">${d.home.lat.toFixed(3)}, ${d.home.lng.toFixed(3)}</small>` : ""}</span>
      <a class="btn btn--primary" href="/cuenta#home-form">${hasHome ? "Cambiar ubicación" : "Definir mi ubicación"}</a>
    </div>

    <section>
      <div class="section-head"><h2>Supermercados cerca de ti ${d.totalStores ? `<span class="muted" style="font-weight:400">(${d.totalStores})</span>` : ""}</h2>${d.selectedStores.length ? `<a class="link" href="${storesHref(d, { stores: [] })}">✕ Limpiar selección</a>` : `<span class="muted hide-sm">Toca para incluir</span>`}</div>
      ${filterBar(d)}
      ${d.stores.length > 8 ? `<input class="store-filter-box" data-store-filter placeholder="Filtrar tiendas por nombre…" aria-label="Filtrar tiendas">` : ""}
      ${!d.selectedStores.length && (d.totalStores ?? 0) > d.stores.length ? `<p class="muted" style="font-size:.85rem;margin:.2rem 0 .6rem">Mostrando ${d.stores.length} de ${d.totalStores} tiendas${d.certified ? " certificadas" : ""}${d.instant ? " con entrega instantánea" : ""}. Comparamos precios entre las más cercanas; toca tiendas para fijar tu comparación.</p>` : ""}
      <div class="super-stores" data-store-list>${d.stores.length ? d.stores.map((s) => storeChip(d, s)).join("") : `<p class="muted">No hay tiendas que cumplan estos filtros.</p>`}</div>
    </section>

    <section>
      <form class="super-search" action="/super" method="get">
        ${d.selectedStores.length ? `<input type="hidden" name="stores" value="${esc(d.selectedStores.join(","))}">` : ""}
        <input type="search" name="q" value="${esc(d.q)}" placeholder="Buscar en supermercado…">
        <button class="btn btn--primary" type="submit">Buscar</button>
      </form>
      <div class="super-cats">
        <a class="chip ${!d.category ? "active" : ""}" href="${storesHref(d, { category: "" })}">🛒 Todo</a>
        ${cats.map((c) => `<a class="chip ${d.category === c ? "active" : ""}" href="${storesHref(d, { category: c })}">${GROCERY_ICON[c] || "•"} ${esc(c)}</a>`).join("")}
      </div>
    </section>

    <section>
      <div class="section-head"><h2>${d.category || "Productos"} <span class="muted" style="font-weight:400">(${d.total ?? d.products.length})</span></h2></div>
      <div class="super-grid" data-grid>
        ${d.products.length ? d.products.map((p) => compareCard(p)).join("") : `<p class="muted">No hay productos para comparar. Selecciona uno o más supermercados arriba.</p>`}
      </div>
      ${infiniteSentinel("/partials/supermarket", superListParams(d), d.page ?? 1, d.pages ?? 1, storesHref(d, { page: (d.page ?? 1) + 1 }))}
    </section>
  </div>`;
  return layout({
    title: "Supermercado — Meriplaza",
    body,
    header: { categories: [], q: d.q, city: d.cityName, cities: d.cities },
    description: "Modo supermercado de Meriplaza: elige tiendas cercanas y compara precios de productos del hogar.",
  });
}
