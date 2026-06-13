// Global stylesheet for the server-rendered Meriplaza app (light DOM). Served
// once at /assets/app.css with a long cache lifetime. Mobile-first, GPU-cheap,
// with tasteful transitions and prefers-reduced-motion support.
export const APP_CSS = `
:root{
  --brand:#1b39c9;--brand-700:#142aa0;--brand-050:#eef1ff;
  --ink:#14151a;--ink-2:#5b6270;--line:#e7e9ee;--bg:#f6f7f9;--surface:#fff;
  --accent:#ff5a3c;--accent-700:#e3431f;--good:#0b8457;--star:#f5a623;
  --radius:14px;--radius-sm:10px;--pill:999px;
  --shadow-1:0 1px 2px rgba(20,21,26,.06),0 1px 3px rgba(20,21,26,.05);
  --shadow-2:0 6px 18px rgba(20,21,26,.10);--shadow-3:0 16px 40px rgba(20,21,26,.18);
  --container:1180px;
  --font:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
}
*,*::before,*::after{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;font-family:var(--font);color:var(--ink);background:var(--bg);-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
img{max-width:100%;display:block}
.container{max-width:var(--container);margin:0 auto;padding-inline:clamp(1rem,4vw,2rem)}
.muted{color:var(--ink-2)}
.row{display:flex;align-items:center;gap:.5rem}
.spread{display:flex;align-items:center;justify-content:space-between;gap:.75rem}

/* Header */
.head{position:sticky;top:0;z-index:30;background:var(--brand);color:#fff;box-shadow:var(--shadow-2)}
.head .container{display:flex;align-items:center;gap:.75rem;padding:.7rem 0;flex-wrap:wrap}
.logo{font-weight:900;font-size:1.3rem;letter-spacing:-.02em;white-space:nowrap}
.logo b{color:#ffd23c}
.search{flex:1;display:flex;background:#fff;border-radius:var(--pill);overflow:hidden;box-shadow:var(--shadow-1);min-width:180px}
.search input{flex:1;border:0;outline:0;padding:.62rem .95rem;font:inherit;font-size:.9rem;color:var(--ink);min-width:0}
.search button{border:0;background:#ffd23c;color:#14151a;padding:0 1.05rem;font-size:1.05rem;cursor:pointer}
.icons{display:flex;align-items:center;gap:.4rem}
.iconbtn{position:relative;background:rgba(255,255,255,.14);border:0;color:#fff;min-width:40px;height:40px;border-radius:var(--pill);cursor:pointer;font-size:1.05rem;display:inline-flex;align-items:center;gap:.35rem;padding:0 .7rem;text-decoration:none}
.iconbtn:hover{background:rgba(255,255,255,.24)}
.cart-count{position:absolute;top:-5px;right:-5px;background:var(--accent);color:#fff;font-size:.65rem;font-weight:800;min-width:18px;height:18px;border-radius:999px;display:grid;place-items:center;padding:0 4px;animation:pop .25s ease}
.cart-count[hidden]{display:none!important}
@keyframes pop{from{transform:scale(.4);opacity:0}to{transform:scale(1);opacity:1}}
.hide-sm{display:inline}@media(max-width:560px){.hide-sm{display:none}}
.loc{font-size:.75rem;opacity:.92;padding:0 0 .55rem}
.loc b{font-weight:700}
@media(max-width:560px){.search{order:3;flex-basis:100%}.logo{font-size:1.1rem}}

/* Category bar */
.cats{background:var(--surface);border-bottom:1px solid var(--line);position:sticky;top:56px;z-index:25}
.cats .container{display:flex;gap:.5rem;overflow-x:auto;padding:.6rem 0;scrollbar-width:none}
.cats .container::-webkit-scrollbar{display:none}
.chip{white-space:nowrap;border:1px solid var(--line);background:#fff;color:var(--ink);border-radius:var(--pill);padding:.4rem .85rem;font-size:.85rem;font-weight:600;display:inline-flex;gap:.35rem;align-items:center;transition:background .15s,border-color .15s}
.chip:hover{border-color:var(--brand)}
.chip.active{background:var(--brand-050);border-color:var(--brand);color:var(--brand)}

/* Hero */
.hero{margin:1.25rem 0;border-radius:var(--radius);overflow:hidden;color:#fff;background:radial-gradient(120% 140% at 100% 0%,#ff8a5b 0%,var(--accent) 35%,var(--brand) 100%)}
.hero-in{padding:clamp(1.5rem,5vw,3rem);max-width:640px}
.hero h1{font-size:clamp(2rem,7vw,3.4rem);line-height:1.02;margin:0 0 .6rem;letter-spacing:-.02em}
.hero p{margin:0 0 1.2rem;opacity:.95}

section{padding:1.4rem 0}
.section-head{display:flex;align-items:baseline;justify-content:space-between;margin:0 0 1rem}
.section-head h2{font-size:clamp(1.1rem,2.4vw,1.4rem);margin:0;letter-spacing:-.01em}
.link{color:var(--brand);font-weight:650;font-size:.85rem}

/* Buttons */
.btn{appearance:none;border:0;cursor:pointer;font:inherit;font-weight:650;border-radius:var(--pill);padding:.62rem 1.1rem;line-height:1;display:inline-flex;align-items:center;gap:.45rem;justify-content:center;transition:transform .08s,filter .15s,background .15s;text-decoration:none}
.btn:active{transform:translateY(1px)}
.btn--primary{background:var(--brand);color:#fff}.btn--primary:hover{background:var(--brand-700)}
.btn--accent{background:var(--accent);color:#fff}.btn--accent:hover{background:var(--accent-700)}
.btn--ghost{background:#fff;color:var(--ink);border:1px solid var(--line)}
.btn--block{width:100%}
.btn[disabled]{background:#c8ccd4;color:#fff;cursor:not-allowed}

/* Grid + product cards */
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:clamp(.7rem,2vw,1.1rem)}
.card{background:var(--surface);border-radius:var(--radius);box-shadow:var(--shadow-1);overflow:hidden;display:flex;flex-direction:column;transition:transform .12s ease,box-shadow .15s ease;content-visibility:auto;contain-intrinsic-size:300px}
.card:hover{transform:translateY(-3px);box-shadow:var(--shadow-2)}
.thumb{position:relative;aspect-ratio:1;display:grid;place-items:center;background:linear-gradient(135deg,var(--brand-050),#fff);font-size:clamp(2rem,7vw,3rem);overflow:hidden}
.thumb img{width:100%;height:100%;object-fit:cover;animation:imgIn .45s ease}
@keyframes imgIn{from{opacity:0}to{opacity:1}}
.card .body{padding:.7rem .8rem .85rem;display:flex;flex-direction:column;flex:1}
.card .store{font-size:.72rem;color:var(--ink-2)}
.card h3{font-size:.85rem;margin:.15rem 0 .35rem;line-height:1.3;font-weight:600;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:2.3em}
.rating{font-size:.72rem;color:var(--ink-2);display:flex;gap:.2rem;align-items:center}
.stars{color:var(--star);letter-spacing:-1px}
.foot{margin-top:auto;display:flex;align-items:center;justify-content:space-between;gap:.5rem;padding-top:.5rem}
.price{font-weight:800;font-size:1.02rem;letter-spacing:-.01em}
.price small{font-weight:500;color:var(--ink-2);font-size:.72rem}
.add{background:var(--brand);color:#fff;border:0;border-radius:var(--pill);min-width:34px;height:34px;font-size:1.2rem;cursor:pointer;flex:none;padding:0 .5rem}
.add:hover{background:var(--brand-700)}
.add[disabled]{background:#c8ccd4;cursor:not-allowed}
.badge{display:inline-flex;align-items:center;gap:.25rem;font-size:.7rem;font-weight:700;padding:.18rem .5rem;border-radius:var(--pill)}
.badge--sale{background:var(--accent);color:#fff}.badge--out{background:#eceef2;color:var(--ink-2)}
.badge--kind{background:rgba(255,255,255,.92);color:var(--brand)}
.thumb .badge{position:absolute;top:.5rem;left:.5rem}

/* Stores */
.stores{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:1rem}
.store-cover{height:88px;display:grid;place-items:center}
.store-cover .av{width:54px;height:54px;border-radius:14px;background:rgba(255,255,255,.95);display:grid;place-items:center;font-weight:900;font-size:1.5rem}
.store-meta{padding:.85rem 1rem 1rem}
.store-meta h3{margin:.45rem 0 .15rem;font-size:1rem}
.store-foot{display:flex;justify-content:space-between;font-size:.72rem;color:var(--ink-2);border-top:1px solid var(--line);margin-top:.6rem;padding-top:.5rem}

/* Product detail */
.pdp{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:2rem;padding:1.5rem 0}
@media(max-width:820px){.pdp{grid-template-columns:1fr}}
.gallery .main{aspect-ratio:1;border-radius:var(--radius);overflow:hidden;background:linear-gradient(135deg,var(--brand-050),#fff);display:grid;place-items:center;font-size:6rem}
.gallery .main img{width:100%;height:100%;object-fit:contain;background:#fff}
.thumbs{display:flex;gap:.5rem;margin-top:.6rem;flex-wrap:wrap}
.thumbs button{width:64px;height:64px;border-radius:10px;border:2px solid transparent;overflow:hidden;background:#fff;cursor:pointer;padding:0}
.thumbs button.active{border-color:var(--brand)}
.thumbs img{width:100%;height:100%;object-fit:cover}
.pdp h1{font-size:clamp(1.4rem,3.5vw,2rem);margin:.2rem 0 .4rem;letter-spacing:-.01em}
.brand-line{color:var(--ink-2);font-size:.9rem;margin-bottom:.5rem}
.offers{margin:1rem 0;border:1px solid var(--line);border-radius:var(--radius);overflow:hidden}
.offer{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.85rem 1rem;border-bottom:1px solid var(--line)}
.offer:last-child{border-bottom:0}
.offer.best{background:#f3fff8}
.offer .who{font-weight:600}
.offer .who small{display:block;color:var(--ink-2);font-weight:400;font-size:.75rem}
.specs{width:100%;border-collapse:collapse;margin:1rem 0;font-size:.9rem}
.specs td{padding:.5rem .75rem;border-bottom:1px solid var(--line)}
.specs td:first-child{color:var(--ink-2);width:40%}
.reviews .review{padding:.85rem 0;border-bottom:1px solid var(--line)}
.reviews .rh{display:flex;justify-content:space-between;gap:1rem}
.reviews .rh b{font-weight:700}
.review-form{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:1rem;margin-top:1rem}
.review-form input,.review-form textarea,.review-form select{width:100%;padding:.55rem .7rem;border:1px solid var(--line);border-radius:10px;font:inherit;margin-top:.4rem}

/* Toast */
.toast{position:fixed;left:50%;bottom:1.25rem;transform:translateX(-50%) translateY(2rem);background:var(--ink);color:#fff;padding:.7rem 1.1rem;border-radius:var(--pill);box-shadow:var(--shadow-3);opacity:0;pointer-events:none;transition:opacity .25s,transform .25s;z-index:80;font-size:.9rem}
.toast.show{opacity:1;transform:translateX(-50%)}

/* Cart drawer */
.scrim{position:fixed;inset:0;background:rgba(10,12,20,.45);opacity:0;pointer-events:none;transition:opacity .2s;z-index:60}
.scrim.show{opacity:1;pointer-events:auto}
.drawer{position:fixed;top:0;right:0;height:100%;width:min(420px,92vw);background:var(--surface);box-shadow:var(--shadow-3);transform:translateX(100%);transition:transform .24s cubic-bezier(.2,.7,.2,1);z-index:70;display:flex;flex-direction:column}
.drawer.show{transform:none}
.drawer header{display:flex;align-items:center;justify-content:space-between;padding:1rem 1.1rem;border-bottom:1px solid var(--line)}
.drawer .body{flex:1;overflow-y:auto;padding:1rem 1.1rem}
.drawer footer{padding:1rem 1.1rem;border-top:1px solid var(--line)}
.cline{display:grid;grid-template-columns:1fr auto;gap:.2rem .75rem;padding:.55rem 0;border-bottom:1px solid var(--line)}
.qty{display:inline-flex;align-items:center;border:1px solid var(--line);border-radius:var(--pill)}
.qty button{width:28px;height:28px;border:0;background:none;font-size:1.1rem;cursor:pointer;color:var(--brand)}
.qty span{min-width:1.4rem;text-align:center;font-weight:700;font-size:.85rem}

/* Skeleton + entrance animation */
.fade-up{animation:fadeUp .4s ease both}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.stagger>*{animation:fadeUp .4s ease both}
footer.site{background:#10141b;color:#cfd4dd;margin-top:2rem;padding:2rem 0;font-size:.85rem}
footer.site a{color:#fff}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important;scroll-behavior:auto}}
`;
