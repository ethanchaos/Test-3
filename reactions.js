/* ════════════════════════════════════════════════
   reactions.js  —  Per-file Emoji Reactions
   ────────────────────────────────────────────────
   Add ONE line AFTER deovex.js in tls.html / tnl.html:
       <script src="reactions.js"></script>

   • Inherits GITHUB_USERNAME / REPO_NAME / TOKEN
     from uploaderapi.js (loaded on Netlify CDN)
   • Saves all reaction counts to reactions.json
     on the same GitHub repo (ethanchaos/Test-3)
   • localStorage as offline cache + instant feel
   • Keyed by item.filename — same ID method as share
   • 6 emojis: 🥰 😁 😃 😭 😩 👎
   • Thin strip at bottom of card — no layout impact
   • Tapping card body (not share/download) → panel
   • One reaction per browser per file (toggle to undo)
   ════════════════════════════════════════════════ */

(function initReactions() {
    'use strict';

    /* ── Emoji set ── */
    const EMOJIS = [
        { emoji: '🥰', label: 'Love'  },
        { emoji: '😁', label: 'Great' },
        { emoji: '😃', label: 'Happy' },
        { emoji: '😭', label: 'Sad'   },
        { emoji: '😩', label: 'Ugh'   },
        { emoji: '👎', label: 'Nope'  },
    ];

    /* ── GitHub credentials — from uploaderapi.js globals ── */
    const GH_USER  = (typeof GITHUB_USERNAME !== 'undefined') ? GITHUB_USERNAME : 'ethanchaos';
    const GH_REPO  = (typeof REPO_NAME       !== 'undefined') ? REPO_NAME       : 'Test-3';
    const GH_TOKEN = (typeof TOKEN            !== 'undefined') ? TOKEN           : '';
    const API_URL  = `https://api.github.com/repos/${GH_USER}/${GH_REPO}/contents/reactions.json`;

    /* ── localStorage keys ── */
    const LS_DATA = 'dvx_rct_data';   // mirror of reactions.json
    const LS_USER = 'dvx_rct_user';   // { [filename]: emoji } per device

    /* ── Runtime state ── */
    let _data   = null;   // { [filename]: { counts:{emoji:n}, total:n } }
    let _sha    = null;   // GitHub blob SHA for next PUT
    let _saving = false;
    let _dirty  = false;

    /* ════════════════════════════
       LOCAL STORAGE HELPERS
    ════════════════════════════ */

    function lsGet(k) {
        try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; }
    }
    function lsSet(k, v) {
        try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
    }

    function getUserPick(key) { return (lsGet(LS_USER) || {})[key] || null; }
    function setUserPick(key, emoji) {
        const u = lsGet(LS_USER) || {};
        if (emoji) u[key] = emoji; else delete u[key];
        lsSet(LS_USER, u);
    }

    function ensureEntry(key) {
        if (!_data[key]) _data[key] = { counts: {}, total: 0 };
    }

    /* ════════════════════════════
       GITHUB DATA LAYER
    ════════════════════════════ */

    async function loadData() {
        if (_data) return _data;

        // Start from local cache immediately
        _data = lsGet(LS_DATA) || {};

        if (!GH_TOKEN) return _data;

        try {
            const res = await fetch(API_URL + '?_t=' + Date.now(), {
                headers: { Authorization: `token ${GH_TOKEN}` }
            });

            if (res.status === 200) {
                const json    = await res.json();
                _sha  = json.sha;
                _data = JSON.parse(atob(json.content.replace(/\n/g, '')));
                lsSet(LS_DATA, _data);

            } else if (res.status === 404) {
                // First run — reactions.json doesn't exist yet
                _data = {};
                _sha  = null;
            }
        } catch (err) {
            console.warn('[reactions.js] load failed, using local cache:', err.message);
        }

        return _data;
    }

    async function saveData() {
        lsSet(LS_DATA, _data);          // always persist locally first
        if (!GH_TOKEN) return;
        if (_saving)   { _dirty = true; return; }

        _saving = true;
        _dirty  = false;

        try {
            const content = btoa(unescape(encodeURIComponent(JSON.stringify(_data, null, 2))));
            const body    = { message: 'Update reactions.json', content };
            if (_sha) body.sha = _sha;

            const res = await fetch(API_URL, {
                method:  'PUT',
                headers: {
                    Authorization:  `token ${GH_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                const j = await res.json();
                _sha = j.content?.sha || _sha;
            } else {
                console.warn('[reactions.js] GitHub PUT', res.status);
            }
        } catch (err) {
            console.warn('[reactions.js] save error:', err.message);
        }

        _saving = false;
        if (_dirty) saveData();     // flush any changes that queued during save
    }

    async function recordReaction(fileKey, emoji) {
        await loadData();
        ensureEntry(fileKey);

        const prev = getUserPick(fileKey);
        const rec  = _data[fileKey];

        if (prev === emoji) {
            // Toggle off — remove this reaction
            rec.counts[emoji] = Math.max(0, (rec.counts[emoji] || 1) - 1);
            if (!rec.counts[emoji]) delete rec.counts[emoji];
            rec.total = Math.max(0, rec.total - 1);
            setUserPick(fileKey, null);

        } else {
            if (prev) {
                // Switch emoji — total unchanged
                rec.counts[prev] = Math.max(0, (rec.counts[prev] || 1) - 1);
                if (!rec.counts[prev]) delete rec.counts[prev];
            } else {
                // Brand-new reactor
                rec.total = (rec.total || 0) + 1;
            }
            rec.counts[emoji] = (rec.counts[emoji] || 0) + 1;
            setUserPick(fileKey, emoji);
        }

        saveData();   // non-blocking
        return { counts: rec.counts, total: rec.total };
    }

    function getFileCounts(fileKey) {
        if (!_data || !_data[fileKey]) return { counts: {}, total: 0 };
        return _data[fileKey];
    }

    /* ════════════════════════════
       CSS
    ════════════════════════════ */

    function injectStyles() {
        if (document.getElementById('dvx-rct-style')) return;
        const s = document.createElement('style');
        s.id = 'dvx-rct-style';
        s.textContent = `

/* ── Thin reaction strip at card bottom ── */
.dvx-rct-strip {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px 0 0;
    margin-top: 6px;
    border-top: 1px solid rgba(0,0,0,0.07);
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    width: 100%;
    min-height: 0;
    box-sizing: border-box;
}
[data-theme="black"] .dvx-rct-strip,
[data-theme="gray"]  .dvx-rct-strip {
    border-top-color: rgba(255,255,255,0.055);
}
.dvx-rct-strip-emojis {
    font-size: 0.78rem;
    letter-spacing: -1px;
    line-height: 1;
}
.dvx-rct-strip-count {
    font-family: var(--font-body, 'DM Sans', sans-serif);
    font-size: 0.65rem;
    color: var(--text-light, #888);
    flex: 1;
}
.dvx-rct-strip-cta {
    font-family: var(--font-body, 'DM Sans', sans-serif);
    font-size: 0.62rem;
    color: var(--text-light, #aaa);
    opacity: 0.6;
    transition: opacity 0.15s;
}
.dvx-rct-strip:hover .dvx-rct-strip-cta { opacity: 1; }

/* ── Overlay ── */
#dvx-rct-overlay {
    position: fixed;
    inset: 0;
    z-index: 99992;
    background: rgba(0,0,0,0.84);
    backdrop-filter: blur(7px);
    -webkit-backdrop-filter: blur(7px);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    animation: dvxRO_in 0.22s ease;
    padding-bottom: env(safe-area-inset-bottom);
}
@keyframes dvxRO_in { from { opacity: 0; } to { opacity: 1; } }

/* ── Bottom sheet ── */
#dvx-rct-panel {
    width: 100%;
    max-width: 480px;
    background: #111111;
    border-radius: 22px 22px 0 0;
    border: 1px solid rgba(255,255,255,0.09);
    border-bottom: none;
    padding: 0 0 24px;
    box-shadow: 0 -8px 48px rgba(0,0,0,0.7);
    animation: dvxRP_up 0.3s cubic-bezier(0.34,1.18,0.64,1);
    overflow: hidden;
}
@keyframes dvxRP_up {
    from { transform: translateY(100%); opacity: 0.3; }
    to   { transform: translateY(0);    opacity: 1;   }
}
.dvx-rct-handle {
    width: 38px; height: 4px;
    background: rgba(255,255,255,0.17);
    border-radius: 2px;
    margin: 13px auto 0;
}

/* ── Header ── */
.dvx-rct-hdr {
    padding: 12px 20px 11px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
}
.dvx-rct-hdr-label {
    font-family: 'Oxanium', var(--font-display, sans-serif);
    font-size: 0.63rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.3);
}
.dvx-rct-hdr-name {
    font-family: 'Oxanium', var(--font-display, sans-serif);
    font-size: 0.88rem;
    font-weight: 600;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 1px;
}
.dvx-rct-hdr-total {
    font-family: var(--font-body, 'DM Sans', sans-serif);
    font-size: 0.69rem;
    color: rgba(255,255,255,0.37);
    margin-top: 3px;
}

/* ── 3×2 grid ── */
.dvx-rct-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    padding: 13px 13px 4px;
}

/* ── Emoji button ── */
.dvx-rct-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    background: rgba(255,255,255,0.05);
    border: 1.5px solid rgba(255,255,255,0.08);
    border-radius: 15px;
    padding: 12px 6px 10px;
    cursor: pointer;
    transition: all 0.17s cubic-bezier(0.4,0,0.2,1);
    position: relative;
    overflow: hidden;
    -webkit-tap-highlight-color: transparent;
}
.dvx-rct-btn:hover {
    background: rgba(255,255,255,0.10);
    border-color: rgba(255,255,255,0.22);
    transform: translateY(-2px);
}
.dvx-rct-btn:active { transform: scale(0.91); }
.dvx-rct-btn.dvx-rct-sel {
    background: rgba(255,255,255,0.13);
    border-color: rgba(255,255,255,0.42);
    box-shadow: 0 0 16px rgba(255,255,255,0.07);
}
.dvx-rct-btn.dvx-rct-sel .dvx-rct-emoji {
    animation: dvxRE_bounce 0.32s cubic-bezier(0.34,1.7,0.64,1);
}
@keyframes dvxRE_bounce {
    0%   { transform: scale(1); }
    50%  { transform: scale(1.38); }
    100% { transform: scale(1); }
}
.dvx-rct-btn::after {
    content: '';
    position: absolute; inset: 0;
    background: radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 65%);
    opacity: 0; transition: opacity 0.22s; pointer-events: none;
}
.dvx-rct-btn.dvx-rct-sel::after { opacity: 1; }
.dvx-rct-emoji { font-size: 1.75rem; line-height: 1; display: block; }
.dvx-rct-lbl {
    font-family: var(--font-body, 'DM Sans', sans-serif);
    font-size: 0.62rem;
    color: rgba(255,255,255,0.42);
    text-align: center;
}
.dvx-rct-cnt {
    font-family: var(--font-body, 'DM Sans', sans-serif);
    font-size: 0.7rem; font-weight: 600;
    color: rgba(255,255,255,0.72);
    min-height: 1em;
}
.dvx-rct-btn.dvx-rct-sel .dvx-rct-cnt { color: #fff; }

/* ── Panel footer ── */
.dvx-rct-foot {
    padding: 8px 14px 0;
    text-align: center;
    font-family: var(--font-body, 'DM Sans', sans-serif);
    font-size: 0.62rem;
    color: rgba(255,255,255,0.2);
}
        `;
        document.head.appendChild(s);
    }

    /* ════════════════════════════
       STRIP
    ════════════════════════════ */

    function buildStrip(fileKey) {
        const strip = document.createElement('div');
        strip.className    = 'dvx-rct-strip';
        strip.dataset.rkey = fileKey;
        refreshStrip(strip, fileKey);
        return strip;
    }

    function refreshStrip(strip, fileKey) {
        const { counts, total } = getFileCounts(fileKey);
        const topE = EMOJIS
            .filter(e => (counts[e.emoji] || 0) > 0)
            .sort((a, b) => (counts[b.emoji] || 0) - (counts[a.emoji] || 0))
            .slice(0, 3)
            .map(e => e.emoji)
            .join('');

        if (total === 0) {
            strip.innerHTML = `
                <span class="dvx-rct-strip-emojis" style="opacity:.28">🥰😁😃</span>
                <span class="dvx-rct-strip-count"></span>
                <span class="dvx-rct-strip-cta">React</span>`;
        } else {
            strip.innerHTML = `
                <span class="dvx-rct-strip-emojis">${topE}</span>
                <span class="dvx-rct-strip-count">${total} ${total === 1 ? 'reaction' : 'reactions'}</span>
                <span class="dvx-rct-strip-cta">+ React</span>`;
        }
    }

    /* ════════════════════════════
       PANEL
    ════════════════════════════ */

    function esc(str) {
        return (str || '').replace(/[&<>'"]/g, m =>
            ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[m])
        );
    }

    function openPanel(fileKey, displayName) {
        if (document.getElementById('dvx-rct-overlay')) return;

        const userPick          = getUserPick(fileKey);
        const { counts, total } = getFileCounts(fileKey);

        const totalTxt = total === 0
            ? 'Be the first to react!'
            : `${total} ${total === 1 ? 'person' : 'people'} reacted`;

        const overlay = document.createElement('div');
        overlay.id = 'dvx-rct-overlay';
        overlay.innerHTML = `
            <div id="dvx-rct-panel">
                <div class="dvx-rct-handle"></div>
                <div class="dvx-rct-hdr">
                    <div class="dvx-rct-hdr-label">Reactions</div>
                    <div class="dvx-rct-hdr-name">${esc(displayName)}</div>
                    <div class="dvx-rct-hdr-total" id="dvx-rct-total">${totalTxt}</div>
                </div>
                <div class="dvx-rct-grid">
                    ${EMOJIS.map(e => `
                        <button class="dvx-rct-btn${userPick === e.emoji ? ' dvx-rct-sel' : ''}"
                                data-emoji="${e.emoji}" aria-label="${e.label}">
                            <span class="dvx-rct-emoji">${e.emoji}</span>
                            <span class="dvx-rct-lbl">${e.label}</span>
                            <span class="dvx-rct-cnt">${(counts[e.emoji] || 0) > 0 ? counts[e.emoji] : ''}</span>
                        </button>`).join('')}
                </div>
                <div class="dvx-rct-foot">Tap to react · Tap again to undo</div>
            </div>`;

        document.body.appendChild(overlay);

        overlay.addEventListener('click', e => { if (e.target === overlay) closePanel(); });

        overlay.querySelectorAll('.dvx-rct-btn').forEach(btn => {
            btn.addEventListener('click', async function (e) {
                e.stopPropagation();
                const emoji  = this.dataset.emoji;
                const result = await recordReaction(fileKey, emoji);

                overlay.querySelectorAll('.dvx-rct-btn').forEach(b => {
                    b.classList.remove('dvx-rct-sel');
                    const c = result.counts[b.dataset.emoji] || 0;
                    b.querySelector('.dvx-rct-cnt').textContent = c > 0 ? c : '';
                });

                const pick = getUserPick(fileKey);
                if (pick) {
                    const sel = overlay.querySelector(`[data-emoji="${pick}"]`);
                    if (sel) sel.classList.add('dvx-rct-sel');
                }

                const t = result.total;
                document.getElementById('dvx-rct-total').textContent = t === 0
                    ? 'Be the first to react!'
                    : `${t} ${t === 1 ? 'person' : 'people'} reacted`;

                const strip = document.querySelector(`.dvx-rct-strip[data-rkey="${CSS.escape(fileKey)}"]`);
                if (strip) refreshStrip(strip, fileKey);
            });
        });
    }

    function closePanel() {
        const o = document.getElementById('dvx-rct-overlay');
        if (!o) return;
        o.style.animation = 'dvxRO_in 0.17s ease reverse';
        setTimeout(() => { if (o.parentNode) o.parentNode.removeChild(o); }, 150);
    }

    /* ════════════════════════════
       CARD ATTACHMENT
    ════════════════════════════ */

    async function attachToCard(card) {
        if (card.dataset.rctAttached) return;
        card.dataset.rctAttached = '1';

        const fileKey     = card.dataset.filename || card.dataset.name || '';
        const displayName = card.dataset.name     || fileKey;
        if (!fileKey) return;

        await loadData();

        const configText = card.querySelector('.config-text');
        if (configText) {
            const strip = buildStrip(fileKey);
            configText.appendChild(strip);

            strip.addEventListener('click', e => {
                e.stopPropagation();
                openPanel(fileKey, displayName);
            });
        }

        // Card body tap (not share/download buttons, not strip) → panel
        card.addEventListener('click', function (e) {
            if (e.target.closest('.file-actions'))  return;
            if (e.target.closest('.dvx-rct-strip')) return;
            openPanel(fileKey, displayName);
        });
    }

    function scanCards() {
        document.querySelectorAll('.config-item[data-filename]').forEach(card => attachToCard(card));
    }

    function watchDOM() {
        scanCards();
        new MutationObserver(scanCards).observe(document.body, { childList: true, subtree: true });
    }

    /* ════════════════════════════
       BOOT
    ════════════════════════════ */

    injectStyles();
    loadData();   // background prefetch

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', watchDOM);
    } else {
        watchDOM();
    }

    window.dvxReactions = { openPanel, getFileCounts, loadData };

})();
