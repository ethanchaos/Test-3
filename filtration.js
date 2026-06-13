/* ════════════════════════════════════════════════════════════════
   filtration.js — ConfigHub Smart Filtering Engine
   ─────────────────────────────────────────────────────────────
   Hooks into the render pipeline via MutationObserver (zero
   modifications to app.js) to apply two filters post-render:

   1. EXPIRY FILTER  — always active, cannot be disabled.
      Hides any card where expires_at < device time.

   2. LOCATION FILTER — toggled by the switch in settings.html.
      Hides cards whose locations[] array does not include the
      signed-in user's province.
      Key: "filtration_location_enabled" in localStorage.
      • If off  → show all regardless of location
      • If on + no province saved → show all (can't filter)
      • If on + province known → apply matching

   Province matching is fuzzy — handles:
     Codes:     LP, GP, KZN …
     Full names: Limpopo, Gauteng, KwaZulu-Natal …
   Only the name/meaning matters; case and format are ignored.

   Requires: filtration-bridge.js (loaded before this file)
             window._dvxConfigData populated by the bridge

   Load order:
     <script src="sources.js"></script>
     <script src="filtration-bridge.js"></script>
     <script src="filtration.js"></script>
     <script src="app.js"></script>
   ════════════════════════════════════════════════════════════════ */

(function () {
    'use strict';

    /* ── All 9 SA provinces: code → canonical lowercase full name ── */
    const PROV = {
        'EC'  : 'eastern cape',
        'FS'  : 'free state',
        'GP'  : 'gauteng',
        'KZN' : 'kwazulu-natal',
        'LP'  : 'limpopo',
        'MP'  : 'mpumalanga',
        'NC'  : 'northern cape',
        'NW'  : 'north west',
        'WC'  : 'western cape'
    };

    /* Normalise any province string to canonical lowercase full name */
    function normProv(raw) {
        if (!raw) return null;
        const s = raw.trim().toUpperCase();

        /* Exact code match: LP → limpopo */
        if (PROV[s]) return PROV[s];

        /* Full name or alias — check against all values */
        const lower = raw.trim().toLowerCase().replace(/[\s_\-]+/g, ' ');
        const keys  = Object.keys(PROV);
        for (let i = 0; i < keys.length; i++) {
            const fullName = PROV[keys[i]];
            if (fullName === lower) return fullName;
            /* Partial / fuzzy: "kzn" → "kwazulu-natal" */
            if (fullName.includes(lower) || lower.includes(fullName)) return fullName;
            if (keys[i].toLowerCase() === lower) return fullName;
        }
        /* Return cleaned lowercase as fallback */
        return lower;
    }

    /* ── Read user province from Supabase profile cache ── */
    function getUserProvince() {
        try {
            const raw = localStorage.getItem('dvx_profile_cache');
            if (raw) {
                const p = JSON.parse(raw);
                if (p && p.province) return normProv(p.province);
            }
            return null;
        } catch (e) { return null; }
    }

    /* ── Is location filtering enabled? (default: true) ── */
    function isFilterEnabled() {
        return localStorage.getItem('filtration_location_enabled') !== 'false';
    }

    /* ── Expiry check ── */
    function isExpired(item) {
        if (!item || !item.expires_at) return false;
        try {
            const exp = new Date(item.expires_at);
            if (isNaN(exp.getTime())) return false;
            return Date.now() > exp.getTime();
        } catch (e) { return false; }
    }

    /* ── Location check ── */
    function isAllowedByLocation(item, userProv) {
        /* No locations field → show for everyone */
        if (!Array.isArray(item.locations) || item.locations.length === 0) return true;
        /* Filter disabled → show all */
        if (!isFilterEnabled()) return true;
        /* No user province → can't filter, show all */
        if (!userProv) return true;
        /* Match any entry in locations[] */
        return item.locations.some(function (loc) {
            return normProv(loc) === userProv;
        });
    }

    /* ════════════════════════════════════════════════════════════════
       CORE: apply filters to rendered cards
    ════════════════════════════════════════════════════════════════ */
    function applyFilters() {
        const list = document.getElementById('configList');
        if (!list) return;

        const userProv  = getUserProvince();
        const allItems  = window._dvxConfigData || [];
        const cards     = list.querySelectorAll('.config-item[data-filename]');
        let   visible   = 0;

        cards.forEach(function (card) {
            const filename = card.dataset.filename;
            const item = allItems.find(function (i) {
                return (i.filename || '') === filename;
            });

            /* No matching item in bridge data — leave visible */
            if (!item) { visible++; return; }

            /* 1. Expiry — always applied */
            if (isExpired(item)) {
                card.style.display = 'none';
                card.dataset.filteredReason = 'expired';
                return;
            }

            /* 2. Location */
            if (!isAllowedByLocation(item, userProv)) {
                card.style.display = 'none';
                card.dataset.filteredReason = 'location';
                return;
            }

            /* Passed all checks */
            card.style.display = '';
            delete card.dataset.filteredReason;
            visible++;
        });

        /* Update empty state if nothing visible */
        const emptyState = document.getElementById('emptyState');
        if (emptyState) {
            if (visible === 0 && cards.length > 0) {
                list.classList.add('hidden');
                emptyState.classList.remove('hidden');
                const p = emptyState.querySelector('p');
                if (p) {
                    p.textContent = (isFilterEnabled() && userProv)
                        ? 'No configs available for your province right now. Check back later or disable location filtering in Settings.'
                        : 'No configs available right now. Check back later.';
                }
            } else if (visible > 0) {
                list.classList.remove('hidden');
                emptyState.classList.add('hidden');
            }
        }

        console.log('[filtration.js] Visible: ' + visible + '/' + cards.length
            + ' | Province: ' + (userProv || 'none')
            + ' | Location filter: ' + isFilterEnabled());
    }

    /* Expose publicly so settings.html toggle can call it instantly */
    window.FiltrationEngine = {
        apply  : applyFilters,
        refresh: applyFilters
    };

    /* ── Watch for app.js finishing its render ── */
    function watchForRender() {
        const list = document.getElementById('configList');
        if (!list) {
            document.addEventListener('DOMContentLoaded', watchForRender);
            return;
        }

        const observer = new MutationObserver(function (mutations, obs) {
            const hasCards = list.querySelectorAll('.config-item').length > 0;
            if (hasCards) {
                obs.disconnect();
                /* Tick so app.js finishes its showState call first */
                setTimeout(applyFilters, 0);
            }
        });

        observer.observe(list, { childList: true });
    }

    watchForRender();
    console.log('[filtration.js] Ready.');

})();
