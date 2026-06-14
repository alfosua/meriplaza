// Account and merchant back-office pages (server-rendered).
import { layout, esc } from "./pages.ts";

const money = (n: number) => n.toFixed(2);

// ---- customer / visitor account ----
export function accountPage(user: any, orders: any[], profile: any = { addresses: [], fiscalProfiles: [] }): string {
  if (!user) return loginPage();
  const addr = (profile.addresses || []).find((a: any) => a.isDefault) || profile.addresses?.[0] || {};
  const fiscal = (profile.fiscalProfiles || []).find((f: any) => f.isDefault) || profile.fiscalProfiles?.[0] || {};
  const body = `
  <div class="container" style="max-width:780px">
    <section>
      <div class="section-head"><h2>Mi cuenta</h2><button class="btn btn--ghost" data-logout>Cerrar sesión</button></div>
      <div class="card" style="padding:1.2rem">
        <div class="spread"><div>
          <div style="font-weight:700;font-size:1.1rem">${esc(user.name || "Cliente")}</div>
          <div class="muted">${esc(user.email)} · ${roleLabel(user.role)}</div>
        </div>
        ${user.role === "admin" ? `<a class="btn btn--primary" href="/comercios/portal">Portal de comercios</a>` : ""}
        ${user.role === "store" ? `<a class="btn btn--primary" href="/tienda/panel">Panel de tienda</a>` : ""}
        </div>
      </div>
    </section>

    <section>
      <div class="section-head"><h2>Dirección y factura</h2></div>
      <form id="profile-form" class="card adminform" style="padding:1.2rem">
        <h3 style="margin:.1rem 0 .4rem">Entrega predeterminada</h3>
        <div class="frow">
          <label>Etiqueta<input name="addrLabel" value="${esc(addr.label || "Casa")}"></label>
          <label>Recibe<input name="addrRecipient" value="${esc(addr.recipient || user.name || "")}"></label>
          <label>Teléfono<input name="addrPhone" value="${esc(addr.phone || "")}"></label>
        </div>
        <div class="frow">
          <label>Ciudad<input name="addrCity" value="${esc(addr.city || "Caracas")}"></label>
          <label>Notas<input name="addrNotes" value="${esc(addr.notes || "")}" placeholder="Horario, referencia"></label>
        </div>
        <label>Dirección<textarea name="addrAddress1" rows="2">${esc(addr.address1 || "")}</textarea></label>

        <h3 style="margin:1.1rem 0 .4rem">Perfil fiscal predeterminado</h3>
        <div class="frow">
          <label>Etiqueta<input name="fiscalLabel" value="${esc(fiscal.label || "Personal")}"></label>
          <label>Nombre/Razón social<input name="fiscalName" value="${esc(fiscal.name || user.name || "")}"></label>
        </div>
        <div class="frow">
          <label>RIF/CI<input name="fiscalTaxId" value="${esc(fiscal.taxId || "")}" placeholder="V-12345678 o J-12345678-9"></label>
          <label>Correo factura<input name="fiscalEmail" type="email" value="${esc(fiscal.email || user.email || "")}"></label>
        </div>
        <label>Dirección fiscal<textarea name="fiscalAddress" rows="2">${esc(fiscal.fiscalAddress || addr.address1 || "")}</textarea></label>
        <button class="btn btn--primary" style="margin-top:.8rem" type="submit">Guardar datos</button>
        <p class="muted" data-err style="margin:.6rem 0 0"></p>
      </form>
    </section>

    <section>
      <div class="section-head"><h2>Mis pedidos</h2></div>
      ${orders.length ? `<div class="card">${orders.map(orderRow).join("")}</div>` : `<p class="muted">Aún no tienes pedidos. <a class="link" href="/">Explorar productos</a></p>`}
    </section>

    <section>
      <div class="section-head"><h2>Métodos de pago</h2></div>
      <div class="card" style="padding:1.2rem">
        <p class="muted" style="margin:.2rem 0 .8rem">Paga al confirmar tu pedido. Métodos disponibles en Meriplaza:</p>
        <div class="row" style="flex-wrap:wrap;gap:.5rem">
          ${["Pago móvil","Transferencia","Divisas","Punto de venta","Tarjeta internacional","Cripto"].map((m) => `<span class="badge" style="background:var(--brand-050);color:var(--brand)">${m}</span>`).join("")}
        </div>
      </div>
    </section>
  </div>
  ${adminFormStyles()}`;
  return layout({ title: "Mi cuenta — Meriplaza", body });
}

function orderRow(o: any): string {
  const ship = o.shipment || {};
  const merchant = o.merchant || o.invoice?.merchant || {};
  const payment = o.payment || {};
  return `<a class="account-order" href="/pedido/${esc(o.id)}">
    <div>
      <div class="account-order__title">Pedido ${esc(o.id.slice(-8))}</div>
      <div class="muted" style="font-size:.8rem">${esc(o.lines?.length || 0)} artículo(s) · ${esc(o.createdAt?.slice(0,10) || "")}${merchant.name ? " · " + esc(merchant.name) : ""}</div>
      <div class="account-order__meta">
        <span>Pago: ${esc(paymentLabel(payment.status || o.status))}</span>
        <span>Factura: ${esc(o.invoiceId || "Pendiente")}</span>
        <span>IVA: ${esc(o.taxTotal || "0.00")} ${esc(o.currency)}</span>
        <span>Entrega: ${esc(shipmentLabel(ship.status || "pending"))}</span>
      </div>
    </div>
    <div class="account-order__total">
      <div class="price">${esc(o.grandTotal)} ${esc(o.currency)}</div>
      <span class="badge ${o.status === "pending" ? "badge--out" : ""}" style="${o.status !== "pending" ? "background:var(--good);color:#fff" : ""}">${esc(statusLabel(o.status))}</span>
      <small>Ver recibo</small>
    </div>
  </a>`;
}

function loginPage(): string {
  const body = `
  <div class="container" style="max-width:440px">
    <section>
      <div class="card" style="padding:1.5rem">
        <div class="row" style="gap:0;margin-bottom:1.2rem;border:1px solid var(--line);border-radius:var(--pill);overflow:hidden">
          <button class="tab btn" data-tab="login" style="flex:1;border-radius:0;background:var(--brand);color:#fff">Iniciar sesión</button>
          <button class="tab btn btn--ghost" data-tab="register" style="flex:1;border-radius:0;border:0">Crear cuenta</button>
        </div>

        <form id="login-form" class="auth-pane">
          <h2 style="margin:.2rem 0 .8rem">Bienvenido de nuevo</h2>
          <label>Correo<input name="email" type="email" required></label>
          <label>Contraseña<input name="password" type="password" required></label>
          <button class="btn btn--primary btn--block" style="margin-top:.8rem" type="submit">Entrar</button>
          <p class="err muted" data-err style="color:var(--accent);margin:.6rem 0 0"></p>
        </form>

        <form id="register-form" class="auth-pane" hidden>
          <h2 style="margin:.2rem 0 .8rem">Crear cuenta</h2>
          <label>Nombre<input name="name"></label>
          <label>Correo<input name="email" type="email" required></label>
          <label>Contraseña (6+)<input name="password" type="password" required></label>
          <label style="display:flex;align-items:center;gap:.5rem;margin-top:.6rem"><input type="checkbox" name="isStore" style="width:auto"> Quiero registrar una tienda</label>
          <div data-store-fields hidden>
            <label>Nombre de la tienda<input name="storeName"></label>
            <label>Moneda
              <select name="currency"><option>VES</option><option>USD</option></select>
            </label>
          </div>
          <button class="btn btn--accent btn--block" style="margin-top:.8rem" type="submit">Crear cuenta</button>
          <p class="err muted" data-err style="color:var(--accent);margin:.6rem 0 0"></p>
        </form>
      </div>
    </section>
  </div>
  <style>.auth-pane label{display:block;margin-top:.6rem;font-size:.85rem;color:var(--ink-2)}.auth-pane input,.auth-pane select{width:100%;padding:.6rem .75rem;border:1px solid var(--line);border-radius:10px;font:inherit;margin-top:.25rem}</style>`;
  return layout({ title: "Iniciar sesión — Meriplaza", body });
}

// ---- merchant/operator portal ----
export function adminPage(user: any, data: { stores: any[]; products: any[]; orders: any[]; stats: any }): string {
  if (!user || user.role !== "admin") return forbidden("Necesitas una cuenta operadora de comercios.");
  const s = data.stats;
  const body = `
  <div class="container">
    <section>
      <div class="section-head"><h2>Portal de comercios</h2><button class="btn btn--ghost" data-logout>Salir</button></div>
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">
        ${statCard("Tiendas", s.stores)}${statCard("Productos", s.products)}${statCard("Ofertas", s.offers)}
        ${statCard("Pedidos", s.orders)}${statCard("Ventas", s.salesText)}
      </div>
    </section>

    <section>
      <div class="section-head"><h2>Pedidos recientes</h2></div>
      <div class="card">${data.orders.length ? data.orders.map(orderRow).join("") : `<p class="muted" style="padding:1rem">Sin pedidos.</p>`}</div>
    </section>

    <section>
      <div class="section-head"><h2>Agregar producto</h2></div>
      <form id="admin-new-product" class="card adminform" style="padding:1.2rem">
        <div class="frow">
          <label>Título<input name="title" required></label>
          <label>Marca<input name="brand"></label>
        </div>
        <div class="frow">
          <label>Categoría<select name="category">${["Alimentos","Bebidas","Salud","Cuidado personal","Tecnología","Hogar","Artesanía","Accesorios","Moda","Mascotas"].map((c)=>`<option>${c}</option>`).join("")}</select></label>
          <label>URL de imagen<input name="image" placeholder="https://…"></label>
        </div>
        <label>Descripción<textarea name="description" rows="2"></textarea></label>
        <button class="btn btn--primary" style="margin-top:.6rem" type="submit">Crear producto</button>
      </form>
    </section>

    <section>
      <div class="section-head"><h2>Agregar oferta (tienda vende un producto)</h2></div>
      <form id="admin-new-offer" class="card adminform" style="padding:1.2rem">
        <div class="frow">
          <label>Producto<select name="productId" required>${data.products.map((p)=>`<option value="${esc(p.id)}">${esc(p.title)}</option>`).join("")}</select></label>
          <label>Tienda<select name="sellerId" required>${data.stores.map((s2)=>`<option value="${esc(s2.id)}">${esc(s2.name)}</option>`).join("")}</select></label>
        </div>
        <div class="frow">
          <label>Precio<input name="price" required></label>
          <label>Moneda<select name="currency"><option>VES</option><option>USD</option></select></label>
          <label>Stock<input name="stock" type="number" value="10"></label>
        </div>
        <button class="btn btn--accent" style="margin-top:.6rem" type="submit">Publicar oferta</button>
      </form>
    </section>
  </div>
  ${adminFormStyles()}`;
  return layout({ title: "Portal de comercios — Meriplaza", body, canonical: "https://salesfactory-edge.alfosuag.workers.dev/comercios/portal" });
}

// ---- store dashboard ----
export function storeDashboardPage(user: any, data: { seller: any; products: any[]; offers: any[]; orders: any[]; allProducts: any[] }): string {
  if (!user || (user.role !== "store" && user.role !== "admin")) return forbidden("Necesitas una cuenta de tienda.");
  const sellerName = data.seller?.name || "Mi tienda";
  const salesPaid = data.orders.filter((o) => o.status !== "pending");
  const pm = data.seller?.paymentMethods || {};
  const body = `
  <div class="container">
    <section>
      <div class="section-head"><h2>Panel · ${esc(sellerName)}</h2>
        <div class="row"><a class="btn btn--ghost" href="/t/${esc(data.seller?.handle || "")}">Ver tienda</a><button class="btn btn--ghost" data-logout>Salir</button></div></div>
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">
        ${statCard("Productos en venta", data.offers.length)}${statCard("Pedidos", data.orders.length)}${statCard("Pagados", salesPaid.length)}
      </div>
    </section>

    <section>
      <div class="section-head"><h2>Métodos de pago para checkout</h2></div>
      <form id="seller-payment-methods" class="card adminform" style="padding:1.2rem" data-seller="${esc(data.seller?.id || "")}">
        <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1rem">
          <div>
            <h3 style="margin:.1rem 0 .4rem">Pago móvil</h3>
            <label>Banco<input name="pm_bank" value="${esc(pm.pago_movil?.bank || "")}" placeholder="0102"></label>
            <label>Teléfono<input name="pm_phone" value="${esc(pm.pago_movil?.phone || "")}" placeholder="0414..."></label>
            <label>CI/RIF<input name="pm_ci" value="${esc(pm.pago_movil?.ci || "")}" placeholder="J-..."></label>
          </div>
          <div>
            <h3 style="margin:.1rem 0 .4rem">Transferencia</h3>
            <label>Banco<input name="tr_bank" value="${esc(pm.transferencia?.bank || "")}"></label>
            <label>Cuenta<input name="tr_account" value="${esc(pm.transferencia?.account || "")}"></label>
            <label>Titular<input name="tr_holder" value="${esc(pm.transferencia?.holder || "")}"></label>
          </div>
          <div>
            <h3 style="margin:.1rem 0 .4rem">Cripto</h3>
            <label>Red<input name="cr_network" value="${esc(pm.crypto?.network || "TRON")}"></label>
            <label>Activo<input name="cr_asset" value="${esc(pm.crypto?.asset || "USDT")}"></label>
            <label>Dirección<input name="cr_address" value="${esc(pm.crypto?.address || "")}"></label>
          </div>
        </div>
        <button class="btn btn--primary" style="margin-top:.8rem" type="submit">Guardar métodos</button>
        <p class="muted" data-err style="margin:.6rem 0 0"></p>
      </form>
    </section>

    <section>
      <div class="section-head"><h2>Mis pedidos</h2></div>
      <div class="fulfillment-list">${data.orders.length ? data.orders.map(fulfillmentRow).join("") : `<div class="card"><p class="muted" style="padding:1rem">Aún no tienes pedidos.</p></div>`}</div>
    </section>

    <section>
      <div class="section-head"><h2>Vender un producto del catálogo</h2></div>
      <form id="store-new-offer" class="card adminform" style="padding:1.2rem" data-seller="${esc(data.seller?.id || "")}">
        <div class="frow">
          <label>Producto<select name="productId" required>${data.allProducts.map((p)=>`<option value="${esc(p.id)}">${esc(p.title)}</option>`).join("")}</select></label>
          <label>Precio<input name="price" required></label>
        </div>
        <div class="frow">
          <label>Moneda<select name="currency"><option>${esc(data.seller?.currency || "VES")}</option><option>VES</option><option>USD</option></select></label>
          <label>Stock<input name="stock" type="number" value="10"></label>
        </div>
        <button class="btn btn--accent" style="margin-top:.6rem" type="submit">Publicar oferta</button>
      </form>
    </section>

    <section>
      <div class="section-head"><h2>Mis ofertas</h2></div>
      <div class="card">${data.offers.length ? data.offers.map((o)=>`<div class="spread" style="padding:.7rem 1rem;border-bottom:1px solid var(--line)"><span>${esc(o.title)}</span><span class="price">${esc(o.price)} ${esc(o.currency)} · ${o.stock} und.</span></div>`).join("") : `<p class="muted" style="padding:1rem">Aún no vendes productos.</p>`}</div>
    </section>
  </div>
  ${adminFormStyles()}`;
  return layout({ title: `Panel · ${sellerName} — Meriplaza`, body });
}

// ---- bits ----
function statCard(label: string, value: any): string {
  return `<div class="card" style="padding:1.1rem 1.2rem"><div style="font-size:1.7rem;font-weight:800">${esc(value)}</div><div class="muted">${esc(label)}</div></div>`;
}
function fulfillmentRow(o: any): string {
  const ship = o.shipment || {};
  const addr = o.shippingAddress || {};
  return `<article class="card fulfill-card">
    <div class="spread" style="align-items:flex-start">
      <div><b>Pedido ${esc(o.id.slice(-8))}</b><div class="muted" style="font-size:.8rem">${esc(o.createdAt?.slice(0,10) || "")} · ${esc(o.lines?.length || 0)} artículo(s)</div></div>
      <div style="text-align:right"><div class="price">${esc(o.grandTotal)} ${esc(o.currency)}</div><span class="badge" style="background:var(--blue-050);color:var(--blue)">${esc(statusLabel(o.status))}</span></div>
    </div>
    <div class="fulfill-details">
      <div><b>Cliente</b><span>${esc(o.buyerName || "Consumidor final")}</span><small>${esc(o.buyerTaxId || "Sin RIF/CI")}</small></div>
      <div><b>Entrega</b><span>${esc(addr.city || ship.city || "Ciudad no indicada")}</span><small>${esc(addr.address1 || "Sin dirección")}</small></div>
      <div><b>Factura</b><span>${esc(o.invoiceId || "Pendiente")}</span><small>IVA ${esc(o.taxTotal || "0.00")} ${esc(o.currency)}</small></div>
    </div>
    <form class="fulfill-form" data-order-fulfillment="${esc(o.id)}">
      <label>Estado
        <select name="status">${["pending","preparing","ready","shipped","delivered","canceled"].map((s)=>`<option value="${s}" ${ship.status === s ? "selected" : ""}>${shipmentLabel(s)}</option>`).join("")}</select>
      </label>
      <label>Transportista<input name="carrier" value="${esc(ship.carrier || ship.method || "")}" placeholder="Yummy, MRW, Zoom..."></label>
      <label>Tracking<input name="tracking" value="${esc(ship.tracking || "")}" placeholder="Guía o referencia"></label>
      <label>Notas<input name="notes" value="${esc(ship.notes || "")}" placeholder="Preparando, salió a ruta..."></label>
      <button class="btn btn--primary" type="submit">Actualizar</button>
      <span class="muted" data-err></span>
    </form>
  </article>`;
}
function forbidden(msg: string): string {
  return layout({ title: "Acceso restringido — Meriplaza", body: `<div class="container" style="text-align:center;padding:4rem 1rem"><h1>Acceso restringido</h1><p class="muted">${esc(msg)}</p><a class="btn btn--primary" href="/cuenta">Iniciar sesión</a></div>` });
}
function roleLabel(r: string) { return { customer: "Cliente", store: "Tienda", admin: "Operador" }[r] || r; }
function statusLabel(s: string) {
  return { pending: "Pendiente", pending_payment: "Pendiente de pago", payment_action_required: "Requiere acción de pago", payment_failed: "Pago fallido", paid: "Pagado", invoiced: "Facturado", fulfilled: "Entregado", canceled: "Cancelado" }[s] || s;
}
function paymentLabel(s: string) {
  return { succeeded: "Confirmado", requires_action: "Requiere acción", failed: "Fallido", pending_payment: "Pendiente", payment_action_required: "Requiere acción", payment_failed: "Fallido", invoiced: "Confirmado" }[s] || s || "Pendiente";
}
function shipmentLabel(s: string) {
  return { pending: "Pendiente", preparing: "Preparando", ready: "Listo para retirar", shipped: "En camino", delivered: "Entregado", canceled: "Cancelado" }[s] || s;
}
function adminFormStyles() {
  return `<style>.adminform label{display:block;font-size:.85rem;color:var(--ink-2);margin-top:.5rem}.adminform input,.adminform select,.adminform textarea{width:100%;padding:.55rem .7rem;border:1px solid var(--line);border-radius:10px;font:inherit;margin-top:.25rem}.frow{display:flex;gap:1rem;flex-wrap:wrap}.frow>label{flex:1;min-width:160px}.account-order{display:flex;justify-content:space-between;gap:1rem;padding:.9rem 1rem;border-bottom:1px solid var(--line);color:inherit}.account-order:hover{background:var(--bg-soft)}.account-order__title{font-weight:700}.account-order__meta{display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.45rem}.account-order__meta span{font-size:.74rem;color:var(--ink-2);background:var(--bg-soft);border-radius:var(--pill);padding:.22rem .5rem}.account-order__total{text-align:right;display:grid;gap:.25rem;justify-items:end}.account-order__total small{color:var(--blue);font-weight:700}.fulfillment-list{display:grid;gap:1rem}.fulfill-card{padding:1rem;content-visibility:visible;contain-intrinsic-size:auto}.fulfill-card:hover{transform:none;box-shadow:none}.fulfill-details{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:.75rem;margin:.9rem 0;padding:.8rem;border-radius:14px;background:var(--bg-soft)}.fulfill-details b,.fulfill-details span,.fulfill-details small{display:block}.fulfill-details b{font-size:.75rem;color:var(--ink-2);text-transform:uppercase;letter-spacing:.04em}.fulfill-details small{color:var(--ink-2);font-size:.78rem;margin-top:.12rem}.fulfill-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.7rem;align-items:end}.fulfill-form label{font-size:.8rem;color:var(--ink-2);font-weight:600}.fulfill-form input,.fulfill-form select{width:100%;padding:.55rem .7rem;border:1px solid var(--line);border-radius:10px;font:inherit;margin-top:.25rem}@media(max-width:640px){.account-order{display:grid}.account-order__total{text-align:left;justify-items:start}}</style>`;
}
export { money };
