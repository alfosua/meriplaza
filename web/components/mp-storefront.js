// <mp-storefront> — a single store's own branded frontend. Meriplaza lets each
// store ship a custom look (the CMS angle): the seller's theme drives colors,
// hero, and layout (grid | list | featured) while reusing the shared, fast
// infrastructure and the unified cart.
import { applyTheme, esc, iconFor } from "./theme.js";
import { cart } from "./cart-store.js";

const COMPONENT_CSS = `
:host { display: block; background: var(--mp-bg); min-height: 100%; --p: var(--mp-brand); --a: var(--mp-accent); }

.hero { color: #fff; background: linear-gradient(135deg, var(--p), color-mix(in srgb, var(--p) 55%, var(--a))); }
.hero-in { padding: clamp(1.5rem, 5vw, 2.75rem) 0; display: flex; align-items: center; gap: 1.25rem; }
.logo { width: 76px; height: 76px; border-radius: 18px; background: rgba(255,255,255,.95); color: var(--p); display: grid; place-items: center; font-weight: 900; font-size: 2rem; flex: none; box-shadow: var(--mp-shadow-2); overflow: hidden; }
.logo img { width: 100%; height: 100%; object-fit: cover; }
.hero h1 { margin: 0; font-size: var(--mp-fs-xl); letter-spacing: -.02em; }
.hero .tag { margin: .35rem 0 .65rem; opacity: .95; }
.socials a { color: #fff; text-decoration: none; font-weight: 650; font-size: var(--mp-fs-sm); margin-right: .9rem; border-bottom: 2px solid rgba(255,255,255,.5); padding-bottom: 1px; }
.kind { background: rgba(255,255,255,.2); }

section { padding: 1.5rem 0; }

/* grid (default) */
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: clamp(.7rem, 2vw, 1.1rem); }
/* list layout */
.list { display: flex; flex-direction: column; gap: .8rem; }
.list .product { flex-direction: row; }
.list .mp-thumb { width: 120px; flex: none; aspect-ratio: 1; }
.list .body { flex: 1; }
/* featured layout: first product spans larger */
.featured .product:first-child { grid-column: span 2; grid-row: span 2; }
.featured .product:first-child .mp-thumb { font-size: 5rem; }

.product { display: flex; flex-direction: column; overflow: hidden; transition: transform .1s, box-shadow .15s; }
.product:hover { transform: translateY(-3px); box-shadow: var(--mp-shadow-2); }
.product .body { padding: .75rem .85rem .9rem; display: flex; flex-direction: column; flex: 1; }
.product h3 { font-size: var(--mp-fs-md); margin: .2rem 0 .3rem; line-height: 1.3; }
.product .desc { font-size: var(--mp-fs-sm); color: var(--mp-ink-2); margin: 0 0 .5rem;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.foot { margin-top: auto; display: flex; align-items: center; justify-content: space-between; gap: .6rem; padding-top: .5rem; }
.add { background: var(--a); color: #fff; border: 0; border-radius: var(--mp-radius-pill); padding: .5rem .95rem; font-weight: 700; font-size: var(--mp-fs-sm); cursor: pointer; white-space: nowrap; }
.add:hover { filter: brightness(1.07); }
.add[disabled] { background: #c8ccd4; cursor: not-allowed; }

.subbar { background: var(--mp-surface); border-bottom: 1px solid var(--mp-line); position: sticky; top: 0; z-index: 10; }
.subbar-in { display: flex; align-items: center; justify-content: space-between; padding: .6rem 0; }
.back { background: none; border: 0; cursor: pointer; font: inherit; font-weight: 650; color: var(--p); display: inline-flex; gap: .35rem; align-items: center; }
.cartbtn { position: relative; background: var(--p); color: #fff; border: 0; border-radius: var(--mp-radius-pill); padding: .5rem .9rem; font-weight: 700; cursor: pointer; }
.cart-count { position: absolute; top: -6px; right: -6px; background: var(--a); color: #fff; font-size: .65rem; font-weight: 800; min-width: 18px; height: 18px; border-radius: 999px; display: grid; place-items: center; }
.state { padding: 3rem 1rem; text-align: center; color: var(--mp-ink-2); }
.banner { background: #fff7e6; color: #7a5b00; text-align: center; font-size: var(--mp-fs-sm); padding: .5rem; }
`;

class MpStorefront extends HTMLElement {
  static get observedAttributes() { return ["handle", "api"]; }
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._fallback = applyTheme(this.shadowRoot, COMPONENT_CSS);
    this._onCart = () => this.updateCartCount();
  }
  connectedCallback() { cart.addEventListener("change", this._onCart); this.load(); }
  disconnectedCallback() { cart.removeEventListener("change", this._onCart); }
  attributeChangedCallback() { if (this.isConnected) this.load(); }

  get api() { return (this.getAttribute("api") || "").replace(/\/$/, ""); }
  get handle() { return this.getAttribute("handle") || ""; }
  get cacheKey() { return `mp:store:${this.handle}`; }

  async load() {
    this.renderSkeleton();
    try {
      const res = await fetch(`${this.api}/catalog/sellers/${encodeURIComponent(this.handle)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      try { localStorage.setItem(this.cacheKey, JSON.stringify(data)); } catch {}
      this.render(data);
    } catch (err) {
      const cached = this.readCache();
      if (cached) this.render(cached, true);
      else this.renderError(err.message);
    }
  }
  readCache() { try { return JSON.parse(localStorage.getItem(this.cacheKey)); } catch { return null; } }

  renderSkeleton() {
    const cards = Array.from({ length: 6 }).map(() => `<div class="mp-card product"><div class="mp-skel" style="aspect-ratio:1"></div><div class="body"><div class="mp-skel" style="height:14px;margin:.5rem 0"></div><div class="mp-skel" style="height:12px;width:50%"></div></div></div>`).join("");
    this.shadowRoot.innerHTML = this._fallback + `<div class="subbar"><div class="mp-container subbar-in"><button class="back" data-back>← Mercado</button></div></div><div class="mp-container"><section><div class="grid">${cards}</div></section></div>`;
    this.shadowRoot.querySelector("[data-back]")?.addEventListener("click", () => this.goBack());
  }
  renderError(msg) {
    this.shadowRoot.innerHTML = this._fallback + `<div class="mp-container"><div class="state">No se pudo cargar la tienda (${esc(msg)}). <button class="mp-btn mp-btn--primary" data-retry>Reintentar</button></div></div>`;
    this.shadowRoot.querySelector("[data-retry]")?.addEventListener("click", () => this.load());
  }

  render(data, stale = false) {
    const { seller, products = [] } = data;
    const t = seller.theme || {};
    const layout = ["grid", "list", "featured"].includes(t.layout) ? t.layout : "grid";
    const initial = (seller.name || "?").trim()[0] || "?";
    this._seller = seller;

    this.shadowRoot.innerHTML = this._fallback + `
      <div style="--p:${esc(t.primaryColor || "#1b39c9")};--a:${esc(t.accentColor || "#ff5a3c")}">
        ${stale ? `<div class="banner">Sin conexión — mostrando datos guardados</div>` : ``}
        <div class="subbar"><div class="mp-container subbar-in">
          <button class="back" data-back>← Volver a Meriplaza</button>
          <button class="cartbtn" data-cart>🛒 Carrito <span class="cart-count" hidden>0</span></button>
        </div></div>

        <div class="hero"><div class="mp-container"><div class="hero-in">
          <div class="logo">${t.logoUrl ? `<img loading="lazy" src="${esc(t.logoUrl)}" alt="">` : esc(initial)}</div>
          <div>
            <span class="mp-badge kind" style="color:#fff">${kindLabel(seller.kind)}</span>
            <h1>${esc(seller.name)}</h1>
            ${t.tagline ? `<p class="tag">${esc(t.tagline)}</p>` : ``}
            <div class="socials">${socials(seller.socials)}</div>
          </div>
        </div></div></div>

        <div class="mp-container"><section>
          <div class="mp-section-head"><h2>Productos</h2><span class="mp-muted">${products.length} artículo(s)</span></div>
          <div class="${layout}">${products.length ? products.map((p) => this.productCard(p, seller)).join("") : `<p class="state">Esta tienda aún no tiene productos.</p>`}</div>
        </section></div>
      </div>`;

    this.shadowRoot.querySelector("[data-back]")?.addEventListener("click", () => this.goBack());
    this.shadowRoot.querySelector("[data-cart]")?.addEventListener("click", () => this.dispatchEvent(new CustomEvent("mp-open-cart", { bubbles: true, composed: true })));
    this.shadowRoot.querySelectorAll("[data-add]").forEach((b) => b.addEventListener("click", () => {
      const p = products.find((x) => x.id === b.dataset.add);
      if (p) { cart.add({ ...p, sellerId: seller.id, sellerName: seller.name, sellerHandle: seller.handle }); this.dispatchEvent(new CustomEvent("mp-open-cart", { bubbles: true, composed: true })); }
    }));
    this.updateCartCount();
  }

  productCard(p, seller) {
    const out = p.stock <= 0;
    const cur = p.currency || seller.currency;
    return `
      <article class="mp-card product">
        <div class="mp-thumb"><span>${iconFor(p.category)}</span>${(p.images && p.images[0]) ? `<img loading="lazy" decoding="async" src="${esc(p.images[0])}" alt="">` : ``}</div>
        <div class="body">
          <h3>${esc(p.title)}</h3>
          ${p.description ? `<p class="desc">${esc(p.description)}</p>` : ``}
          <div class="foot">
            <span class="mp-price">${esc(p.price)} ${esc(cur)}</span>
            <button class="add" data-add="${esc(p.id)}" ${out ? "disabled" : ""}>${out ? "Agotado" : "Agregar"}</button>
          </div>
        </div>
      </article>`;
  }

  goBack() { this.dispatchEvent(new CustomEvent("mp-back", { bubbles: true, composed: true })); }

  updateCartCount() {
    const el = this.shadowRoot.querySelector(".cart-count");
    if (!el) return;
    const n = cart.count(); el.hidden = n === 0; el.textContent = n;
  }
}

function socials(s = {}) {
  const out = [];
  if (s.instagram) out.push(`<a href="https://instagram.com/${esc(s.instagram)}">Instagram</a>`);
  if (s.whatsapp) out.push(`<a href="https://wa.me/${esc(s.whatsapp)}">WhatsApp</a>`);
  if (s.facebook) out.push(`<a href="https://facebook.com/${esc(s.facebook)}">Facebook</a>`);
  return out.join("");
}
function kindLabel(k) { return { supermarket: "Supermercado", store: "Tienda", independent: "Emprendedor" }[k] || "Tienda"; }

customElements.define("mp-storefront", MpStorefront);
