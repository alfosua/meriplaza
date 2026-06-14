# Product Research: Venezuela Commerce + Payments

Last updated: 2026-06-13

This note turns current market signals into implementation ideas for Meriplaza
and QuickPago. It is intentionally pragmatic: features here should improve
conversion, merchant adoption, or payment completion in Venezuela.

## Market Signals

- **Farmatodo sets the convenience benchmark.** Its app positions pharmacy,
  beauty, baby, personal care, food, and home delivery with short delivery
  windows. Meriplaza needs city-aware availability, fast re-order, and very
  clear delivery promises to compete.
- **Yummy Marketplace pushes zero-commission social commerce.** Its public
  positioning highlights no sales commission, delivery, biometric verification,
  and mobile-first selling. Meriplaza should make onboarding and trust visible,
  especially for independent sellers.
- **Mercado Libre anchors marketplace expectations.** Buyers expect search,
  price comparison, seller reputation, order status, and dispute confidence.
  Meriplaza can differentiate with Venezuelan rails: Pago Movil, Bs/USD/USDT,
  local delivery, and SENIAT-style invoice metadata.
- **Payment behavior is fragmented.** Pago Movil is essential for smaller Bs
  payments; national transfer references still matter; USD/Zelle-like behavior
  and USDT are common for dollarized purchases. Checkout should support payment
  proof, reference matching, and status transparency.
- **Pay-by-link and QR are table stakes for merchants.** QuickPago should treat
  a shareable cobro link as the core object, not a secondary transaction detail.

## Competitive Product Ideas

1. **Checkout status timeline**
   Add an order timeline after cart checkout: `Pedido creado`, `Pago reportado`,
   `Pago confirmado`, `Factura emitida`, `Preparando`, `En camino`, `Entregado`.
   This reduces support messages and makes manual payment rails feel reliable.

2. **Payment instructions per seller**
   Store seller payment rail configuration and render exact Pago Movil,
   transfer, Zelle-like, and USDT instructions during checkout. Today the
   checkout accepts method data, but the buyer should see merchant-specific
   instructions before submitting proof.

3. **Saved addresses + fiscal profiles**
   Let users save multiple delivery addresses and fiscal identities:
   `Consumidor final`, personal CI, company RIF. Default them into `/carrito`.
   This is high impact because Venezuelan buyers often purchase for family or
   businesses with different invoice data.

4. **Merchant fulfillment board**
   Rename all back-office language to merchant/operator language and add a
   dedicated fulfillment queue with filters by `payment_action_required`,
   `invoiced`, `preparing`, `shipped`, `delivered`. The current dashboard lists
   orders but does not manage shipment state.

5. **QuickPago link lifecycle**
   Expand QuickPago cobros from `pending/confirmed` to:
   `pending`, `proof_submitted`, `confirmed`, `expired`, `canceled`. Add
   expiration and a lightweight receipt page. This matches real merchant work:
   create link, buyer reports, merchant confirms, receipt shared.

6. **Trust and verification**
   Add visible seller trust badges: verified RIF, verified phone, invoice-ready,
   delivery cities, average response time. This borrows from marketplace trust
   patterns while staying local.

7. **Reorder and bundles**
   Farmacy/grocery flows benefit from one-tap reorder and family bundles:
   `Despensa semanal`, `Botiquin basico`, `Limpieza del hogar`, `Bebe`.
   These can be seeded as promotions first, then become real bundle SKUs.

8. **Low-connectivity mode**
   Keep SSR-first pages, but add compact product cards and a no-image mode
   toggle for slow connections. Venezuela connectivity constraints make this a
   real differentiator, not just a technical preference.

9. **Merchant acquisition landing**
   The `/vender` page should eventually include pricing, commission stance,
   onboarding checklist, expected documents, and examples of store pages. Yummy
   advertises 0% commission; Meriplaza needs an equally clear merchant promise.

10. **Operations reports**
    Add exports for merchant settlement, IVA totals, payment method mix, and
    city-level delivery performance. This helps merchants trust the platform and
    supports fiscal/accounting workflows.

## Suggested Next Engineering Slices

1. Persist user addresses and fiscal profiles in D1 and prefill `/carrito`.
2. Add order shipment status updates to the merchant portal.
3. Add QuickPago `proof_submitted`, `expired`, and `canceled` statuses.
4. Add seller payment-method configuration for Meriplaza checkout instructions.
5. Add a post-checkout order confirmation page with invoice and payment status.

## Sources Consulted

- Farmatodo app listing: delivery positioning and category breadth.
- Yummy Marketplace public site: zero-commission marketplace positioning,
  delivery, biometric verification, mobile-first selling.
- AppFigures Venezuela shopping rankings: Farmatodo, Yummy, SHEIN, Alibaba,
  Temu, Mercado Libre visible among top shopping apps.
- Lightspark Venezuela payment rails overview: Pago Movil as a widely used
  24/7 interbank payment method.
- Wise Venezuela payment methods overview: USD cash/Zelle-like behavior and
  Pago Movil for smaller local-currency payments.
- Ecwid Venezuela payment options: crypto/manual payment providers are common
  fallback choices for merchants.
