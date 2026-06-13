// <mp-cart> — a slide-in cart drawer shared across Meriplaza. Subscribes to the
// shared cart store, groups items by store, and emits "mp-checkout" (per seller)
// when the shopper pays.
import { applyTheme, esc } from "./theme.js";
import { cart } from "./cart-store.js";

const COMPONENT_CSS = `
:host { position: fixed; inset: 0; z-index: 60; pointer-events: none; }
.scrim { position: absolute; inset: 0; background: rgba(10,12,20,.45); opacity: 0; transition: opacity .2s ease; }
.panel {
  position: absolute; top: 0; right: 0; height: 100%; width: min(420px, 92vw);
  background: var(--mp-surface); box-shadow: var(--mp-shadow-3);
  transform: translateX(100%); transition: transform .24s cubic-bezier(.2,.7,.2,1);
  display: flex; flex-direction: column;
}
:host([open]) { pointer-events: auto; }
:host([open]) .scrim { opacity: 1; }
:host([open]) .panel { transform: none; }
header { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.1rem; border-bottom: 1px solid var(--mp-line); }
header h2 { margin: 0; font-size: var(--mp-fs-lg); }
.x { background: none; border: 0; font-size: 1.5rem; line-height: 1; cursor: pointer; color: var(--mp-ink-2); }
.body { flex: 1; overflow-y: auto; padding: 1rem 1.1rem; -webkit-overflow-scrolling: touch; }
.empty { text-align: center; color: var(--mp-ink-2); padding: 3rem 1rem; }
.group { margin-bottom: 1.4rem; }
.group h3 { font-size: var(--mp-fs-sm); color: var(--mp-ink-2); margin: 0 0 .6rem; font-weight: 700; }
.line { display: grid; grid-template-columns: 1fr auto; gap: .25rem .75rem; align-items: center; padding: .55rem 0; border-bottom: 1px solid var(--mp-line); }
.line .t { font-size: var(--mp-fs-sm); font-weight: 600; }
.line .p { font-weight: 700; white-space: nowrap; }
.qty { display: inline-flex; align-items: center; gap: .1rem; border: 1px solid var(--mp-line); border-radius: var(--mp-radius-pill); }
.qty button { width: 28px; height: 28px; border: 0; background: none; font-size: 1.1rem; cursor: pointer; color: var(--mp-brand); }
.qty span { min-width: 1.4rem; text-align: center; font-weight: 700; font-size: var(--mp-fs-sm); }
.gsub { display: flex; justify-content: space-between; margin-top: .6rem; font-weight: 700; }
footer { padding: 1rem 1.1rem; border-top: 1px solid var(--mp-line); background: var(--mp-surface); }
.tot { display: flex; justify-content: space-between; font-size: var(--mp-fs-lg); font-weight: 800; margin-bottom: .75rem; }
.rm { background: none; border: 0; color: var(--mp-ink-2); font-size: var(--mp-fs-xs); cursor: pointer; grid-column: 1; justify-self: start; }
`;

class MpCart extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._fallback = applyTheme(this.shadowRoot, COMPONENT_CSS);
    this._onChange = () => this.render();
  }
  connectedCallback() {
    cart.addEventListener("change", this._onChange);
    this.render();
  }
  disconnectedCallback() { cart.removeEventListener("change", this._onChange); }

  open() { this.setAttribute("open", ""); }
  close() { this.removeAttribute("open"); }

  render() {
    const groups = cart.groups();
    const total = {};
    for (const g of groups) total[g.currency] = (total[g.currency] || 0) + parseFloat(g.subtotal);
    const totalStr = Object.entries(total).map(([c, v]) => `${v.toFixed(2)} ${c}`).join(" · ") || "0.00";

    this.shadowRoot.innerHTML = this._fallback + `
      <div class="scrim" data-close></div>
      <aside class="panel" role="dialog" aria-label="Carrito">
        <header><h2>Tu carrito</h2><button class="x" data-close aria-label="Cerrar">×</button></header>
        <div class="body">
          ${groups.length ? groups.map((g) => this.group(g)).join("") : `<div class="empty">Tu carrito está vacío.<br>Explora las tiendas y agrega productos.</div>`}
        </div>
        ${groups.length ? `<footer>
          <div class="tot"><span>Total</span><span>${esc(totalStr)}</span></div>
          <button class="mp-btn mp-btn--accent mp-btn--block" data-checkout>Pagar ahora</button>
        </footer>` : ``}
      </aside>`;

    this.shadowRoot.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", () => this.close()));
    this.shadowRoot.querySelectorAll("[data-inc]").forEach((b) => b.addEventListener("click", () => { const i = b.dataset.inc; cart.setQty(i, qtyOf(i) + 1); }));
    this.shadowRoot.querySelectorAll("[data-dec]").forEach((b) => b.addEventListener("click", () => { const i = b.dataset.dec; cart.setQty(i, qtyOf(i) - 1); }));
    this.shadowRoot.querySelectorAll("[data-rm]").forEach((b) => b.addEventListener("click", () => cart.remove(b.dataset.rm)));
    this.shadowRoot.querySelector("[data-checkout]")?.addEventListener("click", () => {
      this.dispatchEvent(new CustomEvent("mp-checkout", { bubbles: true, composed: true, detail: { groups: cart.groups() } }));
    });
  }

  group(g) {
    return `
      <div class="group">
        <h3>${esc(g.sellerName || "Tienda")}</h3>
        ${g.lines.map((l) => `
          <div class="line">
            <span class="t">${esc(l.title)}</span>
            <span class="p">${esc((parseFloat(l.price) * l.qty).toFixed(2))} ${esc(l.currency)}</span>
            <div class="qty">
              <button data-dec="${esc(l.id)}" aria-label="Quitar uno">−</button>
              <span>${l.qty}</span>
              <button data-inc="${esc(l.id)}" aria-label="Agregar uno">+</button>
            </div>
            <button class="rm" data-rm="${esc(l.id)}">Eliminar</button>
          </div>`).join("")}
        <div class="gsub"><span>Subtotal</span><span>${esc(g.subtotal)} ${esc(g.currency)}</span></div>
      </div>`;
  }
}

function qtyOf(id) { const it = cart.items().find((i) => i.id === id); return it ? it.qty : 0; }

customElements.define("mp-cart", MpCart);
