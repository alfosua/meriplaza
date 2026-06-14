// Global stylesheet for the server-rendered Meriplaza app.
//
// Visual language: sophisticated and calm like Apple — mostly white, generous
// whitespace, crisp type, restrained shadows — with Meriplaza blue (#1257E0)
// and a warm yellow (#FFC400) as accents. Mobile-first, GPU-cheap, with
// prefers-reduced-motion support.
export const APP_CSS = `
/* Smooth cross-page transitions (Chromium) for a multi-page-app that feels
   like a single app while staying server-rendered. */
@view-transition{navigation:auto}
::view-transition-old(root){animation:vtOut .18s ease both}
::view-transition-new(root){animation:vtIn .22s ease both}
@keyframes vtOut{to{opacity:0}}
@keyframes vtIn{from{opacity:0;transform:translateY(6px)}to{opacity:1}}
:root{
  --blue:#1257E0;--blue-700:#0c41ad;--blue-050:#eef3ff;
  --yellow:#FFC400;--yellow-600:#e0aa00;
  --ink:#0b0b0f;--ink-2:#6b7280;--ink-3:#9aa1ad;
  --line:#ececf1;--bg:#ffffff;--bg-soft:#f5f6f8;--surface:#ffffff;
  --good:#0a8a4a;--accent:var(--blue);
  --radius:18px;--radius-sm:12px;--pill:999px;
  --shadow-1:0 1px 2px rgba(15,18,30,.04),0 4px 14px rgba(15,18,30,.05);
  --shadow-2:0 8px 30px rgba(15,18,30,.10);--shadow-3:0 24px 60px rgba(15,18,30,.18);
  --container:1200px;
  --font:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Roboto,Helvetica,Arial,sans-serif;
}
*,*::before,*::after{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;min-height:100vh;display:flex;flex-direction:column;font-family:var(--font);color:var(--ink);background:var(--bg);-webkit-font-smoothing:antialiased;letter-spacing:-.005em}
main{flex:1 0 auto}
a{color:inherit;text-decoration:none}
img{max-width:100%;display:block}
h1,h2,h3{letter-spacing:-.02em}
.container{max-width:var(--container);margin:0 auto;padding-inline:clamp(1rem,4vw,2rem)}
.muted{color:var(--ink-2)}
.soft-sec{background:var(--bg-soft)}
.row{display:flex;align-items:center;gap:.5rem}
.spread{display:flex;align-items:center;justify-content:space-between;gap:.75rem}
.hide-sm{display:inline}@media(max-width:620px){.hide-sm{display:none}}

/* Header — white, refined, sticky */
.head{position:sticky;top:0;z-index:30;background:rgba(255,255,255,.85);backdrop-filter:saturate(180%) blur(14px);border-bottom:1px solid var(--line)}
.head .container{display:flex;align-items:center;gap:.9rem;padding:.6rem 0;flex-wrap:wrap}
.logo{display:inline-flex;align-items:center;gap:.5rem}
.brand-mark{width:30px;height:30px;display:inline-block}.brand-mark svg{width:100%;height:100%}
.brand-word{font-weight:700;font-size:1.2rem;letter-spacing:-.03em;color:var(--ink)}
.brand-word b{color:var(--blue);font-weight:700}
.search{flex:1;display:flex;align-items:center;background:var(--bg-soft);border:1px solid var(--line);border-radius:var(--pill);overflow:hidden;min-width:180px;transition:border-color .15s,box-shadow .15s}
.search:focus-within{border-color:var(--blue);box-shadow:0 0 0 3px var(--blue-050)}
.search input{flex:1;border:0;outline:0;background:none;padding:.58rem .95rem;font:inherit;font-size:.9rem;color:var(--ink);min-width:0}
.search button{border:0;background:none;color:var(--ink-2);padding:0 .9rem;font-size:1rem;cursor:pointer}
.icons{display:flex;align-items:center;gap:.3rem}
.iconbtn{position:relative;background:none;border:0;color:var(--ink);min-width:40px;height:40px;border-radius:var(--pill);cursor:pointer;font-size:1.05rem;display:inline-flex;align-items:center;gap:.4rem;padding:0 .7rem;text-decoration:none;transition:background .15s}
.iconbtn:hover{background:var(--bg-soft)}
.cart-count{position:absolute;top:-3px;right:-2px;background:var(--yellow);color:#3a2d00;font-size:.65rem;font-weight:800;min-width:18px;height:18px;border-radius:999px;display:grid;place-items:center;padding:0 4px;animation:pop .25s ease}
.cart-count[hidden]{display:none!important}
@keyframes pop{from{transform:scale(.4);opacity:0}to{transform:scale(1);opacity:1}}
.city-pill{display:inline-flex;align-items:center;gap:.3rem;background:var(--bg-soft);border:1px solid var(--line);border-radius:var(--pill);padding:.4rem .8rem;font-size:.8rem;font-weight:600;cursor:pointer}
.city-pill b{color:var(--blue)}

/* Category bar */
.cats{background:var(--surface);border-bottom:1px solid var(--line);position:sticky;top:53px;z-index:25}
.cats .container{display:flex;gap:.4rem;overflow-x:auto;padding:.55rem 0;scrollbar-width:none}
.cats .container::-webkit-scrollbar{display:none}
.chip{white-space:nowrap;border:1px solid var(--line);background:#fff;color:var(--ink);border-radius:var(--pill);padding:.38rem .85rem;font-size:.83rem;font-weight:550;display:inline-flex;gap:.35rem;align-items:center;transition:background .15s,border-color .15s,color .15s}
.chip:hover{border-color:var(--blue)}
.chip.active{background:var(--ink);border-color:var(--ink);color:#fff}

/* Hero — clean, Apple-like */
.hero{margin:1.5rem 0;border-radius:var(--radius);overflow:hidden;background:linear-gradient(180deg,var(--blue-050),#fff);border:1px solid var(--line);position:relative}
.hero-in{padding:clamp(2rem,6vw,4rem) clamp(1.5rem,5vw,3.5rem);max-width:680px;position:relative;z-index:1}
.hero h1{font-size:clamp(2rem,6vw,3.6rem);line-height:1.03;margin:0 0 .7rem;font-weight:700}
.hero h1 .y{color:var(--blue)}
.hero p{margin:0 0 1.4rem;font-size:clamp(1rem,2.5vw,1.2rem);color:var(--ink-2);max-width:46ch}
.hero-deco{position:absolute;right:-40px;top:-40px;width:340px;height:340px;border-radius:50%;background:radial-gradient(circle at 30% 30%,var(--yellow),transparent 70%);opacity:.5;pointer-events:none}

section{padding:1.6rem 0}
.section-head{display:flex;align-items:baseline;justify-content:space-between;margin:0 0 1.1rem;gap:1rem}
.section-head h2{font-size:clamp(1.2rem,2.6vw,1.6rem);margin:0;font-weight:700}
.link{color:var(--blue);font-weight:600;font-size:.88rem}

/* Buttons */
.btn{appearance:none;border:0;cursor:pointer;font:inherit;font-weight:600;border-radius:var(--pill);padding:.62rem 1.2rem;line-height:1;display:inline-flex;align-items:center;gap:.45rem;justify-content:center;transition:transform .08s,filter .15s,background .15s,box-shadow .15s;text-decoration:none}
.btn:active{transform:translateY(1px)}
.btn--primary{background:var(--blue);color:#fff}.btn--primary:hover{background:var(--blue-700)}
.btn--accent{background:var(--yellow);color:#3a2d00}.btn--accent:hover{background:var(--yellow-600)}
.btn--dark{background:var(--ink);color:#fff}.btn--dark:hover{filter:brightness(1.15)}
.btn--ghost{background:#fff;color:var(--ink);border:1px solid var(--line)}.btn--ghost:hover{background:var(--bg-soft)}
.btn--block{width:100%}
.btn[disabled]{background:#e7e9ee;color:var(--ink-3);cursor:not-allowed}

/* Badges */
.badge{display:inline-flex;align-items:center;gap:.25rem;font-size:.7rem;font-weight:700;padding:.18rem .55rem;border-radius:var(--pill)}
.badge--sale{background:var(--yellow);color:#3a2d00}
.badge--out{background:#eceef2;color:var(--ink-2)}
.badge--kind{background:var(--blue-050);color:var(--blue)}
.badge--promo{background:var(--blue);color:#fff}

/* Product grid + cards */
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:clamp(.8rem,2vw,1.25rem)}
.card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;display:flex;flex-direction:column;transition:transform .14s cubic-bezier(.2,.7,.2,1),box-shadow .18s;content-visibility:auto;contain-intrinsic-size:320px}
.card:hover{transform:translateY(-4px);box-shadow:var(--shadow-2)}
.thumb{position:relative;aspect-ratio:1;display:grid;place-items:center;background:var(--bg-soft);font-size:2.4rem;overflow:hidden}
.thumb .ph{opacity:.5}
.thumb img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#fff;animation:imgIn .45s ease}
@keyframes imgIn{from{opacity:0}to{opacity:1}}
.card .body{padding:.8rem .9rem 1rem;display:flex;flex-direction:column;flex:1}
.card .store{font-size:.72rem;color:var(--ink-2);font-weight:500}
.card h3{font-size:.9rem;margin:.2rem 0 .4rem;line-height:1.32;font-weight:600;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:2.35em}
.rating{font-size:.72rem;color:var(--ink-2);display:flex;gap:.25rem;align-items:center}
.stars{color:var(--yellow-600);letter-spacing:-1px}
.foot{margin-top:auto;display:flex;align-items:flex-end;justify-content:space-between;gap:.5rem;padding-top:.55rem}
.priceblock{min-width:0}
.price{font-weight:800;font-size:1.05rem;white-space:nowrap}
.price .pre{display:block;font-weight:500;color:var(--ink-2);font-size:.7rem}
.price .was{color:var(--ink-3);text-decoration:line-through;font-weight:500;font-size:.74rem;margin-left:.3rem}
.add{background:var(--blue);color:#fff;border:0;border-radius:var(--pill);width:36px;height:36px;font-size:1.25rem;cursor:pointer;flex:none;display:grid;place-items:center;transition:background .15s,transform .1s}
.add:hover{background:var(--blue-700)}.add:active{transform:scale(.92)}
.add[disabled]{background:#e7e9ee;color:var(--ink-3);cursor:not-allowed}
.thumb .badge{position:absolute;top:.55rem;left:.55rem;box-shadow:var(--shadow-1)}

/* Stores */
.stores{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1rem}
.store-cover{height:84px;display:grid;place-items:center}
.store-cover .av{width:52px;height:52px;border-radius:14px;background:#fff;display:grid;place-items:center;font-weight:800;font-size:1.4rem;box-shadow:var(--shadow-1)}
.store-cover img{height:48px;max-width:80%;object-fit:contain;filter:drop-shadow(0 2px 6px rgba(0,0,0,.15))}
.store-meta{padding:.85rem 1rem 1rem}
.store-meta h3{margin:.4rem 0 .15rem;font-size:1rem}
.store-foot{display:flex;justify-content:space-between;font-size:.72rem;color:var(--ink-2);border-top:1px solid var(--line);margin-top:.6rem;padding-top:.5rem}

/* Layout with filter sidebar */
.with-aside{display:grid;grid-template-columns:240px 1fr;gap:1.5rem;align-items:start}
@media(max-width:820px){.with-aside{grid-template-columns:1fr}.filters{display:none}.filters.open{display:block;position:fixed;inset:0;z-index:50;background:#fff;overflow:auto;padding:1rem}}
.filters{position:sticky;top:110px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:1.1rem}
.filters h3{font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-2);margin:1rem 0 .5rem}
.filters h3:first-child{margin-top:0}
.filters a,.filters label{display:flex;align-items:center;gap:.5rem;padding:.3rem 0;font-size:.88rem;cursor:pointer;color:var(--ink)}
.filters a.on{color:var(--blue);font-weight:650}
.filter-toggle{display:none}
@media(max-width:820px){.filter-toggle{display:inline-flex}}

/* Product detail */
.pdp{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:2.5rem;padding:1.5rem 0}
@media(max-width:860px){.pdp{grid-template-columns:1fr;gap:1.25rem}}
.gallery .main{aspect-ratio:1;border-radius:var(--radius);overflow:hidden;background:var(--bg-soft);display:grid;place-items:center;font-size:6rem;border:1px solid var(--line)}
.gallery .main img{width:100%;height:100%;object-fit:contain;background:#fff}
.thumbs{display:flex;gap:.5rem;margin-top:.6rem;flex-wrap:wrap}
.thumbs button{width:64px;height:64px;border-radius:12px;border:2px solid var(--line);overflow:hidden;background:#fff;cursor:pointer;padding:0}
.thumbs button.active{border-color:var(--blue)}
.thumbs img{width:100%;height:100%;object-fit:cover}
.pdp h1{font-size:clamp(1.5rem,3.5vw,2.2rem);margin:.2rem 0 .5rem}
.brand-line{color:var(--ink-2);font-size:.9rem;margin-bottom:.4rem}
.offers{margin:1rem 0;border:1px solid var(--line);border-radius:var(--radius);overflow:hidden}
.offer{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.9rem 1.1rem;border-bottom:1px solid var(--line)}
.offer:last-child{border-bottom:0}
.offer.best{background:var(--blue-050)}
.offer .who{font-weight:600}.offer .who small{display:block;color:var(--ink-2);font-weight:400;font-size:.75rem}
.specs{width:100%;border-collapse:collapse;margin:1rem 0;font-size:.9rem}
.specs td{padding:.55rem .75rem;border-bottom:1px solid var(--line)}
.specs td:first-child{color:var(--ink-2);width:40%}
.infocards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.75rem;margin:1rem 0}
.infocard{border:1px solid var(--line);border-radius:var(--radius-sm);padding:.8rem .9rem;font-size:.82rem}
.infocard b{display:block;font-size:.9rem;margin-bottom:.15rem}
.reviews .review{padding:.9rem 0;border-bottom:1px solid var(--line)}
.reviews .rh{display:flex;justify-content:space-between;gap:1rem}
.review-form{background:var(--bg-soft);border:1px solid var(--line);border-radius:var(--radius);padding:1.1rem;margin-top:1rem}
.review-form input,.review-form textarea,.review-form select{width:100%;padding:.6rem .75rem;border:1px solid var(--line);border-radius:10px;font:inherit;margin-top:.4rem;background:#fff}
/* sticky mobile add-to-cart */
.buybar{display:none}
@media(max-width:860px){.buybar{display:flex;position:sticky;bottom:0;z-index:20;gap:.75rem;align-items:center;justify-content:space-between;background:rgba(255,255,255,.92);backdrop-filter:blur(10px);border-top:1px solid var(--line);padding:.7rem 1rem;margin:0 -1rem -1.5rem}}

/* Promo / deals strip */
.promostrip{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1rem}
.promo{border-radius:var(--radius);padding:1.4rem;color:#fff;position:relative;overflow:hidden;min-height:140px;display:flex;flex-direction:column;justify-content:flex-end}
.promo h3{margin:0 0 .25rem;font-size:1.25rem}.promo p{margin:0;opacity:.92;font-size:.9rem}
.promo--blue{background:linear-gradient(135deg,var(--blue),#3b82f6)}
.promo--yellow{background:linear-gradient(135deg,#ff9d00,var(--yellow));color:#3a2d00}
.promo--dark{background:linear-gradient(135deg,#111,#374151)}

/* Toast + cart drawer */
.toast{position:fixed;left:50%;bottom:1.25rem;transform:translateX(-50%) translateY(2rem);background:var(--ink);color:#fff;padding:.7rem 1.1rem;border-radius:var(--pill);box-shadow:var(--shadow-3);opacity:0;pointer-events:none;transition:opacity .25s,transform .25s;z-index:90;font-size:.9rem}
.toast.show{opacity:1;transform:translateX(-50%)}
.scrim{position:fixed;inset:0;background:rgba(11,11,15,.4);opacity:0;pointer-events:none;transition:opacity .2s;z-index:60}
.scrim.show{opacity:1;pointer-events:auto}
.drawer{position:fixed;top:0;right:0;height:100%;width:min(420px,92vw);background:var(--surface);box-shadow:var(--shadow-3);transform:translateX(100%);transition:transform .24s cubic-bezier(.2,.7,.2,1);z-index:70;display:flex;flex-direction:column}
.drawer.show{transform:none}
.drawer header{display:flex;align-items:center;justify-content:space-between;padding:1rem 1.1rem;border-bottom:1px solid var(--line)}
.drawer .body{flex:1;overflow-y:auto;padding:1rem 1.1rem}
.drawer footer{padding:1rem 1.1rem;border-top:1px solid var(--line)}
.cline{display:grid;grid-template-columns:1fr auto;gap:.2rem .75rem;padding:.55rem 0;border-bottom:1px solid var(--line)}
.qty{display:inline-flex;align-items:center;border:1px solid var(--line);border-radius:var(--pill)}
.qty button{width:28px;height:28px;border:0;background:none;font-size:1.1rem;cursor:pointer;color:var(--blue)}
.qty span{min-width:1.4rem;text-align:center;font-weight:700;font-size:.85rem}

/* Cart / checkout page */
.checkout-page{padding-top:1rem}
.checkout-head{display:flex;align-items:flex-end;justify-content:space-between;gap:1rem;padding:1.5rem 0 1rem}
.checkout-head h1{margin:.15rem 0 .25rem;font-size:clamp(2rem,5vw,3rem)}
.checkout-grid{display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:1.25rem;align-items:start;padding-top:.5rem}
.checkout-side{position:sticky;top:112px}
.checkout-card,.checkout-form{padding:1rem;content-visibility:visible;contain-intrinsic-size:auto}
.checkout-card:hover,.checkout-form:hover{transform:none;box-shadow:none}
.emptycart{text-align:center;padding:3rem 1rem}
.checkout-store{padding:.4rem 0 1rem;border-bottom:1px solid var(--line)}
.checkout-store:last-child{border-bottom:0;padding-bottom:.2rem}
.cartline{display:grid;grid-template-columns:minmax(0,1fr) auto auto auto;gap:.75rem;align-items:center;padding:.85rem 0;border-top:1px solid var(--line)}
.cartline b{display:block;font-size:.95rem}.cartline small{display:block;color:var(--ink-2);font-size:.78rem;margin-top:.12rem}
.cartline .remove{border:0;background:none;color:var(--ink-2);font:inherit;font-size:.78rem;cursor:pointer}
.cartline .remove:hover{color:var(--blue)}
.checkout-form h2{font-size:1rem;margin:.25rem 0 .75rem}
.checkout-form h2:not(:first-child){margin-top:1.2rem}
.checkout-form label{display:block;font-size:.82rem;color:var(--ink-2);font-weight:600;margin-top:.65rem}
.checkout-form input,.checkout-form select,.checkout-form textarea{width:100%;padding:.62rem .72rem;border:1px solid var(--line);border-radius:10px;font:inherit;margin-top:.28rem;background:#fff;color:var(--ink)}
.checkout-form input:focus,.checkout-form select:focus,.checkout-form textarea:focus{outline:0;border-color:var(--blue);box-shadow:0 0 0 3px var(--blue-050)}
.checkout-total{margin:1rem 0 .75rem;padding:.85rem 1rem;border-radius:14px;background:var(--blue-050);color:var(--blue);font-weight:800;text-align:center}
.pay-instructions{display:grid;gap:.55rem;margin-top:.75rem}.payhint{border:1px solid var(--line);border-radius:14px;padding:.7rem .8rem;background:var(--bg-soft);font-size:.82rem}.payhint b{display:block;margin-bottom:.25rem}.payhint span{display:block;color:var(--ink-2);word-break:break-word}
@media(max-width:900px){.checkout-grid{grid-template-columns:1fr}.checkout-side{position:static}.checkout-head{align-items:flex-start;flex-direction:column}.cartline{grid-template-columns:1fr auto}.cartline strong{grid-column:1}.cartline .remove{justify-self:end}}

/* Order receipt */
.receipt-page{padding-top:1rem}
.receipt-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1rem;padding-top:.5rem}
.receipt-grid--wide{grid-template-columns:minmax(0,1.4fr) minmax(240px,.6fr)}
.receipt-card{padding:1rem;content-visibility:visible;contain-intrinsic-size:auto}.receipt-card:hover{transform:none;box-shadow:none}
.receipt-card h2{font-size:1rem;margin:.1rem 0 .8rem}
.receipt-switch{display:flex;gap:.45rem;flex-wrap:wrap;padding:.65rem;margin-bottom:1rem;content-visibility:visible}.receipt-switch:hover{transform:none;box-shadow:none}
.receipt-switch a{border:1px solid var(--line);border-radius:var(--pill);padding:.35rem .7rem;font-size:.82rem;font-weight:650}.receipt-switch a.on{background:var(--blue);border-color:var(--blue);color:#fff}
.receipt-timeline{list-style:none;margin:0;padding:0;display:grid;gap:.65rem}.receipt-timeline li{display:flex;align-items:center;gap:.6rem;color:var(--ink-2);font-weight:600}.receipt-timeline li span{width:18px;height:18px;border-radius:50%;border:2px solid var(--line);background:#fff}.receipt-timeline li.done{color:var(--ink)}.receipt-timeline li.done span{border-color:var(--good);background:var(--good);box-shadow:inset 0 0 0 4px #fff}
.payline,.receipt-line,.receipt-total{display:flex;justify-content:space-between;gap:1rem;border-top:1px solid var(--line);padding:.65rem 0}.payline b,.receipt-line b,.receipt-total b{text-align:right}.payline b{word-break:break-word}.receipt-line small{color:var(--ink-2);font-weight:500}.receipt-total.grand{font-size:1.15rem;font-weight:850;color:var(--blue)}
@media(max-width:760px){.receipt-grid--wide{grid-template-columns:1fr}.payline,.receipt-line,.receipt-total{align-items:flex-start}}

/* entrance */
.fade-up{animation:fadeUp .45s ease both}
.stagger>*{animation:fadeUp .45s ease both}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}

/* footer pinned to bottom (flex body handles short pages) */
footer.site{background:#0b0b0f;color:#c9ccd3;margin-top:3rem;padding:2.5rem 0;font-size:.85rem;flex-shrink:0}
footer.site a{color:#fff}
footer.site .cols{display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr;gap:1.5rem}
@media(max-width:680px){footer.site .cols{grid-template-columns:1fr 1fr}}
footer.site h4{color:#fff;font-size:.85rem;margin:0 0 .6rem}
footer.site ul{list-style:none;padding:0;margin:0;display:grid;gap:.35rem}
footer.site .fbrand{display:flex;align-items:center;gap:.5rem;margin-bottom:.5rem}
footer.site .fbrand .brand-mark{width:28px;height:28px}

/* City chooser sheet */
.citysheet{position:fixed;left:50%;top:50%;transform:translate(-50%,-46%);width:min(520px,92vw);background:#fff;border-radius:var(--radius);box-shadow:var(--shadow-3);z-index:71;padding:1.2rem;opacity:0;pointer-events:none;transition:opacity .2s,transform .2s}
.citysheet.show{opacity:1;pointer-events:auto;transform:translate(-50%,-50%)}
.citygrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:.5rem}
.cityopt{display:flex;flex-direction:column;align-items:flex-start;gap:.1rem;border:1px solid var(--line);background:#fff;border-radius:12px;padding:.6rem .8rem;cursor:pointer;font:inherit;font-weight:600;font-size:.9rem}
.cityopt small{color:var(--ink-2);font-weight:400;font-size:.72rem}
.cityopt:hover{border-color:var(--blue)}.cityopt.on{border-color:var(--blue);background:var(--blue-050);color:var(--blue)}
.altprice{display:block;font-size:.7rem;color:var(--ink-3);font-weight:500;margin-top:1px}
.deal-row{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(150px,1fr);gap:.9rem;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:.4rem;scrollbar-width:none}
.deal-row::-webkit-scrollbar{display:none}
.deal-row>*{scroll-snap-align:start}
.filterbtn{display:none}@media(max-width:820px){.filterbtn{display:inline-flex}}
.ship-list{display:grid;gap:.5rem;margin:.5rem 0}
.ship-item{display:flex;align-items:center;justify-content:space-between;gap:1rem;border:1px solid var(--line);border-radius:10px;padding:.55rem .8rem;font-size:.85rem}
.ship-item .p{font-weight:600}.ship-item small{color:var(--ink-2)}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important;scroll-behavior:auto}}
`;
