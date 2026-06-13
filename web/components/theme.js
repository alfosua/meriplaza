// Meriplaza design system — a shared constructable stylesheet adopted by every
// component's Shadow DOM. Centralizes brand tokens, a responsive type scale,
// spacing, elevation, buttons, skeleton loaders, and lazy-image styling.
//
// Design language: Farmatodo's trustworthy blue + category-driven commerce,
// Amazon's search-first density, Steve Madden's whitespace and bold imagery.
// Built for low-connectivity / constrained hardware: no framework, system
// fonts, GPU-cheap effects, content-visibility, and skeletons to avoid layout
// shift.

const css = `
:host {
  /* Brand */
  --mp-brand: #1b39c9;          /* vivid trustworthy blue */
  --mp-brand-700: #142aa0;
  --mp-brand-050: #eef1ff;
  --mp-ink: #14151a;            /* near-black text */
  --mp-ink-2: #5b6270;          /* secondary text */
  --mp-line: #e7e9ee;           /* hairlines */
  --mp-bg: #f6f7f9;             /* app background */
  --mp-surface: #ffffff;
  --mp-accent: #ff5a3c;         /* coral — sale / price emphasis */
  --mp-accent-700: #e3431f;
  --mp-good: #0b8457;           /* in-stock / success */
  --mp-warn: #f5a623;

  /* Type scale (responsive via clamp) */
  --mp-font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --mp-fs-xs: .75rem;
  --mp-fs-sm: .85rem;
  --mp-fs-md: 1rem;
  --mp-fs-lg: clamp(1.1rem, 2.4vw, 1.35rem);
  --mp-fs-xl: clamp(1.5rem, 5vw, 2.4rem);
  --mp-fs-2xl: clamp(2rem, 7vw, 3.4rem);

  /* Spacing / shape / elevation */
  --mp-gap: 1rem;
  --mp-radius: 14px;
  --mp-radius-sm: 10px;
  --mp-radius-pill: 999px;
  --mp-shadow-1: 0 1px 2px rgba(20,21,26,.06), 0 1px 3px rgba(20,21,26,.05);
  --mp-shadow-2: 0 6px 18px rgba(20,21,26,.10);
  --mp-shadow-3: 0 16px 40px rgba(20,21,26,.18);
  --mp-container: 1180px;

  display: block;
  font-family: var(--mp-font);
  color: var(--mp-ink);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

*, *::before, *::after { box-sizing: border-box; }

.mp-container { max-width: var(--mp-container); margin: 0 auto; padding-inline: clamp(1rem, 4vw, 2rem); }

/* Buttons */
.mp-btn {
  appearance: none; border: 0; cursor: pointer; font: inherit; font-weight: 650;
  border-radius: var(--mp-radius-pill); padding: .62rem 1.1rem; line-height: 1;
  display: inline-flex; align-items: center; gap: .45rem; white-space: nowrap;
  transition: transform .08s ease, filter .15s ease, background .15s ease;
}
.mp-btn:active { transform: translateY(1px); }
.mp-btn--primary { background: var(--mp-brand); color: #fff; }
.mp-btn--primary:hover { background: var(--mp-brand-700); }
.mp-btn--accent { background: var(--mp-accent); color: #fff; }
.mp-btn--accent:hover { background: var(--mp-accent-700); }
.mp-btn--ghost { background: transparent; color: var(--mp-ink); padding-inline: .5rem; }
.mp-btn--block { width: 100%; justify-content: center; }
.mp-btn[disabled] { background: #c8ccd4; color: #fff; cursor: not-allowed; }

/* Badges */
.mp-badge {
  display: inline-flex; align-items: center; gap: .25rem;
  font-size: var(--mp-fs-xs); font-weight: 700; letter-spacing: .02em;
  padding: .18rem .5rem; border-radius: var(--mp-radius-pill);
}
.mp-badge--sale { background: var(--mp-accent); color: #fff; }
.mp-badge--out { background: #eceef2; color: var(--mp-ink-2); }
.mp-badge--kind { background: rgba(255,255,255,.92); color: var(--mp-brand); }

/* Product tile thumbnail (gradient placeholder, network-free) */
.mp-thumb {
  position: relative; aspect-ratio: 1 / 1; border-radius: var(--mp-radius-sm);
  overflow: hidden; display: grid; place-items: center;
  background: linear-gradient(135deg, var(--mp-brand-050), #fff);
  font-size: clamp(2rem, 7vw, 3rem);
}
.mp-thumb img { width: 100%; height: 100%; object-fit: cover; }

/* Cards */
.mp-card {
  background: var(--mp-surface); border-radius: var(--mp-radius);
  box-shadow: var(--mp-shadow-1); overflow: hidden;
  content-visibility: auto; contain-intrinsic-size: 320px;
}

/* Skeleton shimmer */
.mp-skel { position: relative; overflow: hidden; background: #e9ebef; border-radius: var(--mp-radius-sm); }
.mp-skel::after {
  content: ""; position: absolute; inset: 0; transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.65), transparent);
  animation: mp-shimmer 1.2s infinite;
}
@keyframes mp-shimmer { 100% { transform: translateX(100%); } }

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .mp-skel::after { animation: none; }
  .mp-btn { transition: none; }
}

/* Section heading */
.mp-section-head { display: flex; align-items: baseline; justify-content: space-between; margin: 0 0 1rem; }
.mp-section-head h2 { font-size: var(--mp-fs-lg); margin: 0; letter-spacing: -.01em; }
.mp-link { color: var(--mp-brand); font-weight: 650; font-size: var(--mp-fs-sm); text-decoration: none; }

.mp-price { font-weight: 800; font-size: 1.05rem; letter-spacing: -.01em; }
.mp-price-was { color: var(--mp-ink-2); text-decoration: line-through; font-weight: 500; font-size: var(--mp-fs-sm); margin-left: .4rem; }
.mp-muted { color: var(--mp-ink-2); }
`;

let sheet;
try {
  sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
} catch (_) {
  sheet = null; // older engines: components fall back to a <style> tag
}

/** Adopt the shared theme plus a component-specific stylesheet into a root. */
export function applyTheme(shadowRoot, componentCss = "") {
  if (sheet && "adoptedStyleSheets" in shadowRoot) {
    const own = new CSSStyleSheet();
    own.replaceSync(componentCss);
    shadowRoot.adoptedStyleSheets = [sheet, own];
    return "";
  }
  // Fallback: inline both as a <style> string the caller can prepend.
  return `<style>${css}\n${componentCss}</style>`;
}

/** A lightweight, network-free category visual: emoji + tinted gradient. */
export const CATEGORY_ICON = {
  "Alimentos": "🍞", "Bebidas": "🧃", "Salud": "💊", "Belleza": "💄",
  "Cuidado personal": "🧴", "Hogar": "🏠", "Bebé": "🍼", "Mascotas": "🐾",
  "Tecnología": "📱", "Accesorios": "🎒", "Artesanía": "🧶", "Moda": "👗",
};
export function iconFor(category) { return CATEGORY_ICON[category] || "🛍️"; }

/** Escape untrusted text for safe HTML interpolation. */
export function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
