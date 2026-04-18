/* ============================================================
   ConfigHub — mainactivity.js
   Master switch & addon controller.
   All site-wide addons are registered and toggled here.
   To add a new addon: drop the file in the project and
   register it below (or in addonlinks.json / addonlinks.js).
   ============================================================ */

/* ── ADDON SOURCE SWITCH ──────────────────────────────────────
   'inline'  → addons are defined right here in this file
   'json'    → addons are loaded from addonlinks.json
   'js'      → addons are loaded from addonlinks.js
   Only ONE mode can be active at a time.
   ──────────────────────────────────────────────────────────── */
const ADDON_SOURCE = 'inline'; // 'inline' | 'json' | 'js'

/* ── INLINE ADDON REGISTRY ───────────────────────────────────
   Only used when ADDON_SOURCE === 'inline'.
   enabled: true  → the addon will be loaded
   enabled: false → the addon is skipped entirely
   ──────────────────────────────────────────────────────────── */
const INLINE_ADDONS = [
  {
    id:      'loader',
    src:     'loader.js',
    enabled: false,
  },
  /* ── Add more addons below this line ──
  {
    id:      'analytics',
    src:     'analytics.js',
    enabled: false,
  },
  ──────────────────────────────────────── */
];

/* ============================================================
   CORE — Do not edit below unless you know what you're doing
   ============================================================ */

(async function initMainActivity() {
  let addons = [];

  try {
    if (ADDON_SOURCE === 'inline') {
      addons = INLINE_ADDONS;

    } else if (ADDON_SOURCE === 'json') {
      const res  = await fetch('addonlinks.json');
      const data = await res.json();
      addons = data.addons || [];

    } else if (ADDON_SOURCE === 'js') {
      await loadScript('addonlinks.js');
      // addonlinks.js must expose window.ADDON_LINKS = [...]
      addons = window.ADDON_LINKS || [];
    }
  } catch (err) {
    console.error('[MainActivty] Failed to load addon registry:', err);
    return;
  }

  addons.forEach((addon) => {
    if (!addon.enabled) {
      console.log(`[MainActivty] Skipped: ${addon.id}`);
      return;
    }
    loadScript(addon.src)
      .then(() => console.log(`[MainActivty] Loaded: ${addon.id}`))
      .catch((e) => console.error(`[MainActivty] Error loading ${addon.id}:`, e));
  });
})();

/* ── Helper: inject a <script> tag and return a Promise ── */
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) { resolve(); return; }          // already loaded
    const s   = document.createElement('script');
    s.src     = src;
    s.async   = false;
    s.onload  = resolve;
    s.onerror = () => reject(new Error(`Script load failed: ${src}`));
    document.head.appendChild(s);
  });
}
