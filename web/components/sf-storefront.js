// <sf-storefront> — a self-contained, dependency-free Web Component that renders
// a seller's customizable storefront from the SalesFactory catalog API.
//
// Usage:
//   <sf-storefront handle="bodega-maria" api="http://localhost:8083"></sf-storefront>
//
// Design notes (see docs/ARCHITECTURE.md):
//   - No framework, no build step. Plain custom element + Shadow DOM.
//   - Low-connectivity friendly: a single fetch, graceful error + retry, and
//     the last good payload cached in localStorage so a flaky reload still
//     shows the store.
//   - The seller's theme (colors, logo, tagline, layout) drives the look, so
//     every storefront feels personal while sharing this one component.
class SfStorefront extends HTMLElement {
  static get observedAttributes() { return ["handle", "api"]; }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._cart = new Map(); // productId -> { product, qty }
  }

  connectedCallback() { this.load(); }
  attributeChangedCallback() { if (this.isConnected) this.load(); }

  // `api` is the worker origin (e.g. http://localhost:8799). The catalog is
  // mounted under /catalog on the edge Worker.
  get api() { return (this.getAttribute("api") || "").replace(/\/$/, ""); }
  get handle() { return this.getAttribute("handle") || ""; }
  get cacheKey() { return `sf-storefront:${this.handle}`; }
  get endpoint() { return `${this.api}/catalog/sellers/${encodeURIComponent(this.handle)}`; }

  async load() {
    if (!this.handle) { this.renderError("No storefront handle provided."); return; }
    this.renderLoading();
    try {
      const res = await fetch(this.endpoint);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      try { localStorage.setItem(this.cacheKey, JSON.stringify(data)); } catch (_) {}
      this.renderStore(data);
    } catch (err) {
      // Low-connectivity fallback: show the last good snapshot if we have one.
      const cached = this.readCache();
      if (cached) { this.renderStore(cached, true); }
      else this.renderError(`Could not load storefront (${err.message}).`);
    }
  }

  readCache() {
    try { return JSON.parse(localStorage.getItem(this.cacheKey)); } catch (_) { return null; }
  }

  // --- cart ---
  addToCart(product) {
    const entry = this._cart.get(product.id) || { product, qty: 0 };
    entry.qty += 1;
    this._cart.set(product.id, entry);
    this.updateCart();
  }

  cartItems() { return [...this._cart.values()]; }

  cartTotal(currency) {
    let cents = 0;
    for (const { product, qty } of this._cart.values()) {
      cents += Math.round(parseFloat(product.price) * 100) * qty;
    }
    return (cents / 100).toFixed(2);
  }

  checkout(seller) {
    const items = this.cartItems().map(({ product, qty }) => ({ productId: product.id, quantity: qty }));
    this.dispatchEvent(new CustomEvent("sf-checkout", {
      bubbles: true, composed: true,
      detail: { sellerId: seller.id, items, total: this.cartTotal(seller.currency), currency: seller.currency },
    }));
  }

  // --- rendering ---
  renderLoading() { this.shadowRoot.innerHTML = this.styles() + `<div class="state">Cargando tienda…</div>`; }
  renderError(msg) {
    this.shadowRoot.innerHTML = this.styles() +
      `<div class="state err">${esc(msg)} <button id="retry">Reintentar</button></div>`;
    this.shadowRoot.getElementById("retry")?.addEventListener("click", () => this.load());
  }

  renderStore(data, stale = false) {
    const { seller, products = [] } = data;
    const t = seller.theme || {};
    const layout = t.layout === "list" ? "list" : "grid";
    this.shadowRoot.innerHTML = this.styles(t) + `
      ${stale ? `<div class="banner">Sin conexión — mostrando datos guardados</div>` : ``}
      <header class="hero">
        ${t.logoUrl ? `<img class="logo" src="${esc(t.logoUrl)}" alt="">` : ``}
        <div>
          <h1>${esc(seller.name)}</h1>
          ${t.tagline ? `<p class="tagline">${esc(t.tagline)}</p>` : ``}
          ${this.socialLinks(seller.socials)}
        </div>
      </header>
      <main class="${layout}">
        ${products.length ? products.map((p) => this.card(p, seller.currency)).join("") :
          `<p class="state">Esta tienda aún no tiene productos.</p>`}
      </main>
      <aside class="cart" id="cart" hidden></aside>`;

    this.shadowRoot.querySelectorAll("[data-add]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const p = products.find((x) => x.id === btn.dataset.add);
        if (p) this.addToCart(p);
      });
    });
    this._seller = seller;
    this.updateCart();
  }

  card(p, currency) {
    const img = (p.images && p.images[0]) || "";
    const out = p.stock <= 0;
    return `
      <article class="product">
        <div class="thumb">${img ? `<img src="${esc(img)}" alt="">` : `<span>📦</span>`}</div>
        <h3>${esc(p.title)}</h3>
        ${p.description ? `<p class="desc">${esc(p.description)}</p>` : ``}
        <div class="row">
          <span class="price">${esc(p.price)} ${esc(p.currency || currency)}</span>
          <button data-add="${esc(p.id)}" ${out ? "disabled" : ""}>${out ? "Agotado" : "Agregar"}</button>
        </div>
      </article>`;
  }

  socialLinks(s = {}) {
    const links = [];
    if (s.instagram) links.push(`<a href="https://instagram.com/${esc(s.instagram)}">Instagram</a>`);
    if (s.whatsapp) links.push(`<a href="https://wa.me/${esc(s.whatsapp)}">WhatsApp</a>`);
    if (s.facebook) links.push(`<a href="https://facebook.com/${esc(s.facebook)}">Facebook</a>`);
    return links.length ? `<nav class="socials">${links.join("")}</nav>` : ``;
  }

  updateCart() {
    const el = this.shadowRoot.getElementById("cart");
    if (!el || !this._seller) return;
    const items = this.cartItems();
    if (!items.length) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = `
      <h2>Carrito</h2>
      <ul>${items.map(({ product, qty }) => `<li>${qty}× ${esc(product.title)}</li>`).join("")}</ul>
      <div class="total">Total: ${this.cartTotal(this._seller.currency)} ${esc(this._seller.currency)}</div>
      <button id="checkout">Pagar</button>`;
    el.querySelector("#checkout").addEventListener("click", () => this.checkout(this._seller));
  }

  styles(t = {}) {
    const primary = t.primaryColor || "#1f6feb";
    const accent = t.accentColor || "#0b8457";
    return `<style>
      :host { display:block; font-family: system-ui, sans-serif; color:#1a1a1a; --p:${primary}; --a:${accent}; }
      .state { padding:2rem; text-align:center; color:#555; }
      .err { color:#b00; }
      .banner { background:#fff3cd; padding:.5rem 1rem; font-size:.85rem; text-align:center; }
      .hero { display:flex; gap:1rem; align-items:center; padding:1.5rem; background:var(--p); color:#fff; }
      .hero h1 { margin:0; font-size:1.5rem; }
      .logo { width:64px; height:64px; border-radius:12px; object-fit:cover; background:#fff; }
      .tagline { margin:.25rem 0 0; opacity:.9; }
      .socials a { color:#fff; margin-right:.75rem; font-size:.85rem; }
      main.grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(210px,1fr)); gap:1rem; padding:1rem; max-width:1100px; margin:0 auto; }
      main.list { display:flex; flex-direction:column; gap:.75rem; padding:1rem; max-width:1100px; margin:0 auto; }
      .product { display:flex; flex-direction:column; border:1px solid #e7e7e7; border-radius:12px; padding:.75rem; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,.05); }
      .thumb { aspect-ratio:1; display:grid; place-items:center; background:#f3f3f3; border-radius:8px; font-size:2rem; overflow:hidden; }
      .thumb img { width:100%; height:100%; object-fit:cover; }
      .product h3 { font-size:1rem; line-height:1.3; margin:.6rem 0 .25rem; }
      .desc { font-size:.8rem; color:#666; margin:0 0 .5rem; }
      /* Pin the price+action row to the bottom so cards of differing heights align. */
      .row { display:flex; justify-content:space-between; align-items:center; gap:.75rem; margin-top:auto; padding-top:.6rem; }
      .price { font-weight:700; white-space:nowrap; }
      button { background:var(--a); color:#fff; border:0; border-radius:8px; padding:.45rem .9rem; font-size:.85rem; font-weight:600; cursor:pointer; white-space:nowrap; }
      button:hover:not(:disabled) { filter:brightness(1.07); }
      button:disabled { background:#bbb; cursor:not-allowed; }
      .cart { position:sticky; bottom:0; background:#fff; border-top:2px solid var(--p); padding:1rem; }
      .cart ul { margin:.5rem 0; padding-left:1.2rem; }
      .total { font-weight:600; margin:.5rem 0; }
    </style>`;
  }
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

customElements.define("sf-storefront", SfStorefront);
