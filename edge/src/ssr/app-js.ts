// Progressive-enhancement client script for the SSR app. Served at
// /assets/app.js. Pages render fully without it; this adds the cart, drawer,
// gallery, review submit, and small interactions. Kept tiny for slow links.
export const APP_JS = `
const API = location.origin;
const KEY = "meriplaza:cart:v1";
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];

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
  const d=$("#drawer"); if(d && d.classList.contains("show")) renderDrawer(); }

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
     '<button class="btn btn--accent btn--block" id="checkout">Pagar ahora</button></footer>':'');
  $("#x").onclick=closeCart;
  $$("[data-inc]",d).forEach(b=>b.onclick=()=>Cart.setQty(b.dataset.inc,qof(b.dataset.inc)+1));
  $$("[data-dec]",d).forEach(b=>b.onclick=()=>Cart.setQty(b.dataset.dec,qof(b.dataset.dec)-1));
  $$("[data-rm]",d).forEach(b=>b.onclick=()=>Cart.remove(b.dataset.rm));
  const co=$("#checkout"); if(co) co.onclick=checkout;
}
function qof(id){ const i=Cart.items().find(x=>x.offerId===id); return i?i.qty:0; }

async function checkout(){
  const groups=Cart.groups();
  if(!groups.length) return;
  try{
    for(const g of groups){
      await fetch(API+"/catalog/orders",{method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({sellerId:g.sellerId,channel:"web",items:g.lines.map(l=>({offerId:l.offerId,quantity:l.qty}))})});
    }
    Cart.save([]); closeCart(); toast("¡Pedido creado! Gracias por tu compra.");
  }catch(e){ toast("No se pudo completar el checkout."); }
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

// Login / register tab switch
document.addEventListener("click",(e)=>{
  const tab=e.target.closest(".tab"); if(!tab) return;
  const which=tab.dataset.tab;
  $$(".tab").forEach(t=>{ const on=t.dataset.tab===which; t.className="tab btn"+(on?"":" btn--ghost"); t.style.background=on?"var(--brand)":""; t.style.color=on?"#fff":""; });
  const lf=$("#login-form"), rf=$("#register-form"); if(lf&&rf){ lf.hidden=which!=="login"; rf.hidden=which!=="register"; }
});
document.addEventListener("change",(e)=>{ if(e.target.name==="isStore"){ const sf=$("[data-store-fields]"); if(sf) sf.hidden=!e.target.checked; }});

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
    if(r.ok){ toast("Cobro creado: "+r.data.reference); setTimeout(()=>location.reload(),900);} else toast("Error"); }
});
document.addEventListener("click", async (e)=>{
  if(e.target.closest("[data-qp-logout]")){ await postJSON("/quickpago/api/logout",{}); location.href="/quickpago"; }
  const cf=e.target.closest("[data-qp-confirm]"); if(cf){ await postJSON("/quickpago/api/tx/"+cf.dataset.qpConfirm+"/confirm",{}); location.reload(); }
});

paint();
`;
