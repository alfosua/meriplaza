// QuickPago portal pages — its own light branding (teal) on the shared CSS.
import { esc } from "../ssr/pages.ts";

const QP_CSS = `
:root{--qp:#0aa17a;--qp-700:#077a5c}
.qp-head{position:sticky;top:0;z-index:30;background:#fff;border-bottom:1px solid var(--line)}
.qp-head .container{display:flex;align-items:center;justify-content:space-between;padding:.7rem 0}
.qp-logo{font-weight:900;font-size:1.25rem;letter-spacing:-.02em}.qp-logo b{color:var(--qp)}
.qp-hero{background:linear-gradient(180deg,#e9fbf4,#fff);border-bottom:1px solid var(--line)}
.qp-hero .container{padding:clamp(2.5rem,7vw,5rem) 0;text-align:center}
.qp-hero h1{font-size:clamp(2.2rem,6vw,3.6rem);margin:0 0 .6rem;letter-spacing:-.02em}
.qp-hero h1 b{color:var(--qp)}
.qp-hero p{font-size:1.15rem;color:var(--ink-2);max-width:48ch;margin:0 auto 1.4rem}
.qp-feats{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1rem;margin:2rem 0}
.qp-feat{border:1px solid var(--line);border-radius:var(--radius);padding:1.2rem;text-align:left}
.qp-feat .i{font-size:1.6rem}
.btn--qp{background:var(--qp);color:#fff}.btn--qp:hover{background:var(--qp-700)}
.qp-methods{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1rem}
.qp-card{border:1px solid var(--line);border-radius:var(--radius);padding:1.1rem}
.qp-card h3{margin:.2rem 0 .6rem;font-size:1rem}
.qp-card label{display:block;font-size:.82rem;color:var(--ink-2);margin-top:.5rem}
.qp-card input,.qp-card select{width:100%;padding:.55rem .7rem;border:1px solid var(--line);border-radius:10px;font:inherit;margin-top:.25rem}
`;

function shell(title: string, body: string): string {
  return `<!doctype html><html lang="es-VE"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<meta name="description" content="QuickPago — cobra con PagoMóvil, transferencia y cripto. Un producto de Meriplaza.">
<link rel="stylesheet" href="/assets/app.css"><style>${QP_CSS}</style></head><body>
<header class="qp-head"><div class="container"><a class="qp-logo" href="/quickpago">Quick<b>Pago</b></a>
<div class="row" style="gap:.5rem"><a class="btn btn--ghost" href="/">Meriplaza</a><a class="btn btn--qp" href="/quickpago/portal">Portal</a></div></div></header>
<main>${body}</main>
<footer class="site"><div class="container"><div class="muted" style="color:#9aa4b2">QuickPago · un producto de <a href="/">Meriplaza</a> · 2026</div></div></footer>
<script src="/assets/app.js" defer></script></body></html>`;
}

export function qpLanding(): string {
  const body = `
  <section class="qp-hero"><div class="container">
    <span class="badge" style="background:#d6f7ec;color:var(--qp-700)">Para comercios</span>
    <h1>Cobra en minutos con <b>QuickPago</b></h1>
    <p>Acepta PagoMóvil, transferencias nacionales y cripto. Comparte un cobro, recibe al instante y concilia todo en un solo panel.</p>
    <a class="btn btn--qp" href="/quickpago/portal" style="padding:.8rem 1.6rem;font-size:1.05rem">Registrar mi comercio</a>
  </div></section>
  <div class="container">
    <div class="qp-feats">
      <div class="qp-feat"><div class="i">📲</div><h3>PagoMóvil C2P</h3><p class="muted">Recibe pagos móviles con confirmación inmediata.</p></div>
      <div class="qp-feat"><div class="i">🏦</div><h3>Transferencia nacional</h3><p class="muted">Bancos del país, conciliación por referencia.</p></div>
      <div class="qp-feat"><div class="i">🪙</div><h3>Cripto</h3><p class="muted">USDT y más, en redes de bajo costo.</p></div>
      <div class="qp-feat"><div class="i">🔗</div><h3>Links y QR de cobro</h3><p class="muted">Comparte un cobro por WhatsApp en segundos.</p></div>
    </div>
    <section style="text-align:center;padding:2rem 0">
      <h2>Construido sobre la pasarela de Meriplaza</h2>
      <p class="muted" style="max-width:52ch;margin:.4rem auto 1.2rem">El mismo motor de pagos que impulsa Meriplaza, ahora disponible para tu comercio — dentro o fuera de Meriplaza.</p>
      <a class="btn btn--qp" href="/quickpago/portal">Empezar gratis</a>
    </section>
  </div>`;
  return shell("QuickPago — Cobros para comercios", body);
}

export function qpPortal(m: any, txns: any[]): string {
  if (!m) return qpAuth();
  const meth = m.methods || {};
  const body = `
  <div class="container">
    <section><div class="spread"><h2 style="margin:0">Panel · ${esc(m.business)}</h2><button class="btn btn--ghost" data-qp-logout>Salir</button></div>
      <p class="muted">${esc(m.email)}${m.rif ? " · " + esc(m.rif) : ""}</p></section>

    <section>
      <h2 style="font-size:1.1rem">Métodos de cobro</h2>
      <form id="qp-methods" class="qp-methods">
        <div class="qp-card"><h3>📲 PagoMóvil</h3>
          <label>Banco<input name="pm_bank" value="${esc(meth.pagomovil?.bank || "")}" placeholder="0102"></label>
          <label>Teléfono<input name="pm_phone" value="${esc(meth.pagomovil?.phone || "")}" placeholder="0414…"></label>
          <label>Cédula/RIF<input name="pm_ci" value="${esc(meth.pagomovil?.ci || "")}" placeholder="V-…"></label>
        </div>
        <div class="qp-card"><h3>🏦 Transferencia</h3>
          <label>Banco<input name="tr_bank" value="${esc(meth.transfer?.bank || "")}"></label>
          <label>Cuenta<input name="tr_account" value="${esc(meth.transfer?.account || "")}"></label>
          <label>Titular<input name="tr_holder" value="${esc(meth.transfer?.holder || "")}"></label>
        </div>
        <div class="qp-card"><h3>🪙 Cripto</h3>
          <label>Red<select name="cr_network"><option ${meth.crypto?.network === "TRON" ? "selected" : ""}>TRON</option><option ${meth.crypto?.network === "BSC" ? "selected" : ""}>BSC</option><option ${meth.crypto?.network === "ETH" ? "selected" : ""}>ETH</option></select></label>
          <label>Activo<input name="cr_asset" value="${esc(meth.crypto?.asset || "USDT")}"></label>
          <label>Dirección<input name="cr_address" value="${esc(meth.crypto?.address || "")}"></label>
        </div>
        <div style="grid-column:1/-1"><button class="btn btn--qp" type="submit">Guardar métodos</button></div>
      </form>
    </section>

    <section>
      <h2 style="font-size:1.1rem">Crear un cobro</h2>
      <form id="qp-charge" class="row" style="flex-wrap:wrap;gap:.75rem;align-items:flex-end">
        <label style="flex:1;min-width:120px">Monto<input name="amount" required style="width:100%;padding:.55rem .7rem;border:1px solid var(--line);border-radius:10px;margin-top:.25rem"></label>
        <label style="min-width:110px">Moneda<select name="currency" style="width:100%;padding:.55rem .7rem;border:1px solid var(--line);border-radius:10px;margin-top:.25rem"><option>VES</option><option>USD</option></select></label>
        <label style="min-width:150px">Método<select name="method" style="width:100%;padding:.55rem .7rem;border:1px solid var(--line);border-radius:10px;margin-top:.25rem"><option value="pagomovil">PagoMóvil</option><option value="transfer">Transferencia</option><option value="crypto">Cripto</option></select></label>
        <button class="btn btn--qp" type="submit">Generar cobro</button>
      </form>
    </section>

    <section>
      <h2 style="font-size:1.1rem">Transacciones</h2>
      <div class="card">${txns.length ? txns.map((t) => `<div class="spread" style="padding:.7rem 1rem;border-bottom:1px solid var(--line)">
        <div><b>${esc(t.reference)}</b><div class="muted" style="font-size:.8rem">${esc(t.method)} · ${esc(t.created_at?.slice(0,16) || "")}</div>
          <a class="link" href="/quickpago/c/${esc(t.reference)}" target="_blank" rel="noopener">Link de cobro</a>${payerText(t.payer)}
        </div>
        <div class="row" style="gap:.75rem;flex-wrap:wrap"><span class="price">${esc(t.amount)} ${esc(t.currency)}</span>
        ${qpStatusBadge(t.status)}${qpActions(t)}</div>
      </div>`).join("") : `<p class="muted" style="padding:1rem">Aún no tienes cobros.</p>`}</div>
    </section>
  </div>`;
  return shell(`Portal QuickPago · ${m.business}`, body);
}

export function qpChargePage(data: { tx: any; merchant: any; origin: string }): string {
  const tx = data.tx;
  const merchant = data.merchant;
  const methods = merchant.methods || {};
  const url = `${data.origin}/quickpago/c/${encodeURIComponent(tx.reference)}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}`;
  const instructions = methodInstructions(tx.method, methods);
  const canReport = tx.status === "pending";
  const body = `
  <div class="container" style="max-width:980px">
    <section class="qp-pay">
      <div>
        <span class="badge" style="background:#d6f7ec;color:var(--qp-700)">Cobro QuickPago</span> ${qpStatusBadge(tx.status)}
        <h1 style="font-size:clamp(2rem,6vw,3.2rem);margin:.7rem 0 .4rem">Pagar ${esc(tx.amount)} ${esc(tx.currency)}</h1>
        <p class="muted">A ${esc(merchant.business)}${merchant.rif ? " · " + esc(merchant.rif) : ""}</p>
        <div class="qp-ref">${esc(tx.reference)}</div>
        <div class="row" style="flex-wrap:wrap;margin-top:1rem">
          <a class="btn btn--qp" href="https://wa.me/?text=${encodeURIComponent(`Pago QuickPago ${tx.reference}: ${url}`)}">Compartir por WhatsApp</a>
          <button class="btn btn--ghost" data-copy="${esc(url)}">Copiar link</button>
        </div>
      </div>
      <div class="qp-qr card">
        <img src="${qrUrl}" alt="QR de pago ${esc(tx.reference)}" width="220" height="220">
        <small class="muted">Escanea para abrir este cobro</small>
      </div>
    </section>

    <section class="qp-pay-grid">
      <article class="qp-card">
        <h2>Instrucciones de pago</h2>
        ${instructions}
      </article>
      ${canReport ? `<form id="qp-pay-proof" class="qp-card" data-ref="${esc(tx.reference)}">
        <h2>Reportar pago</h2>
        <label>Nombre del pagador<input name="payerName" required placeholder="Nombre y apellido"></label>
        <label>Teléfono o correo<input name="payerContact" placeholder="0414..."></label>
        <label>Referencia / hash<input name="proof" required placeholder="Referencia bancaria o transacción"></label>
        <button class="btn btn--qp btn--block" style="margin-top:.8rem" type="submit">Enviar comprobante</button>
        <p class="muted" data-err></p>
      </form>` : qpClosedCard(tx.status)}
    </section>
  </div>
  <style>
    .qp-pay{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:1.5rem;align-items:center;padding:2rem 0}
    .qp-ref{display:inline-flex;margin-top:.6rem;padding:.45rem .75rem;border-radius:12px;background:#eef3ff;color:var(--ink);font-weight:900;letter-spacing:.08em}
    .qp-qr{align-items:center;text-align:center;padding:1.2rem;content-visibility:visible}.qp-qr:hover{transform:none;box-shadow:none}
    .qp-qr img{margin:auto;border-radius:14px}
    .qp-pay-grid{display:grid;grid-template-columns:1fr 1fr;gap:1rem;padding-top:0}
    .qp-pay-grid h2{font-size:1.1rem;margin:.2rem 0 .7rem}
    .payline{display:flex;justify-content:space-between;gap:1rem;border-top:1px solid var(--line);padding:.65rem 0}.payline b{text-align:right}
    @media(max-width:760px){.qp-pay,.qp-pay-grid{grid-template-columns:1fr}.qp-qr{order:-1}}
  </style>`;
  return shell(`Pagar ${tx.reference} · QuickPago`, body);
}

function qpActions(t: any): string {
  if (t.status !== "pending" && t.status !== "proof_submitted") return "";
  return `<button class="btn btn--ghost" data-qp-confirm="${esc(t.id)}">Confirmar</button>
    <button class="btn btn--ghost" data-qp-cancel="${esc(t.id)}">Cancelar</button>
    <button class="btn btn--ghost" data-qp-expire="${esc(t.id)}">Expirar</button>`;
}

function qpClosedCard(status: string): string {
  const copy: Record<string, string> = {
    proof_submitted: "Comprobante enviado. El comercio revisará y confirmará el pago.",
    confirmed: "Pago confirmado por el comercio.",
    canceled: "Este cobro fue cancelado por el comercio.",
    expired: "Este cobro expiró. Solicita un nuevo link al comercio.",
  };
  return `<article class="qp-card"><h2>Estado del cobro</h2><p class="muted">${esc(copy[status] || "Este cobro no está disponible para reportar pagos.")}</p></article>`;
}

function qpStatusBadge(status: string): string {
  const labels: Record<string, string> = {
    pending: "Pendiente",
    proof_submitted: "Comprobante enviado",
    confirmed: "Confirmado",
    canceled: "Cancelado",
    expired: "Expirado",
  };
  const colors: Record<string, string> = {
    pending: "background:#eef3ff;color:#3152a3",
    proof_submitted: "background:#fff4d7;color:#8a5a00",
    confirmed: "background:var(--good);color:#fff",
    canceled: "background:#ffe1db;color:#a83218",
    expired: "background:#eceff3;color:#516072",
  };
  return `<span class="badge" style="${colors[status] || colors.pending}">${esc(labels[status] || status || "Pendiente")}</span>`;
}

function methodInstructions(method: string, methods: any): string {
  if (method === "pagomovil") {
    const m = methods.pagomovil || {};
    return `<div class="payline"><span>Banco</span><b>${esc(m.bank || "Configurar")}</b></div>
      <div class="payline"><span>Teléfono</span><b>${esc(m.phone || "Configurar")}</b></div>
      <div class="payline"><span>CI/RIF</span><b>${esc(m.ci || "Configurar")}</b></div>
      <p class="muted">Usa la referencia del banco para reportar el pago.</p>`;
  }
  if (method === "crypto") {
    const m = methods.crypto || {};
    return `<div class="payline"><span>Red</span><b>${esc(m.network || "TRON")}</b></div>
      <div class="payline"><span>Activo</span><b>${esc(m.asset || "USDT")}</b></div>
      <div class="payline"><span>Dirección</span><b style="word-break:break-all">${esc(m.address || "Configurar")}</b></div>
      <p class="muted">Reporta el hash de la transacción al terminar.</p>`;
  }
  const m = methods.transfer || {};
  return `<div class="payline"><span>Banco</span><b>${esc(m.bank || "Configurar")}</b></div>
    <div class="payline"><span>Cuenta</span><b>${esc(m.account || "Configurar")}</b></div>
    <div class="payline"><span>Titular</span><b>${esc(m.holder || "Configurar")}</b></div>
    <p class="muted">Reporta la referencia bancaria al terminar.</p>`;
}

function payerText(raw: string): string {
  if (!raw) return "";
  try {
    const p = JSON.parse(raw);
    if (!p.proof) return "";
    return `<div class="muted" style="font-size:.78rem">Comprobante: ${esc(p.proof)}${p.name ? " · " + esc(p.name) : ""}</div>`;
  } catch {
    return `<div class="muted" style="font-size:.78rem">Pagador: ${esc(raw)}</div>`;
  }
}

function qpAuth(): string {
  const body = `
  <div class="container" style="max-width:440px">
    <section><div class="qp-card">
      <div class="row" style="gap:0;margin-bottom:1rem;border:1px solid var(--line);border-radius:var(--pill);overflow:hidden">
        <button class="tab btn" data-qptab="login" style="flex:1;border-radius:0;background:var(--qp);color:#fff">Entrar</button>
        <button class="tab btn btn--ghost" data-qptab="register" style="flex:1;border-radius:0;border:0">Registrar comercio</button>
      </div>
      <form id="qp-login" class="qp-pane">
        <h2 style="margin:.2rem 0 .6rem">Portal QuickPago</h2>
        <label>Correo<input name="email" type="email" required></label>
        <label>Contraseña<input name="password" type="password" required></label>
        <button class="btn btn--qp btn--block" style="margin-top:.8rem" type="submit">Entrar</button>
        <p data-err style="color:#e3431f;margin:.6rem 0 0;font-size:.85rem"></p>
      </form>
      <form id="qp-register" class="qp-pane" hidden>
        <h2 style="margin:.2rem 0 .6rem">Registra tu comercio</h2>
        <label>Nombre del comercio<input name="business" required></label>
        <label>RIF<input name="rif" placeholder="J-…"></label>
        <label>Correo<input name="email" type="email" required></label>
        <label>Contraseña (6+)<input name="password" type="password" required></label>
        <button class="btn btn--qp btn--block" style="margin-top:.8rem" type="submit">Crear comercio</button>
        <p data-err style="color:#e3431f;margin:.6rem 0 0;font-size:.85rem"></p>
      </form>
    </div></section>
  </div>
  <style>.qp-pane label{display:block;margin-top:.6rem;font-size:.85rem;color:var(--ink-2)}.qp-pane input{width:100%;padding:.6rem .75rem;border:1px solid var(--line);border-radius:10px;margin-top:.25rem}</style>`;
  return shell("Portal QuickPago", body);
}
