// Order pricing with exact VAT, mirroring the Go catalog domain.PriceOrder and
// the fiscal tax math so an order's totals match the invoice it will produce.

import { Money, mulDecimal, percentOf } from "./money.ts";

export interface ProductLike {
  id: string;
  title: string;
  price: string;
  currency: string;
  taxRate: string; // e.g. "16.00" or "0.00"
  stock: number;
  active: boolean;
}

export interface CartItem { productId: string; quantity: number; }

export interface PricedLine {
  productId: string;
  title: string;
  quantity: number;
  unitPrice: string;
  taxRate: string;
}

export interface PricedOrder {
  currency: string;
  lines: PricedLine[];
  subtotal: string;
  taxTotal: string;
  grandTotal: string;
}

export function priceOrder(
  sellerCurrency: string,
  products: Map<string, ProductLike>,
  items: CartItem[],
): PricedOrder {
  if (items.length === 0) throw new Error("cart is empty");
  const cur = sellerCurrency || "VES";

  let subtotal = Money.zero(cur);
  let taxTotal = Money.zero(cur);
  const lines: PricedLine[] = [];

  for (const ci of items) {
    const p = products.get(ci.productId);
    if (!p) throw new Error(`unknown product ${ci.productId}`);
    if (!p.active) throw new Error(`product ${p.title} is not available`);
    if (ci.quantity <= 0 || !Number.isInteger(ci.quantity)) throw new Error(`quantity for ${p.title} must be a positive integer`);
    if (ci.quantity > p.stock) throw new Error(`insufficient stock for ${p.title} (have ${p.stock}, want ${ci.quantity})`);

    const unit = Money.parse(p.price, cur);
    const lineNet = mulDecimal(unit, String(ci.quantity), 2);
    const lineTax = percentOf(lineNet, p.taxRate, 2);
    subtotal = subtotal.add(lineNet);
    taxTotal = taxTotal.add(lineTax);

    lines.push({ productId: p.id, title: p.title, quantity: ci.quantity, unitPrice: unit.format(2), taxRate: p.taxRate });
  }

  const grand = subtotal.add(taxTotal);
  return {
    currency: cur,
    lines,
    subtotal: subtotal.format(2),
    taxTotal: taxTotal.format(2),
    grandTotal: grand.format(2),
  };
}
