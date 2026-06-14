// Progressive-enhancement client script for the SSR app. Served at
// /assets/app.js. Pages render fully without it; this adds the cart, drawer,
// gallery, review submit, and small interactions. Kept tiny for slow links.
export const APP_JS = `
const API = location.origin;
const KEY = "meriplaza:cart:v1";
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const SellerPay = new Map();

const Cart = {
  items(){ try { return JSON.parse(localStorage.getItem(KEY))||[] } catch { return [] } },
  save(x){ localStorage.setItem(KEY, JSON.stringify(x)); paint(); },
  add(p){ const it=this.items(); const f=it.find(i=>i.offerId===p.offerId);
    if(f) f.qty++; else it.push({...p, qty:1}); this.save(it); },
  setQty(id,q){ let it=this.items(); const f=it.find(i=>i.offerId===id); if(!f)return;
    f.qty=Math.max(0,q); if(f.qty===0) it=it.filter(i=>i.offerId!==id); this.save(it); },
  remove(id){ this.save(this.items().filter(i=>i.offerId!==id)); },
  count(){ return this.items().reduce((n,i)=>n+i.qty,0); },
  groups(){ const m=new Map();
    for(const i of this.items()){ const g=m.get(i.sellerId)||{sellerId:i.sellerId,sellerName:i.sellerName,currency:i.currency,lines:[],cents:0};
      g.lines.push(i); g.cents+=Math.round(parseFloat(i.price)*100)*i.qty; m.set(i.sellerId,g); }
    return [...m.values()].map(g=>({...g,subtotal:(g.cents/100).toFixed(2)})); }
};

function toast(msg){ let t=$(".toast"); if(!t){ t=document.createElement("div"); t.className="toast"; document.body.appendChild(t); }
  t.textContent=msg; t.classList.add("show"); clearTimeout(t._h); t._h=setTimeout(()=>t.classList.remove("show"),1800); }

function paint(){ const n=Cart.count(); $$(".cart-count").forEach(e=>{ e.textContent=n; e.hidden=n===0; });
  const d=$("#drawer"); if(d && d.classList.contains("show")) renderDrawer();
  renderCartPage(); }

function ensureDrawer(){
  if($("#drawer")) return;
  const scrim=document.createElement("div"); scrim.className="scrim"; scrim.id="scrim";
  const d=document.createElement("aside"); d.className="drawer"; d.id="drawer"; d.setAttribute("role","dialog");
  document.body.append(scrim,d);
  scrim.addEventListener("click",closeCart);
}
function openCart(){ ensureDrawer(); renderDrawer(); $("#scrim").classList.add("show"); $("#drawer").classList.add("show"); }
function closeCart(){ $("#scrim")?.classList.remove("show"); $("#drawer")?.classList.remove("show"); }

function renderDrawer(){
  const groups=Cart.groups(); const totals={};
  groups.forEach(g=>totals[g.currency]=(totals[g.currency]||0)+parseFloat(g.subtotal));
  const totStr=Object.entries(totals).map(([c,v])=>v.toFixed(2)+" "+c).join(" · ")||"0.00";
  const d=$("#drawer");
  d.innerHTML='<header><h2 style="margin:0">Tu carrito</h2><button class="iconbtn" style="background:#eee;color:#333" id="x">✕</button></header>'+
   '<div class="body">'+(groups.length?groups.map(g=>
     '<div style="margin-bottom:1.2rem"><div class="muted" style="font-weight:700;margin-bottom:.4rem">'+esc(g.sellerName)+'</div>'+
     g.lines.map(l=>'<div class="cline"><span style="font-weight:600;font-size:.9rem">'+esc(l.title)+'</span>'+
       '<span style="font-weight:700;white-space:nowrap">'+(parseFloat(l.price)*l.qty).toFixed(2)+' '+esc(l.currency)+'</span>'+
       '<div class="qty"><button data-dec="'+l.offerId+'">−</button><span>'+l.qty+'</span><button data-inc="'+l.offerId+'">+</button></div>'+
       '<button data-rm="'+l.offerId+'" style="grid-column:1;justify-self:start;background:none;border:0;color:var(--ink-2);font-size:.72rem;cursor:pointer">Eliminar</button></div>').join('')+
     '<div class="spread" style="font-weight:700;margin-top:.5rem"><span>Subtotal</span><span>'+g.subtotal+' '+esc(g.currency)+'</span></div></div>'
   ).join('')
   :'<div style="text-align:center;color:var(--ink-2);padding:3rem 1rem">Tu carrito está vacío.</div>')+'</div>'+
   (groups.length?'<footer><div class="spread" style="font-size:1.15rem;font-weight:800;margin-bottom:.7rem"><span>Total</span><span>'+totStr+'</span></div>'+
     '<a class="btn btn--accent btn--block" href="/carrito">Ir a pagar</a></footer>':'');
  $("#x").onclick=closeCart;
  $$("[data-inc]",d).forEach(b=>b.onclick=()=>Cart.setQty(b.dataset.inc,qof(b.dataset.inc)+1));
  $$("[data-dec]",d).forEach(b=>b.onclick=()=>Cart.setQty(b.dataset.dec,qof(b.dataset.dec)-1));
  $$("[data-rm]",d).forEach(b=>b.onclick=()=>Cart.remove(b.dataset.rm));
}
function qof(id){ const i=Cart.items().find(x=>x.offerId===id); return i?i.qty:0; }

function renderCartPage(){
  const host=$("[data-cart-lines]"); if(!host) return;
  const groups=Cart.groups(), totals={};
  groups.forEach(g=>totals[g.currency]=(totals[g.currency]||0)+parseFloat(g.subtotal));
  const totalText=Object.entries(totals).map(([c,v])=>v.toFixed(2)+" "+c).join(" · ")||"0.00";
  const totalsEl=$("[data-cart-totals]"); if(totalsEl) totalsEl.textContent="Total: "+totalText;
  const submit=$("[data-checkout-submit]"); if(submit) submit.disabled=groups.length===0;
  if(!groups.length){ host.innerHTML='<div class="emptycart"><h2>Tu carrito está vacío</h2><p class="muted">Agrega productos del mercado para continuar.</p><a class="btn btn--primary" href="/">Explorar productos</a></div>'; return; }
  host.innerHTML=groups.map(g=>
    '<div class="checkout-store"><div class="spread"><div><b>'+esc(g.sellerName)+'</b><div class="muted">'+g.lines.length+' producto(s)</div></div><span class="price">'+g.subtotal+' '+esc(g.currency)+'</span></div>'+
    g.lines.map(l=>'<div class="cartline"><div><b>'+esc(l.title)+'</b><small>'+esc(l.price)+' '+esc(l.currency)+' c/u</small></div>'+
      '<div class="qty"><button type="button" data-dec="'+l.offerId+'">−</button><span>'+l.qty+'</span><button type="button" data-inc="'+l.offerId+'">+</button></div>'+
      '<strong>'+((parseFloat(l.price)||0)*l.qty).toFixed(2)+' '+esc(l.currency)+'</strong><button type="button" class="remove" data-rm="'+l.offerId+'">Eliminar</button></div>').join('')+
    '</div>').join('');
  $$("[data-inc]",host).forEach(b=>b.onclick=()=>Cart.setQty(b.dataset.inc,qof(b.dataset.inc)+1));
  $$("[data-dec]",host).forEach(b=>b.onclick=()=>Cart.setQty(b.dataset.dec,qof(b.dataset.dec)-1));
  $$("[data-rm]",host).forEach(b=>b.onclick=()=>Cart.remove(b.dataset.rm));
  renderPaymentInstructions();
}

async function renderPaymentInstructions(){
  const host=$("[data-payment-instructions]"); if(!host) return;
  const groups=Cart.groups(), method=$("#checkout-form")?.elements.paymentMethod?.value||"transferencia";
  if(!groups.length){ host.innerHTML=""; return; }
  const cards=[];
  for(const g of groups){
    if(!SellerPay.has(g.sellerId)){
      const r=await getJSON(API+"/catalog/sellers/by-id/"+encodeURIComponent(g.sellerId)+"/payment-methods");
      SellerPay.set(g.sellerId,r.ok?r.data:{seller:{name:g.sellerName},paymentMethods:{}});
    }
    const data=SellerPay.get(g.sellerId), m=data.paymentMethods||{}, s=data.seller?.name||g.sellerName;
    cards.push(payInstructionCard(s,method,m));
  }
  host.innerHTML=cards.join("");
}
function payInstructionCard(store,method,m){
  if(method==="pago_movil"){ const x=m.pago_movil||{}; return '<div class="payhint"><b>'+esc(store)+' · Pago móvil</b><span>Banco: '+esc(x.bank||"Por confirmar")+'</span><span>Teléfono: '+esc(x.phone||"Por confirmar")+'</span><span>CI/RIF: '+esc(x.ci||"Por confirmar")+'</span></div>'; }
  if(method==="crypto"){ const x=m.crypto||{}; return '<div class="payhint"><b>'+esc(store)+' · Cripto</b><span>'+(esc(x.asset||"USDT"))+' / '+esc(x.network||"TRON")+'</span><span>'+esc(x.address||"Dirección por confirmar")+'</span></div>'; }
  const x=m.transferencia||{}; return '<div class="payhint"><b>'+esc(store)+' · Transferencia</b><span>Banco: '+esc(x.bank||"Por confirmar")+'</span><span>Cuenta: '+esc(x.account||"Por confirmar")+'</span><span>Titular: '+esc(x.holder||"Por confirmar")+'</span></div>';
}

async function submitCheckout(f){
  if(!Cart.count()) return;
  const d=formData(f);
  const methodData={};
  if(d.paymentMethod==="transferencia") methodData.bankReference=d.bankReference||("WEB-"+Date.now());
  if(d.paymentMethod==="pago_movil") Object.assign(methodData,{payerPhone:d.payerPhone||"04140000000",payerBankCode:d.payerBankCode||"0102",payerId:d.buyerTaxId||"V-00000000",otp:d.otp||"123456"});
  if(d.paymentMethod==="divisas_cash") Object.assign(methodData,{cashCurrency:"USD",receiptRef:d.bankReference||("USD-"+Date.now()),fxRate:d.fxRate||"577.55"});
  if(d.paymentMethod==="punto_de_venta") methodData.approvalRef=d.bankReference||("POS-"+Date.now());
  if(d.paymentMethod==="crypto") methodData.networkTxn=d.bankReference||"0xcheckout";
  const msg=$("[data-checkout-msg]",f), btn=$("[data-checkout-submit]",f);
  if(msg) msg.textContent="Confirmando pago y generando factura...";
  if(btn) btn.disabled=true;
  try{
    const r=await postJSON(API+"/catalog/checkout",{
      channel:"web",
      buyer:{name:d.buyerName||"Consumidor final",taxId:d.buyerTaxId||"",email:d.buyerEmail||""},
      shippingAddress:{city:d.city||"Caracas",address1:d.address1||"",country:"VE"},
      shipment:{method:d.shipmentMethod||"delivery",notes:d.shipmentNotes||""},
      payment:{method:d.paymentMethod||"transferencia",methodData},
      items:Cart.items().map(l=>({offerId:l.offerId,quantity:l.qty}))
    });
    if(!r.ok) throw new Error(r.data.message||"checkout_failed");
    const ids=(r.data.orders||[]).map(o=>o.id).filter(Boolean);
    Cart.save([]);
    const paid=(r.data.orders||[]).filter(o=>o.status==="invoiced").length;
    if(msg) msg.innerHTML=paid?("Pago confirmado y factura generada para "+paid+" pedido(s)."):"Pedido creado. Revisa las instrucciones de pago.";
    toast(paid?"Pago confirmado y factura generada.":"Pedido creado.");
    if(ids.length) setTimeout(()=>location.href="/pedido/"+encodeURIComponent(ids[0])+"?ids="+encodeURIComponent(ids.join(",")),500);
  }catch(e){
    if(msg) msg.textContent="No se pudo completar el checkout: "+(e.message||"intenta de nuevo");
    toast("No se pudo completar el checkout.");
  }finally{ if(btn) btn.disabled=Cart.count()===0; }
}

function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

document.addEventListener("click",(e)=>{
  const add=e.target.closest("[data-add]");
  if(add){ e.preventDefault(); Cart.add({offerId:add.dataset.add,title:add.dataset.title,price:add.dataset.price,
    currency:add.dataset.currency,sellerId:add.dataset.seller,sellerName:add.dataset.sellerName}); openCart(); return; }
  if(e.target.closest("[data-open-cart]")){ e.preventDefault(); openCart(); }
});

// Product gallery thumbnails
document.addEventListener("click",(e)=>{
  const t=e.target.closest(".thumbs button"); if(!t) return;
  const main=$(".gallery .main"); if(main && t.dataset.img){ main.innerHTML='<img src="'+t.dataset.img+'" alt="">';
    $$(".thumbs button").forEach(b=>b.classList.remove("active")); t.classList.add("active"); }
});

// Review form
document.addEventListener("submit",async (e)=>{
  const f=e.target.closest("#review-form"); if(!f) return; e.preventDefault();
  const fd=new FormData(f);
  await fetch(API+"/catalog/products/"+f.dataset.slug+"/reviews",{method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({author:fd.get("author"),rating:Number(fd.get("rating")),title:fd.get("title"),body:fd.get("body")})});
  toast("¡Gracias por tu reseña!"); setTimeout(()=>location.reload(),900);
});

// --- auth + management forms ---
function formData(f){ const o={}; new FormData(f).forEach((v,k)=>o[k]=v); return o; }
async function postJSON(url, body){ const r=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},credentials:"include",body:JSON.stringify(body)});
  const t=await r.text().catch(()=>""); let j={}; try{j=JSON.parse(t)}catch{} return {ok:r.ok,status:r.status,data:j}; }
async function getJSON(url){ const r=await fetch(url,{credentials:"include"}); const t=await r.text().catch(()=>""); let j={}; try{j=JSON.parse(t)}catch{} return {ok:r.ok,status:r.status,data:j}; }

async function prefillCheckoutProfile(){
  const f=$("#checkout-form"); if(!f) return;
  const r=await getJSON(API+"/auth/profile"); if(!r.ok||!r.data.profile) return;
  const p=r.data.profile, a=(p.addresses||[]).find(x=>x.isDefault)||(p.addresses||[])[0]||{}, fp=(p.fiscalProfiles||[]).find(x=>x.isDefault)||(p.fiscalProfiles||[])[0]||{};
  const set=(name,val)=>{ const el=f.elements[name]; if(el && !el.value && val) el.value=val; };
  set("buyerName",fp.name||a.recipient);
  set("buyerTaxId",fp.taxId);
  set("buyerEmail",fp.email);
  set("city",a.city);
  set("address1",a.address1);
  set("shipmentNotes",a.notes);
}

// Login / register tab switch
document.addEventListener("click",(e)=>{
  const tab=e.target.closest(".tab"); if(!tab) return;
  const which=tab.dataset.tab;
  $$(".tab").forEach(t=>{ const on=t.dataset.tab===which; t.className="tab btn"+(on?"":" btn--ghost"); t.style.background=on?"var(--brand)":""; t.style.color=on?"#fff":""; });
  const lf=$("#login-form"), rf=$("#register-form"); if(lf&&rf){ lf.hidden=which!=="login"; rf.hidden=which!=="register"; }
});
document.addEventListener("change",(e)=>{ if(e.target.name==="isStore"){ const sf=$("[data-store-fields]"); if(sf) sf.hidden=!e.target.checked; }});
document.addEventListener("change",(e)=>{ if(e.target.name==="paymentMethod") renderPaymentInstructions(); });

document.addEventListener("submit", async (e)=>{
  const f=e.target;
  if(f.id==="login-form"){ e.preventDefault(); const r=await postJSON(API+"/auth/login",formData(f));
    if(r.ok) location.href="/cuenta"; else { const el=f.querySelector("[data-err]"); if(el) el.textContent=r.data.message||"No se pudo iniciar sesión"; } return; }
  if(f.id==="register-form"){ e.preventDefault(); const d=formData(f); d.role=d.isStore?"store":"customer";
    const r=await postJSON(API+"/auth/register",d); if(r.ok) location.href="/cuenta"; else { const el=f.querySelector("[data-err]"); if(el) el.textContent=r.data.message||"No se pudo crear la cuenta"; } return; }
  if(f.id==="admin-new-product"){ e.preventDefault(); const d=formData(f); const body={title:d.title,brand:d.brand,category:d.category,description:d.description,images:d.image?[d.image]:[]};
    const r=await postJSON(API+"/catalog/products",body); toast(r.ok?"Producto creado":"Error: "+(r.data.message||r.status)); if(r.ok) setTimeout(()=>location.reload(),900); return; }
  if(f.id==="admin-new-offer"||f.id==="store-new-offer"){ e.preventDefault(); const d=formData(f);
    const body={productId:d.productId,sellerId:d.sellerId||f.dataset.seller,price:d.price,currency:d.currency,stock:Number(d.stock||0)};
    const r=await postJSON(API+"/catalog/offers",body); toast(r.ok?"Oferta publicada":"Error: "+(r.data.message||r.status)); if(r.ok) setTimeout(()=>location.reload(),900); return; }
  if(f.id==="checkout-form"){ e.preventDefault(); await submitCheckout(f); return; }
  if(f.id==="profile-form"){ e.preventDefault(); const d=formData(f);
    const body={addresses:[{id:"default",label:d.addrLabel,recipient:d.addrRecipient,phone:d.addrPhone,city:d.addrCity,address1:d.addrAddress1,notes:d.addrNotes,isDefault:true}],
      fiscalProfiles:[{id:"default",label:d.fiscalLabel,name:d.fiscalName,taxId:d.fiscalTaxId,email:d.fiscalEmail,fiscalAddress:d.fiscalAddress,isDefault:true}]};
    const r=await postJSON(API+"/auth/profile",body); const el=f.querySelector("[data-err]");
    if(el) el.textContent=r.ok?"Datos guardados. Se usarán en tu próximo checkout.":(r.data.message||"No se pudo guardar");
    toast(r.ok?"Datos guardados":"No se pudo guardar"); return; }
  if(f.dataset.orderFulfillment){ e.preventDefault(); const r=await postJSON(API+"/catalog/orders/"+encodeURIComponent(f.dataset.orderFulfillment)+"/fulfillment",formData(f));
    const el=f.querySelector("[data-err]"); if(el) el.textContent=r.ok?"Actualizado":(r.data.message||"Error");
    toast(r.ok?"Pedido actualizado":"No se pudo actualizar"); if(r.ok) setTimeout(()=>location.reload(),700); return; }
  if(f.id==="seller-payment-methods"){ e.preventDefault(); const d=formData(f);
    const body={pago_movil:{bank:d.pm_bank,phone:d.pm_phone,ci:d.pm_ci},transferencia:{bank:d.tr_bank,account:d.tr_account,holder:d.tr_holder},crypto:{network:d.cr_network,asset:d.cr_asset,address:d.cr_address}};
    const r=await postJSON(API+"/catalog/sellers/"+encodeURIComponent(f.dataset.seller)+"/payment-methods",body); const el=f.querySelector("[data-err]");
    if(el) el.textContent=r.ok?"Métodos guardados. Tus compradores verán estas instrucciones en checkout.":(r.data.message||"No se pudo guardar");
    toast(r.ok?"Métodos guardados":"No se pudo guardar"); return; }
});

document.addEventListener("click", async (e)=>{
  if(e.target.closest("[data-logout]")){ e.preventDefault(); await postJSON(API+"/auth/logout",{}); location.href="/"; }
});

// City chooser
function setCookie(k,v){ document.cookie=k+"="+encodeURIComponent(v)+";path=/;max-age=15552000;samesite=lax"; }
document.addEventListener("click",(e)=>{
  if(e.target.closest("[data-open-city]")){ e.preventDefault(); $("#city-sheet")?.classList.add("show"); $("#city-scrim")?.classList.add("show"); }
  if(e.target.closest("[data-close-city]")||e.target.id==="city-scrim"){ $("#city-sheet")?.classList.remove("show"); $("#city-scrim")?.classList.remove("show"); }
  const c=e.target.closest("[data-city]");
  if(c){ setCookie("mp_city",c.dataset.city); location.reload(); }
});
// Mobile filters drawer
document.addEventListener("click",(e)=>{
  if(e.target.closest("[data-open-filters]")){ $("#filters")?.classList.add("open"); }
  if(e.target.closest("[data-close-filters]")){ $("#filters")?.classList.remove("open"); }
});

// QuickPago portal
document.addEventListener("click",(e)=>{
  const tab=e.target.closest("[data-qptab]"); if(tab){ const w=tab.dataset.qptab;
    $$("[data-qptab]").forEach(t=>{const on=t.dataset.qptab===w;t.className="tab btn"+(on?"":" btn--ghost");t.style.background=on?"var(--qp)":"";t.style.color=on?"#fff":"";});
    const l=$("#qp-login"),r=$("#qp-register"); if(l&&r){l.hidden=w!=="login";r.hidden=w!=="register";} }
});
document.addEventListener("submit", async (e)=>{
  const f=e.target;
  if(f.id==="qp-login"){ e.preventDefault(); const r=await postJSON("/quickpago/api/login",formData(f)); if(r.ok) location.href="/quickpago/portal"; else f.querySelector("[data-err]").textContent=r.data.message||"Error"; }
  if(f.id==="qp-register"){ e.preventDefault(); const r=await postJSON("/quickpago/api/register",formData(f)); if(r.ok) location.href="/quickpago/portal"; else f.querySelector("[data-err]").textContent=r.data.message||"Error"; }
  if(f.id==="qp-methods"){ e.preventDefault(); const d=formData(f);
    const body={pagomovil:{bank:d.pm_bank,phone:d.pm_phone,ci:d.pm_ci},transfer:{bank:d.tr_bank,account:d.tr_account,holder:d.tr_holder},crypto:{network:d.cr_network,asset:d.cr_asset,address:d.cr_address}};
    const r=await postJSON("/quickpago/api/methods",body); toast(r.ok?"Métodos guardados":"Error"); }
  if(f.id==="qp-charge"){ e.preventDefault(); const r=await postJSON("/quickpago/api/charge",formData(f));
    if(r.ok){ toast("Cobro creado: "+r.data.reference); setTimeout(()=>location.href="/quickpago/c/"+encodeURIComponent(r.data.reference),500);} else toast("Error"); }
  if(f.id==="qp-pay-proof"){ e.preventDefault(); const r=await postJSON("/quickpago/api/pay/"+encodeURIComponent(f.dataset.ref),formData(f));
    const msg=f.querySelector("[data-err]"); if(msg) msg.textContent=r.ok?(r.data.message||"Comprobante enviado"):(r.data.message||"Error");
    toast(r.ok?"Comprobante enviado":"No se pudo reportar el pago"); if(r.ok) f.reset(); }
});
document.addEventListener("click", async (e)=>{
  if(e.target.closest("[data-qp-logout]")){ await postJSON("/quickpago/api/logout",{}); location.href="/quickpago"; }
  const cf=e.target.closest("[data-qp-confirm]"); if(cf){ await postJSON("/quickpago/api/tx/"+cf.dataset.qpConfirm+"/confirm",{}); location.reload(); }
  const cc=e.target.closest("[data-qp-cancel]"); if(cc){ await postJSON("/quickpago/api/tx/"+cc.dataset.qpCancel+"/cancel",{}); location.reload(); }
  const ce=e.target.closest("[data-qp-expire]"); if(ce){ await postJSON("/quickpago/api/tx/"+ce.dataset.qpExpire+"/expire",{}); location.reload(); }
  const cp=e.target.closest("[data-copy]"); if(cp){ try{ await navigator.clipboard.writeText(cp.dataset.copy); toast("Link copiado"); }catch{ toast(cp.dataset.copy); } }
});

// --- Home location picker (Google Maps Places, lazily loaded) ---
function loadMaps(cb){
  if(window.google&&window.google.maps){ cb(); return; }
  const k=window.__MAPS_KEY; if(!k){ cb(); return; }
  window.__mapsCb=(window.__mapsCb||[]); window.__mapsCb.push(cb);
  if(window.__mapsLoading) return; window.__mapsLoading=true;
  window.__mapsReady=function(){ (window.__mapsCb||[]).forEach(f=>f()); window.__mapsCb=[]; };
  const s=document.createElement("script");
  s.src="https://maps.googleapis.com/maps/api/js?key="+encodeURIComponent(k)+"&libraries=places&loading=async&callback=__mapsReady";
  s.async=true; document.head.appendChild(s);
}
function setHomeCoords(f,lat,lng){
  if(!isFinite(lat)||!isFinite(lng)) return;
  f.elements.homeLat.value=lat.toFixed(6); f.elements.homeLng.value=lng.toFixed(6);
  if(f.elements.homeCoords) f.elements.homeCoords.value=lat.toFixed(5)+", "+lng.toFixed(5);
}
function renderHomeMap(lat,lng){
  const el=$("#home-map"); if(!el||!(window.google&&window.google.maps)) return;
  el.hidden=false; const c={lat:lat,lng:lng};
  const map=new google.maps.Map(el,{center:c,zoom:14,disableDefaultUI:true});
  const mk=new google.maps.Marker({position:c,map:map,draggable:true});
  mk.addListener("dragend",()=>{ const p=mk.getPosition(); setHomeCoords($("#home-form"),p.lat(),p.lng()); });
}
function initHome(){
  const f=$("#home-form"); if(!f) return;
  const geo=$("[data-use-geo]",f);
  if(geo) geo.addEventListener("click",()=>{
    if(!navigator.geolocation){ toast("Geolocalización no disponible"); return; }
    geo.disabled=true;
    navigator.geolocation.getCurrentPosition(pos=>{
      setHomeCoords(f,pos.coords.latitude,pos.coords.longitude); renderHomeMap(pos.coords.latitude,pos.coords.longitude);
      geo.disabled=false; toast("Ubicación detectada");
    },()=>{ geo.disabled=false; toast("No se pudo obtener tu ubicación"); });
  });
  const cur=parseFloat(f.elements.homeLat.value), curLng=parseFloat(f.elements.homeLng.value);
  loadMaps(()=>{
    if(!(window.google&&window.google.maps&&window.google.maps.places)) return;
    const search=$("#home-search");
    if(search){
      const ac=new google.maps.places.Autocomplete(search,{fields:["geometry","name","formatted_address"],componentRestrictions:{country:"ve"}});
      ac.addListener("place_changed",()=>{ const p=ac.getPlace(); if(p.geometry&&p.geometry.location){
        const lat=p.geometry.location.lat(),lng=p.geometry.location.lng();
        setHomeCoords(f,lat,lng); f.elements.homeLabel.value=p.formatted_address||p.name||f.elements.homeLabel.value; renderHomeMap(lat,lng);
      }});
    }
    if(isFinite(cur)&&isFinite(curLng)) renderHomeMap(cur,curLng);
  });
}

document.addEventListener("submit", async (e)=>{
  const f=e.target;
  if(f.id==="home-form"){ e.preventDefault(); const d=formData(f);
    let lat=parseFloat(d.homeLat), lng=parseFloat(d.homeLng);
    if((!isFinite(lat)||!isFinite(lng))&&d.homeCoords){ const m=String(d.homeCoords).split(/[ ,]+/).map(Number); if(m.length>=2&&isFinite(m[0])&&isFinite(m[1])){ lat=m[0]; lng=m[1]; } }
    const home={label:d.homeLabel||"",city:d.homeCity||""}; if(isFinite(lat)&&isFinite(lng)){ home.lat=lat; home.lng=lng; }
    const el=f.querySelector("[data-err]");
    const r=await postJSON(API+"/auth/profile",{home});
    if(r.ok){
      if(home.lat&&home.lng) setCookie("mp_home",JSON.stringify({lat:home.lat,lng:home.lng,label:home.label,city:home.city}));
      if(el) el.textContent="Ubicación guardada. Verás supermercados cercanos."; toast("Ubicación guardada");
      setTimeout(()=>location.href="/super",600);
    } else { if(el) el.textContent=r.data.message||"Inicia sesión para guardar tu ubicación"; toast("No se pudo guardar"); }
    return; }
  if(f.dataset.productEdit){ e.preventDefault(); const d=formData(f);
    const body={title:d.title,brand:d.brand,category:d.category,description:d.description,curated:!!(f.elements.curated&&f.elements.curated.checked)};
    if(d.image) body.images=[d.image];
    const r=await postJSON(API+"/catalog/products/"+encodeURIComponent(f.dataset.productEdit),body);
    const el=f.querySelector("[data-err]"); if(el) el.textContent=r.ok?"Guardado ✓":(r.data.message||("Error "+r.status));
    toast(r.ok?"Producto actualizado":"No se pudo guardar"); return; }
});

paint();
prefillCheckoutProfile();
renderPaymentInstructions();
initHome();
`;
