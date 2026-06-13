// <sf-marketplace> — the unified "Amazon for Venezuela" landing. Lists every
// store on the platform and offers cross-store product search, while each store
// keeps its own personal storefront (<sf-storefront>). Dependency-free Web
// Component; reads the edge catalog Worker.
//
//   <sf-marketplace api="http://localhost:8799"></sf-marketplace>
//
// Emits "sf-open-store" (detail: { handle }) when a store is opened, so the host
// page can route to that storefront.
class SfMarketplace extends HTMLElement {
  static get observedAttributes() { return ["api"]; }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._sellers = [];
    this._query = "";
  }

  connectedCallback() { this.load(); }
  attributeChangedCallback() { if (this.isConnected) this.load(); }

  get api() { return (this.getAttribute("api") || "").replace(/\/$/, ""); }

  async load() {
    this.renderLoading();
    try {
      const res = await fetch(`${this.api}/catalog/marketplace`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this._sellers = data.sellers || [];
      try { localStorage.setItem("sf-marketplace", JSON.stringify(this._sellers)); } catch (_) {}
      this.render();
    } catch (err) {
      const cached = this.readCache();
      if (cached) { this._sellers = cached; this.render(true); }
      else this.renderError(`No se pudo cargar el mercado (${err.message}).`);
    }
  }

  readCache() { try { return JSON.parse(localStorage.getItem("sf-marketplace")); } catch (_) { return null; } }

  async search(q) {
    this._query = q;
    if (!q.trim()) { this._results = null; this.render(); return; }
    try {
      const res = await fetch(`${this.api}/catalog/products?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      this._results = data.products || [];
    } catch (_) { this._results = []; }
    this.render();
  }

  openStore(handle) {
    this.dispatchEvent(new CustomEvent("sf-open-store", { bubbles: true, composed: true, detail: { handle } }));
  }

  // --- rendering ---
  renderLoading() { this.shadowRoot.innerHTML = this.styles() + `<div class="state">Cargando mercado…</div>`; }
  renderError(msg) {
    this.shadowRoot.innerHTML = this.styles() + `<div class="state err">${esc(msg)} <button id="retry">Reintentar</button></div>`;
    this.shadowRoot.getElementById("retry")?.addEventListener("click", () => this.load());
  }

  render(stale = false) {
    const results = this._results;
    this.shadowRoot.innerHTML = this.styles() + `
      ${stale ? `<div class="banner">Sin conexión — mostrando datos guardados</div>` : ``}
      <header class="top">
        <div class="brand">SalesFactory <span>Mercado</span></div>
        <input id="q" class="search" type="search" placeholder="Buscar en todas las tiendas…" value="${esc(this._query)}">
      </header>
      ${results
        ? this.resultsView(results)
        : `<section class="stores">
             <h2>Tiendas (${this._sellers.length})</h2>
             <div class="grid">${this._sellers.map((s) => this.storeCard(s)).join("")}</div>
           </section>`}
    `;
    const input = this.shadowRoot.getElementById("q");
    input.addEventListener("input", debounce((e) => this.search(e.target.value), 250));
    this.shadowRoot.querySelectorAll("[data-store]").forEach((el) =>
      el.addEventListener("click", () => this.openStore(el.dataset.store)));
  }

  storeCard(s) {
    const t = s.theme || {};
    const initial = (s.name || "?").trim()[0] || "?";
    return `
      <article class="store" data-store="${esc(s.handle)}" style="--p:${esc(t.primaryColor || "#1f6feb")};--a:${esc(t.accentColor || "#0b8457")}">
        <div class="cover">${t.logoUrl ? `<img src="${esc(t.logoUrl)}" alt="">` : `<span class="avatar">${esc(initial)}</span>`}</div>
        <div class="meta">
          <span class="kind">${kindLabel(s.kind)}</span>
          <h3>${esc(s.name)}</h3>
          ${t.tagline ? `<p class="tagline">${esc(t.tagline)}</p>` : ``}
          <div class="foot"><span>${s.productCount ?? 0} productos</span><span class="cur">${esc(s.currency)}</span></div>
        </div>
      </article>`;
  }

  resultsView(results) {
    return `
      <section class="results">
        <h2>${results.length} resultado(s) para "${esc(this._query)}"</h2>
        <div class="grid products">
          ${results.length ? results.map((p) => this.productCard(p)).join("") : `<p class="state">Nada encontrado.</p>`}
        </div>
      </section>`;
  }

  productCard(p) {
    const out = p.stock <= 0;
    return `
      <article class="product" data-store="${esc(p.sellerHandle)}">
        <div class="thumb">${(p.images && p.images[0]) ? `<img src="${esc(p.images[0])}" alt="">` : `<span>📦</span>`}</div>
        <h4>${esc(p.title)}</h4>
        <div class="seller">${esc(p.sellerName)}</div>
        <div class="row"><span class="price">${esc(p.price)} ${esc(p.currency)}</span>${out ? `<span class="out">Agotado</span>` : ``}</div>
      </article>`;
  }

  styles() {
    return `<style>
      :host { display:block; font-family: system-ui, -apple-system, sans-serif; color:#15151a; background:#f6f7f9; min-height:100%; }
      .state { padding:3rem; text-align:center; color:#666; }
      .err { color:#b00; }
      .banner { background:#fff3cd; padding:.5rem 1rem; font-size:.85rem; text-align:center; }
      .top { display:flex; gap:1rem; align-items:center; padding:1rem 1.25rem; background:#10141b; color:#fff; position:sticky; top:0; z-index:5; }
      .brand { font-weight:800; font-size:1.15rem; white-space:nowrap; }
      .brand span { color:#f5a623; font-weight:600; }
      .search { flex:1; padding:.6rem .9rem; border:0; border-radius:999px; font-size:.95rem; background:#222a35; color:#fff; }
      .search::placeholder { color:#9aa4b2; }
      section { padding:1.25rem; max-width:1100px; margin:0 auto; }
      h2 { font-size:1.05rem; margin:.25rem 0 1rem; color:#333; }
      .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(230px,1fr)); gap:1rem; }
      .store { background:#fff; border-radius:14px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,.08); cursor:pointer; transition:transform .12s, box-shadow .12s; }
      .store:hover { transform:translateY(-3px); box-shadow:0 8px 22px rgba(0,0,0,.13); }
      .cover { height:84px; background:linear-gradient(135deg,var(--p),var(--a)); display:grid; place-items:center; }
      .cover img { width:56px; height:56px; border-radius:12px; object-fit:cover; background:#fff; }
      .avatar { width:56px; height:56px; border-radius:14px; background:rgba(255,255,255,.92); color:var(--p); display:grid; place-items:center; font-weight:800; font-size:1.6rem; }
      .meta { padding:.85rem 1rem 1rem; }
      .kind { display:inline-block; font-size:.7rem; letter-spacing:.04em; text-transform:uppercase; color:#fff; background:var(--a); padding:.12rem .5rem; border-radius:999px; }
      .meta h3 { margin:.5rem 0 .2rem; font-size:1.05rem; }
      .tagline { margin:0 0 .6rem; font-size:.85rem; color:#666; }
      .foot { display:flex; justify-content:space-between; font-size:.8rem; color:#888; border-top:1px solid #eee; padding-top:.5rem; }
      .cur { font-weight:600; color:#0b8457; }
      .products .product { background:#fff; border-radius:12px; padding:.75rem; box-shadow:0 1px 3px rgba(0,0,0,.07); cursor:pointer; }
      .thumb { aspect-ratio:1; display:grid; place-items:center; background:#f0f1f4; border-radius:8px; font-size:2rem; overflow:hidden; }
      .thumb img { width:100%; height:100%; object-fit:cover; }
      .product h4 { font-size:.95rem; margin:.5rem 0 .15rem; }
      .seller { font-size:.78rem; color:#888; margin-bottom:.4rem; }
      .row { display:flex; justify-content:space-between; align-items:center; }
      .price { font-weight:700; }
      .out { font-size:.75rem; color:#b00; }
    </style>`;
  }
}

function kindLabel(k) {
  return { supermarket: "Supermercado", store: "Tienda", independent: "Emprendedor" }[k] || "Tienda";
}
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

customElements.define("sf-marketplace", SfMarketplace);
