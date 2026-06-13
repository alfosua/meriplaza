// Shared client-side cart for Meriplaza. A single cart spans the whole
// marketplace; lines are grouped by store, because each order/checkout is
// per-seller (one order → one fiscal invoice). Persisted to localStorage so it
// survives reloads on flaky connections.

const KEY = "meriplaza:cart:v1";

class CartStore extends EventTarget {
  constructor() {
    super();
    this._items = this._load();
  }

  _load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
  }
  _save() {
    try { localStorage.setItem(KEY, JSON.stringify(this._items)); } catch {}
    this.dispatchEvent(new CustomEvent("change", { detail: { items: this._items, count: this.count() } }));
  }

  /** product needs: id, title, price, currency, sellerId, sellerName, sellerHandle. */
  add(product, qty = 1) {
    const found = this._items.find((i) => i.id === product.id);
    if (found) found.qty += qty;
    else this._items.push({
      id: product.id, title: product.title, price: product.price, currency: product.currency,
      sellerId: product.sellerId, sellerName: product.sellerName || "", sellerHandle: product.sellerHandle || "",
      qty,
    });
    this._save();
  }

  setQty(id, qty) {
    const it = this._items.find((i) => i.id === id);
    if (!it) return;
    it.qty = Math.max(0, qty | 0);
    if (it.qty === 0) this._items = this._items.filter((i) => i.id !== id);
    this._save();
  }

  remove(id) { this._items = this._items.filter((i) => i.id !== id); this._save(); }
  clear() { this._items = []; this._save(); }

  items() { return this._items.slice(); }
  count() { return this._items.reduce((n, i) => n + i.qty, 0); }

  /** Group lines by seller; returns [{ sellerId, sellerName, sellerHandle, currency, lines, subtotal }]. */
  groups() {
    const by = new Map();
    for (const i of this._items) {
      const g = by.get(i.sellerId) || { sellerId: i.sellerId, sellerName: i.sellerName, sellerHandle: i.sellerHandle, currency: i.currency, lines: [], subtotalCents: 0 };
      g.lines.push(i);
      g.subtotalCents += Math.round(parseFloat(i.price) * 100) * i.qty;
      by.set(i.sellerId, g);
    }
    return [...by.values()].map((g) => ({ ...g, subtotal: (g.subtotalCents / 100).toFixed(2) }));
  }
}

export const cart = new CartStore();
