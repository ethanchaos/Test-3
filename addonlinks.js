/* ============================================================
   ConfigHub — addonlinks.js
   JS addon registry. Switch ADDON_SOURCE to 'js' in
   mainactivity.js to use this file instead of the inline list.
   Must expose window.ADDON_LINKS so mainactivity.js can read it.
   ============================================================ */

window.ADDON_LINKS = [
  {
    id:      'loadr',
    src:     'loadr.js',
    enabled: true,
  },
  /* ── Add more addons below this line ──
  {
    id:      'analytics',
    src:     'analytics.js',
    enabled: false,
  },
  ──────────────────────────────────────── */
];
