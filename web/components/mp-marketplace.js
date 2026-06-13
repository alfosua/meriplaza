// <mp-marketplace> — the centralized Meriplaza home: a search-first, category-
// driven, mobile-first marketplace across every store. Reads the edge catalog
// Worker; degrades to a localStorage snapshot offline.
import { applyTheme, esc, iconFor } from "./theme.js";
import { cart } from "./cart-store.js";

const COMPONENT_CSS = `
:host { display: block; background: var(--mp-bg); min-height: 100%; }

/* Header */
.head { position: sticky; top: 0; z-index: 20; background: var(--mp-brand); color: #fff; box-shadow: var(--mp-shadow-2); }
.head-row { display: flex; align-items: center; gap: .75rem; padding: .7rem 0; }
.logo { font-weight: 900; font-size: 1.3rem; letter-spacing: -.02em; white-space: nowrap; cursor: pointer; }
.logo b { color: #ffd23c; }
.search { flex: 1; display: flex; background: #fff; border-radius: var(--mp-radius-pill); overflow: hidden; box-shadow: var(--mp-shadow-1); }
.search input { flex: 1; border: 0; outline: 0; padding: .62rem .95rem; font: inherit; font-size: var(--mp-fs-sm); color: var(--mp-ink); min-width: 0; }
.search button { border: 0; background: #ffd23c; color: #14151a; padding: 0 1rem; font-size: 1.05rem; cursor: pointer; }
.icons { display: flex; align-items: center; gap: .35rem; }
.iconbtn { position: relative; background: rgba(255,255,255,.12); border: 0; color: #fff; width: 40px; height: 40px; border-radius: var(--mp-radius-pill); cursor: pointer; font-size: 1.15rem; display: grid; place-items: center; }
.iconbtn:hover { background: rgba(255,255,255,.22); }
.cart-count { position: absolute; top: -4px; right: -4px; background: var(--mp-accent); color: #fff; font-size: .65rem; font-weight: 800; min-width: 18px; height: 18px; border-radius: 999px; display: grid; place-items: center; padding: 0 4px; }
.loc { display: flex; align-items: center; gap: .35rem; font-size: var(--mp-fs-xs); padding: 0 0 .55rem; opacity: .92; }
.loc b { font-weight: 700; }

/* Category bar */
.cats { background: var(--mp-surface); border-bottom: 1px solid var(--mp-line); position: sticky; top: 56px; z-index: 15; }
.cats-row { display: flex; gap: .5rem; overflow-x: auto; padding: .6rem 0; scrollbar-width: none; }
.cats-row::-webkit-scrollbar { display: none; }
.chip { white-space: nowrap; border: 1px solid var(--mp-line); background: #fff; color: var(--mp-ink); border-radius: var(--mp-radius-pill); padding: .4rem .85rem; font-size: var(--mp-fs-sm); font-weight: 600; cursor: pointer; display: inline-flex; gap: .35rem; align-items: center; }
.chip[aria-pressed="true"] { background: var(--mp-brand-050); border-color: var(--mp-brand); color: var(--mp-brand); }

/* Hero */
.hero { margin: 1.25rem auto; border-radius: var(--mp-radius); overflow: hidden; color: #fff;
  background: radial-gradient(120% 140% at 100% 0%, #ff8a5b 0%, var(--mp-accent) 35%, var(--mp-brand) 100%); }
.hero-in { padding: clamp(1.5rem, 5vw, 3rem); max-width: 640px; }
.hero h1 { font-size: var(--mp-fs-2xl); line-height: 1.02; margin: 0 0 .6rem; letter-spacing: -.02em; }
.hero p { margin: 0 0 1.2rem; font-size: var(--mp-fs-md); opacity: .95; }

section { padding: 1.5rem 0; }

/* Product grid */
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: clamp(.7rem, 2vw, 1.1rem); }
.product { display: flex; flex-direction: column; cursor: pointer; transition: transform .1s ease, box-shadow .15s ease; }
.product:hover { transform: translateY(-3px); box-shadow: var(--mp-shadow-2); }
.product .body { padding: .7rem .8rem .85rem; display: flex; flex-direction: column; flex: 1; }
.product .store { font-size: var(--mp-fs-xs); color: var(--mp-ink-2); }
.product h3 { font-size: var(--mp-fs-sm); margin: .15rem 0 .5rem; line-height: 1.3; font-weight: 600;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: 2.3em; }
.product .foot { margin-top: auto; display: flex; align-items: center; justify-content: space-between; gap: .5rem; }
.badge-wrap { position: absolute; top: .5rem; left: .5rem; }
.add { background: var(--mp-brand); color: #fff; border: 0; border-radius: var(--mp-radius-pill); width: 34px; height: 34px; font-size: 1.2rem; cursor: pointer; flex: none; }
.add:hover { background: var(--mp-brand-700); }
.add[disabled] { background: #c8ccd4; cursor: not-allowed; }

/* Store strip */
.stores { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1rem; }
.store-card { cursor: pointer; transition: transform .1s, box-shadow .15s; }
.store-card:hover { transform: translateY(-3px); box-shadow: var(--mp-shadow-2); }
.store-cover { height: 88px; background: linear-gradient(135deg, var(--p, var(--mp-brand)), var(--a, var(--mp-accent))); display: grid; place-items: center; }
.store-cover .av { width: 54px; height: 54px; border-radius: 14px; background: rgba(255,255,255,.95); color: var(--p, var(--mp-brand)); display: grid; place-items: center; font-weight: 900; font-size: 1.5rem; }
.store-meta { padding: .85rem 1rem 1rem; }
.store-meta h3 { margin: .45rem 0 .15rem; font-size: var(--mp-fs-md); }
.store-foot { display: flex; justify-content: space-between; font-size: var(--mp-fs-xs); color: var(--mp-ink-2); border-top: 1px solid var(--mp-line); margin-top: .6rem; padding-top: .5rem; }

.state { padding: 3rem 1rem; text-align: center; color: var(--mp-ink-2); }
.banner { background: #fff7e6; color: #7a5b00; text-align: center; font-size: var(--mp-fs-sm); padding: .5rem; }

@media (max-width: 560px) {
  .logo { font-size: 1.1rem; }
  .head-row { flex-wrap: wrap; }
  .search { order: 3; flex-basis: 100%; }
}
`;

class MpMarketplace extends HTMLElement {
  static get observedAttributes() { return ["api"]; }
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._fallback = applyTheme(this.shadowRoot, COMPONENT_CSS);
    this._sellers = []; this._products = []; this._cat = ""; this._q = "";
    this._onCart = () => this.updateCartCount();
  }
  connectedCallback() { cart.addEventListener("change", this._onCart); this.load(); }
  disconnectedCallback() { cart.removeEventListener("change", this._onCart); }
  attributeChangedCallback() { if (this.isConnected) this.load(); }

  get api() { return (this.getAttribute("api") || "").replace(/\/$/, ""); }

  async load() {
    this.renderSkeleton();
    try {
      const [mk, pr] = await Promise.all([
        fetch(`${this.api}/catalog/marketplace`).then((r) => r.json()),
        fetch(`${this.api}/catalog/products`).then((r) => r.json()),
      ]);
      this._sellers = mk.sellers || [];
      this._products = pr.products || [];
      try { localStorage.setItem("mp:home", JSON.stringify({ s: this._sellers, p: this._products })); } catch {}
      this.render();
    } catch (err) {
      const c = this.readCache();
      if (c) { this._sellers = c.s; this._products = c.p; this.render(true); }
      else this.renderError(err.message);
    }
  }
  readCache() { try { return JSON.parse(localStorage.getItem("mp:home")); } catch { return null; } }

  categories() {
    const set = new Set();
    for (const p of this._products) if (p.category) set.add(p.category);
    return [...set].sort();
  }
  filtered() {
    const q = this._q.trim().toLowerCase();
    return this._products.filter((p) =>
      (!this._cat || p.category === this._cat) &&
      (!q || p.title.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q)));
  }

  // --- rendering ---
  // The shell (header + category bar + empty #content) is rendered once so the
  // search box keeps focus and the sticky header never repaints while filtering;
  // only #content is re-rendered as the shopper searches or picks a category.
  renderShell(stale = false) {
    this.shadowRoot.innerHTML = this._fallback + `
      ${stale ? `<div class="banner">Sin conexión — mostrando datos guardados</div>` : ``}
      <header class="head">
        <div class="mp-container">
          <div class="head-row">
            <div class="logo" data-home>Meri<b>plaza</b></div>
            <form class="search" data-search>
              <input type="search" placeholder="Buscar productos en todas las tiendas…" value="${esc(this._q)}" aria-label="Buscar">
              <button type="submit" aria-label="Buscar">🔍</button>
            </form>
            <div class="icons">
              <button class="iconbtn" data-account aria-label="Cuenta">👤</button>
              <button class="iconbtn" data-cart aria-label="Carrito">🛒<span class="cart-count" hidden>0</span></button>
            </div>
          </div>
          <div class="loc">📍 Entregar en <b>Caracas, Venezuela</b></div>
        </div>
      </header>
      <nav class="cats"><div class="mp-container"><div class="cats-row" data-cats></div></div></nav>
      <div class="mp-container" id="content"></div>`;
    this.wireHeader();
    this.renderCats();
  }

  renderSkeleton() {
    this.renderShell();
    const cards = Array.from({ length: 10 }).map(() =>
      `<div class="mp-card product"><div class="mp-skel" style="aspect-ratio:1"></div><div class="body"><div class="mp-skel" style="height:12px;margin:.4rem 0"></div><div class="mp-skel" style="height:12px;width:60%"></div></div></div>`).join("");
    this.shadowRoot.getElementById("content").innerHTML = `<section><div class="grid">${cards}</div></section>`;
  }
  renderError(msg) {
    this.renderShell();
    this.shadowRoot.getElementById("content").innerHTML = `<div class="state">No se pudo cargar el mercado (${esc(msg)}). <button class="mp-btn mp-btn--primary" data-retry>Reintentar</button></div>`;
    this.shadowRoot.querySelector("[data-retry]")?.addEventListener("click", () => this.load());
  }

  render(stale = false) {
    this.renderShell(stale);
    this.renderContent();
  }

  renderContent() {
    const products = this.filtered();
    const browsing = !this._q && !this._cat;
    const heading = this._q ? `Resultados para “${esc(this._q)}”` : this._cat ? esc(this._cat) : "Ofertas destacadas";
    const content = this.shadowRoot.getElementById("content");
    if (!content) return;
    content.innerHTML = `
      ${browsing ? `
      <section>
        <div class="hero">
          <div class="hero-in">
            <h1>Todo Venezuela, en una sola plaza</h1>
            <p>Supermercados, tiendas y emprendedores. Paga en bolívares, divisas o cripto — con entrega local.</p>
            <button class="mp-btn mp-btn--accent" data-scroll-stores>Explorar tiendas</button>
          </div>
        </div>
      </section>` : ``}

      <section>
        <div class="mp-section-head"><h2>${heading}</h2><span class="mp-muted">${products.length} producto(s)</span></div>
        <div class="grid">${products.length ? products.map((p) => this.productCard(p)).join("") : `<p class="state">Nada encontrado.</p>`}</div>
      </section>

      ${browsing ? `
      <section id="stores">
        <div class="mp-section-head"><h2>Nuestras tiendas</h2></div>
        <div class="stores">${this._sellers.map((s) => this.storeCard(s)).join("")}</div>
      </section>` : ``}
    `;
    content.querySelectorAll("[data-add]").forEach((b) => b.addEventListener("click", (e) => {
      e.stopPropagation();
      const p = this._products.find((x) => x.id === b.dataset.add);
      if (p) { cart.add(p); this.dispatchEvent(new CustomEvent("mp-open-cart", { bubbles: true, composed: true })); }
    }));
    content.querySelectorAll("[data-open-store]").forEach((el) => el.addEventListener("click", () =>
      this.dispatchEvent(new CustomEvent("mp-open-store", { bubbles: true, composed: true, detail: { handle: el.dataset.openStore } }))));
    content.querySelector("[data-scroll-stores]")?.addEventListener("click", () =>
      content.querySelector("#stores")?.scrollIntoView({ behavior: "smooth" }));
    this.syncCats();
  }

  renderCats() {
    const row = this.shadowRoot.querySelector("[data-cats]");
    if (!row) return;
    const cats = this.categories();
    row.innerHTML = [`<button class="chip" data-cat="" aria-pressed="${!this._cat}">Todo</button>`]
      .concat(cats.map((c) => `<button class="chip" data-cat="${esc(c)}" aria-pressed="${this._cat === c}">${iconFor(c)} ${esc(c)}</button>`)).join("");
    row.querySelectorAll("[data-cat]").forEach((b) => b.addEventListener("click", () => {
      this._cat = b.dataset.cat; this._q = "";
      const input = this.shadowRoot.querySelector("[data-search] input"); if (input) input.value = "";
      this.renderContent();
    }));
  }

  syncCats() {
    this.shadowRoot.querySelectorAll("[data-cat]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.cat === this._cat)));
  }

  productCard(p) {
    const out = p.stock <= 0;
    return `
      <article class="mp-card product" data-open-store="${esc(p.sellerHandle)}">
        <div class="mp-thumb">
          <span>${iconFor(p.category)}</span>
          ${(p.images && p.images[0]) ? `<img loading="lazy" decoding="async" src="${esc(p.images[0])}" alt="">` : ``}
          <div class="badge-wrap">${out ? `<span class="mp-badge mp-badge--out">Agotado</span>` : ``}</div>
        </div>
        <div class="body">
          <span class="store">${esc(p.sellerName || "")}</span>
          <h3>${esc(p.title)}</h3>
          <div class="foot">
            <span class="mp-price">${esc(p.price)} ${esc(p.currency)}</span>
            <button class="add" data-add="${esc(p.id)}" ${out ? "disabled" : ""} aria-label="Agregar al carrito">+</button>
          </div>
        </div>
      </article>`;
  }

  storeCard(s) {
    const t = s.theme || {};
    const initial = (s.name || "?").trim()[0] || "?";
    return `
      <article class="mp-card store-card" data-open-store="${esc(s.handle)}" style="--p:${esc(t.primaryColor || "#1b39c9")};--a:${esc(t.accentColor || "#ff5a3c")}">
        <div class="store-cover">${t.logoUrl ? `<img loading="lazy" src="${esc(t.logoUrl)}" alt="" style="width:54px;height:54px;border-radius:14px;object-fit:cover">` : `<span class="av">${esc(initial)}</span>`}</div>
        <div class="store-meta">
          <span class="mp-badge mp-badge--kind">${kindLabel(s.kind)}</span>
          <h3>${esc(s.name)}</h3>
          ${t.tagline ? `<p class="mp-muted" style="margin:.1rem 0 0;font-size:var(--mp-fs-sm)">${esc(t.tagline)}</p>` : ``}
          <div class="store-foot"><span>${s.productCount ?? 0} productos</span><span style="color:var(--mp-good);font-weight:700">${esc(s.currency)}</span></div>
        </div>
      </article>`;
  }

  wireHeader() {
    this.shadowRoot.querySelector("[data-home]")?.addEventListener("click", () => {
      this._q = ""; this._cat = "";
      const input = this.shadowRoot.querySelector("[data-search] input"); if (input) input.value = "";
      this.renderContent();
    });
    this.shadowRoot.querySelector("[data-cart]")?.addEventListener("click", () => this.dispatchEvent(new CustomEvent("mp-open-cart", { bubbles: true, composed: true })));
    const form = this.shadowRoot.querySelector("[data-search]");
    form?.addEventListener("submit", (e) => { e.preventDefault(); this._q = form.querySelector("input").value; this._cat = ""; this.renderContent(); });
    // Filtering only repaints #content, so the input keeps focus while typing.
    form?.querySelector("input")?.addEventListener("input", debounce((e) => { this._q = e.target.value; this._cat = ""; this.renderContent(); }, 200));
  }

  updateCartCount() {
    const el = this.shadowRoot.querySelector(".cart-count");
    if (!el) return;
    const n = cart.count();
    el.hidden = n === 0; el.textContent = n;
  }
}

function kindLabel(k) { return { supermarket: "Supermercado", store: "Tienda", independent: "Emprendedor" }[k] || "Tienda"; }
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

customElements.define("mp-marketplace", MpMarketplace);
