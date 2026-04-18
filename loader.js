/* ============================================================
   ConfigHub — loader.js
   Injects the preloader overlay into any page automatically.
   CSS is injected from loader.css — no HTML changes needed.
   Works on every page that loads mainactivity.js.

   Additions vs original:
   ─ White background / black spinner (via loader.css)
   ─ Smooth overlay enter animation (CSS keyframe)
   ─ Smooth overlay exit: fade + scale-down
   ─ Page-to-page transition: intercepts internal <a> clicks,
     fades out the current page, then navigates.
   ─ Body fade-in on arrival (adds .ch-page-enter to <body>)
   ============================================================ */

(function initLoader() {

  /* ── 1. Inject loader.css ── */
  const link  = document.createElement('link');
  link.rel    = 'stylesheet';
  link.href   = 'loader.css';
  document.head.appendChild(link);

  /* ── 2. Build the preloader overlay ── */
  const overlay = document.createElement('div');
  overlay.id    = 'ch-loader-overlay';
  overlay.innerHTML = `
    <div class="ch-loader-ring">
      <div></div><div></div><div></div><div></div>
    </div>
  `;

  /* ── 3. Build the page-transition veil ── */
  const veil = document.createElement('div');
  veil.id    = 'ch-page-transition';

  /* ── 4. Block scroll while loading ── */
  document.documentElement.style.overflow = 'hidden';

  /* ── 5. Mount both elements ── */
  function mountElements() {
    document.body.insertBefore(overlay, document.body.firstChild);
    document.body.appendChild(veil);
  }

  if (document.body) {
    mountElements();
  } else {
    document.addEventListener('DOMContentLoaded', mountElements);
  }

  /* ── 6. Hide preloader once page is fully loaded ── */
  function hideLoader() {
    /* Restore scroll */
    document.documentElement.style.overflow = '';

    /* Trigger CSS exit animation */
    overlay.classList.add('ch-loader--hidden');

    /* Remove from DOM after animation completes */
    overlay.addEventListener('animationend', () => {
      overlay.remove();
    }, { once: true });

    /* Fallback removal in case animationend doesn't fire */
    setTimeout(() => { overlay.remove(); }, 700);
  }

  if (document.readyState === 'complete') {
    /* Already loaded (e.g. cached) — brief pause for visual polish */
    setTimeout(hideLoader, 250);
  } else {
    window.addEventListener('load', () => setTimeout(hideLoader, 250));
  }

  /* ── 7. Body entrance animation on every page load ── */
  document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('ch-page-enter');
    document.body.addEventListener('animationend', () => {
      document.body.classList.remove('ch-page-enter');
    }, { once: true });
  });

  /* ── 8. Page-to-page transition ──────────────────────────────
     Intercepts clicks on same-origin <a> links.
     Fades out the current page via the veil, then navigates.
     The new page shows the preloader (steps 2–6 above), giving
     a seamless black-spinner-on-white transition between pages.
     ────────────────────────────────────────────────────────── */
  document.addEventListener('click', function handleLinkClick(e) {

    /* Walk up the DOM to find an <a> tag */
    let el = e.target;
    while (el && el.tagName !== 'A') el = el.parentElement;
    if (!el) return;

    const href = el.getAttribute('href');
    if (!href) return;

    /* Skip: external links, new-tab, anchors, non-http, special keys */
    const isExternal   = el.hostname && el.hostname !== location.hostname;
    const opensNewTab  = el.target === '_blank';
    const isAnchorOnly = href.startsWith('#');
    const isSpecial    = href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:');
    const hasModifier  = e.ctrlKey || e.metaKey || e.shiftKey || e.altKey;

    if (isExternal || opensNewTab || isAnchorOnly || isSpecial || hasModifier) return;

    /* Same-origin navigation — intercept */
    e.preventDefault();

    const destination = el.href; // full resolved URL

    /* Activate the veil (CSS transition kicks in) */
    veil.classList.add('ch-pt--active');

    /* After the veil fades in, navigate */
    setTimeout(() => {
      window.location.href = destination;
    }, 300); /* matches CSS transition duration (0.28s) + tiny buffer */

  }, true /* capture phase so it fires before any other click handlers */);

})();
