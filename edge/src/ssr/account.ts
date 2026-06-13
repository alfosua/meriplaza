// Account, admin, and store-dashboard pages (server-rendered).
import { layout, esc } from "./pages.ts";

const money = (n: number) => n.toFixed(2);

// ---- customer / visitor account ----
export function accountPage(user: any, orders: any[]): string {
  if (!user) return loginPage();
  const body = `
  <div class="container" style="max-width:780px">
    <section>
      <div class="section-head"><h2>Mi cuenta</h2><button class="btn btn--ghost" data-logout>Cerrar sesión</button></div>
      <div class="card" style="padding:1.2rem">
        <div class="spread"><div>
          <div style="font-weight:700;font-size:1.1rem">${esc(user.name || "Cliente")}</div>
          <div class="muted">${esc(user.email)} · ${roleLabel(user.role)}</div>
        </div>
        ${user.role === "admin" ? `<a class="btn btn--primary" href="/admin">Portal admin</a>` : ""}
        ${user.role === "store" ? `<a class="btn btn--primary" href="/tienda/panel">Panel de tienda</a>` : ""}
        </div>
      </div>
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
  </div>`;
  return layout({ title: "Mi cuenta — Meriplaza", body });
}

function orderRow(o: any): string {
  return `<div class="spread" style="padding:.7rem 1rem;border-bottom:1px solid var(--line)">
    <div><div style="font-weight:600">Pedido ${esc(o.id.slice(-8))}</div>
      <div class="muted" style="font-size:.8rem">${o.lines.length} artículo(s) · ${esc(o.createdAt?.slice(0,10) || "")}</div></div>
    <div style="text-align:right"><div class="price">${esc(o.grandTotal)} ${esc(o.currency)}</div>
      <span class="badge ${o.status === "pending" ? "badge--out" : ""}" style="${o.status !== "pending" ? "background:var(--good);color:#fff" : ""}">${esc(statusLabel(o.status))}</span></div>
  </div>`;
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

// ---- admin portal ----
export function adminPage(user: any, data: { stores: any[]; products: any[]; orders: any[]; stats: any }): string {
  if (!user || user.role !== "admin") return forbidden("Necesitas una cuenta de administrador.");
  const s = data.stats;
  const body = `
  <div class="container">
    <section>
      <div class="section-head"><h2>Portal de administración</h2><button class="btn btn--ghost" data-logout>Salir</button></div>
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
  return layout({ title: "Admin — Meriplaza", body });
}

// ---- store dashboard ----
export function storeDashboardPage(user: any, data: { seller: any; products: any[]; offers: any[]; orders: any[]; allProducts: any[] }): string {
  if (!user || (user.role !== "store" && user.role !== "admin")) return forbidden("Necesitas una cuenta de tienda.");
  const sellerName = data.seller?.name || "Mi tienda";
  const salesPaid = data.orders.filter((o) => o.status !== "pending");
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
      <div class="section-head"><h2>Mis pedidos</h2></div>
      <div class="card">${data.orders.length ? data.orders.map(orderRow).join("") : `<p class="muted" style="padding:1rem">Aún no tienes pedidos.</p>`}</div>
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
function forbidden(msg: string): string {
  return layout({ title: "Acceso restringido — Meriplaza", body: `<div class="container" style="text-align:center;padding:4rem 1rem"><h1>Acceso restringido</h1><p class="muted">${esc(msg)}</p><a class="btn btn--primary" href="/cuenta">Iniciar sesión</a></div>` });
}
function roleLabel(r: string) { return { customer: "Cliente", store: "Tienda", admin: "Administrador" }[r] || r; }
function statusLabel(s: string) { return { pending: "Pendiente", paid: "Pagado", invoiced: "Facturado", fulfilled: "Entregado", canceled: "Cancelado" }[s] || s; }
function adminFormStyles() {
  return `<style>.adminform label{display:block;font-size:.85rem;color:var(--ink-2);margin-top:.5rem}.adminform input,.adminform select,.adminform textarea{width:100%;padding:.55rem .7rem;border:1px solid var(--line);border-radius:10px;font:inherit;margin-top:.25rem}.frow{display:flex;gap:1rem;flex-wrap:wrap}.frow>label{flex:1;min-width:160px}</style>`;
}
export { money };
