/* ════════════════════════════════════════════════════════════════
   filtration-bridge.js — Data bridge for filtration.js
   ─────────────────────────────────────────────────────────────
   app.js is untouched. This file intercepts the fetch responses
   by wrapping window.fetch BEFORE app.js loads, capturing the
   raw config data into window._dvxConfigData so filtration.js
   can look up item metadata (locations, expires_at) by filename.

   Load order:
     <script src="sources.js"></script>
     <script src="filtration-bridge.js"></script>  ← first
     <script src="filtration.js"></script>           ← second
     <script src="app.js"></script>                  ← untouched, last
   ════════════════════════════════════════════════════════════════ */

(function () {
    'use strict';

    window._dvxConfigData = [];

    const _originalFetch = window.fetch;

    window.fetch = async function (input, init) {
        const response = await _originalFetch.apply(this, arguments);

        try {
            const url = (typeof input === 'string') ? input : (input.url || '');
            const sources = window.JSON_SOURCES || [];

            /* Only intercept calls to known JSON source URLs */
            const isSource = sources.some(function (s) {
                return url.includes(s.split('?')[0].replace(/&.*$/, ''));
            });

            if (isSource) {
                /* Clone so app.js can still consume the original */
                const clone = response.clone();
                clone.json().then(function (data) {
                    const items = Array.isArray(data)
                        ? data
                        : Object.keys(data).map(function (k) {
                            const item = data[k];
                            return Object.assign({ name: k, filename: k }, item);
                        });
                    /* Merge — avoid duplicates by filename */
                    items.forEach(function (item) {
                        const exists = window._dvxConfigData.some(function (e) {
                            return e.filename === item.filename;
                        });
                        if (!exists) window._dvxConfigData.push(item);
                    });
                    console.log('[filtration-bridge] Captured ' + window._dvxConfigData.length + ' items.');
                }).catch(function () {});
            }
        } catch (e) { /* silent — never break app.js */ }

        return response;
    };

    console.log('[filtration-bridge] fetch interceptor active.');

})();
