// Meriplaza brand assets. A cute, monoline mark: a rounded "plaza" tile in
// brand blue with a white "M" whose valley holds a yellow location dot — a
// marketplace pin. Used inline in the header and served as logo + favicon.

// The mark only (square), for favicon and small uses.
export const MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" role="img" aria-label="Meriplaza">
<rect x="1.5" y="1.5" width="45" height="45" rx="12" fill="#1257E0"/>
<path d="M12 34V17.5l12 10 12-10V34" fill="none" stroke="#fff" stroke-width="4.2" stroke-linejoin="round" stroke-linecap="round"/>
<circle cx="24" cy="30.5" r="3.4" fill="#FFC400"/>
</svg>`;

// Full lockup: mark + wordmark, for the header.
export const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 188 48" role="img" aria-label="Meriplaza">
<rect x="1.5" y="1.5" width="45" height="45" rx="12" fill="#1257E0"/>
<path d="M12 34V17.5l12 10 12-10V34" fill="none" stroke="#fff" stroke-width="4.2" stroke-linejoin="round" stroke-linecap="round"/>
<circle cx="24" cy="30.5" r="3.4" fill="#FFC400"/>
<text x="56" y="32" font-family="-apple-system,Segoe UI,Roboto,sans-serif" font-size="24" font-weight="700" fill="#0b0b0f" letter-spacing="-0.5">Meri<tspan fill="#1257E0">plaza</tspan></text>
</svg>`;

// Inline header lockup as HTML (crisper text rendering than SVG <text>).
export const HEADER_LOGO = `<span class="brand-mark">${MARK_SVG}</span><span class="brand-word">Meri<b>plaza</b></span>`;

export const FAVICON_SVG = MARK_SVG;
