/* ════════════════════════════════════════════════
   deovex.js — Universal Shared JS (ConfigHub & Deovex)
   Drop this on ANY config page. Each page just
   defines its own filter constants BEFORE loading:

       const VPN_SEARCH_TERMS = ['tls', ...];
       const VPN_DISPLAY_NAME = "TLS Tunnel";
       const VPN_ICON = "fas fa-lock";

   Handles: nav toggle, bottom nav active state,
            download logic, fetch/render engine,
            card share panel (inline, no deps),
            and ad system.
   Requires: sources.js (sets window.JSON_SOURCES)
   ════════════════════════════════════════════════ */


/* ── Boot MainActivity (addon/plugin controller) ── */
const _maScript = document.createElement('script');
_maScript.src = 'mainactivity.js';
document.head.appendChild(_maScript);


/* ── Navigation Menu Toggle ── */
(function initNav() {
    const navToggle    = document.getElementById('navToggle');
    const dropdownMenu = document.getElementById('dropdownMenu');
    if (!navToggle || !dropdownMenu) return;

    navToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        navToggle.classList.toggle('active');
        dropdownMenu.classList.toggle('active');
    });

    document.addEventListener('click', (event) => {
        if (!event.target.closest('.nav-container') &&
            !event.target.closest('.dropdown-menu')) {
            navToggle.classList.remove('active');
            dropdownMenu.classList.remove('active');
        }
    });

    dropdownMenu.addEventListener('click', () => {
        navToggle.classList.remove('active');
        dropdownMenu.classList.remove('active');
    });
})();


/* ── Bottom Navigation Active State (from TLS app.js) ── */
(function initBottomNav() {
    const items = document.querySelectorAll('.bottom-nav-item:not(.bottom-nav-upload)');
    items.forEach(item => {
        item.addEventListener('click', function () {
            items.forEach(i => i.classList.remove('active'));
            this.classList.add('active');
        });
    });
})();


/* ── Download Logic ── */

function sanitizeFilename(filename) {
    if (!filename) return 'config';
    return filename.trim();
}

function fixGitHubUrl(url) {
    if (!url) return url;
    if (url.includes('github.com') && url.includes('/blob/')) {
        return url
            .replace('github.com', 'raw.githubusercontent.com')
            .replace('/blob/', '/');
    }
    return url;
}

async function downloadFile(url, filename) {
    if (typeof window._adOnDownload === 'function') {
        window._adOnDownload();
    }

    filename = sanitizeFilename(filename);
    url = fixGitHubUrl(url);

    if (url && !/^(https?:|blob:|data:)/i.test(url)) {
        const source = (window.JSON_SOURCES || []).find(s => s.includes('raw.githubusercontent.com'));
        if (source) {
            const base = source.replace(/\/[^/]+$/, '/uploads/');
            url = base + url;
        } else {
            url = new URL(url, window.location.href).href;
        }
    }

    if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(
            JSON.stringify({ type: 'DOWNLOAD_FILE', url, filename })
        );
        return;
    }

    if (window.Android && typeof window.Android.downloadFile === 'function') {
        window.Android.downloadFile(url, filename);
        return;
    }

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok: ' + response.status);

        const blob = await response.blob();
        const typedBlob = new Blob([blob], { type: 'application/octet-stream' });
        const blobUrl   = URL.createObjectURL(typedBlob);

        const a = document.createElement('a');
        a.href     = blobUrl;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
            URL.revokeObjectURL(blobUrl);
            if (a.parentNode) a.parentNode.removeChild(a);
        }, 1000);

    } catch (err) {
        console.warn('[deovex.js] Blob download failed, falling back:', err);
        try {
            const a = document.createElement('a');
            a.href     = url;
            a.download = filename;
            a.style.display = 'none';
            a.rel = 'noopener noreferrer';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { if (a.parentNode) a.parentNode.removeChild(a); }, 500);
        } catch (fallbackErr) {
            window.open(url, '_blank');
        }
    }
}

function escapeHtml(str) {
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}


/* ── Fetch & Render Engine ── */
(function initFetchEngine() {
    const loadingSpinner = document.getElementById('loadingSpinner');
    const emptyState     = document.getElementById('emptyState');
    const errorState     = document.getElementById('errorState');
    const configList     = document.getElementById('configList');
    const retryButton    = document.getElementById('retryButton');

    if (!configList) return;

    let configData   = [];
    let filteredData = [];

    function showState(state) {
        loadingSpinner.classList.add('hidden');
        emptyState.classList.add('hidden');
        errorState.classList.add('hidden');
        configList.classList.add('hidden');
        if      (state === 'loading') loadingSpinner.classList.remove('hidden');
        else if (state === 'empty')   emptyState.classList.remove('hidden');
        else if (state === 'error')   errorState.classList.remove('hidden');
        else if (state === 'content') configList.classList.remove('hidden');
    }

    function normalizeVPN(s) { return s ? s.toLowerCase().trim() : ''; }

    function isTargetVPN(item) {
        if (!VPN_SEARCH_TERMS || VPN_SEARCH_TERMS.length === 0 || VPN_SEARCH_TERMS[0] === '*') {
            return true;
        }
        const fields = [item.vpn, item.name, item.filename];
        return fields.some(field => {
            const norm = normalizeVPN(field);
            return VPN_SEARCH_TERMS.some(term => norm.includes(term.toLowerCase()));
        });
    }

    function parseDataJson(data) {
        if (Array.isArray(data)) return data;
        return Object.keys(data).map(k => {
            const item = data[k];
            return {
                name:     item.name     || k,
                vpn:      item.vpn      || 'unknown',
                filename: item.filename || k,
                url:      item.url      || null,
                date:     item.date     || 'Unknown Date',
                size:     item.size     || ''
            };
        });
    }

    function addBust(url) {
        const sep = url.includes('?') ? '&' : '?';
        return url + sep + '_t=' + Date.now();
    }

    async function fetchWithTimeout(url, timeoutMs = 10000) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(addBust(url), { signal: controller.signal });
            clearTimeout(timeoutId);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        } catch (err) {
            clearTimeout(timeoutId);
            if (err.name === 'AbortError') throw new Error(`Timeout after ${timeoutMs}ms`);
            throw err;
        }
    }

    async function fetchConfigData() {
        showState('loading');
        try {
            const sources = Array.isArray(window.JSON_SOURCES)
                ? window.JSON_SOURCES.filter(s => typeof s === 'string' && s.trim())
                : [];

            if (sources.length === 0) {
                throw new Error('No sources defined in sources.js.');
            }

            console.log('[deovex.js] Fetching from sources:', sources);

            const results = await Promise.allSettled(
                sources.map(url => fetchWithTimeout(url))
            );

            configData = [];
            results.forEach((result, idx) => {
                if (result.status === 'fulfilled') {
                    const parsed = parseDataJson(result.value);
                    console.log(`[deovex.js] Loaded ${parsed.length} items from ${sources[idx]}`);
                    configData.push(...parsed);
                } else {
                    console.error(`[deovex.js] Failed to load ${sources[idx]}:`, result.reason.message);
                }
            });

            console.log(`[deovex.js] Total configs loaded: ${configData.length}`);

            if (configData.length === 0) {
                showState('empty');
                const emptyMsg = document.querySelector('#emptyState p');
                if (emptyMsg) {
                    emptyMsg.innerHTML = 'No configurations found. Check the console for errors.';
                }
            } else {
                filterAndRenderConfigs();
            }
        } catch (error) {
            console.error('[deovex.js] Fetch error:', error.message);
            showState('error');
            const errorMsg = document.querySelector('#errorState p');
            if (errorMsg) {
                errorMsg.innerHTML = `Error: ${error.message}. Please check your internet connection and try again.`;
            }
        }
    }

    function filterAndRenderConfigs() {
        filteredData = configData.filter(item => isTargetVPN(item));
        console.log(`[deovex.js] After filtering, ${filteredData.length} items match.`);
        renderConfigItems();
    }

    function escapeAttr(str) {
        return str.replace(/[&<>'"]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            if (m === "'") return '&#39;';
            if (m === '"') return '&quot;';
            return m;
        });
    }

    function renderConfigItems() {
        configList.innerHTML = '';
        if (filteredData.length === 0) {
            showState('empty');
            return;
        }

        filteredData.forEach(item => {
            const downloadUrl = item.url || item.filename;
            const div = document.createElement('div');
            div.className = 'config-item';
            div.dataset.filename = item.filename || '';
            div.dataset.url      = downloadUrl;
            div.dataset.name     = item.name || item.filename || '';
            div.innerHTML = `
                <div class="config-text">
                    <h3>${escapeHtml(item.name || item.filename)}</h3>
                    <div class="config-meta">
                        <span class="config-badge">
                            <i class="${VPN_ICON}"></i>${VPN_DISPLAY_NAME}
                        </span>
                        <span class="config-date">
                            <i class="fas fa-calendar-alt"></i>${item.date}
                        </span>
                        ${item.size ? `<span class="config-date"><i class="fas fa-hdd"></i>${item.size}</span>` : ''}
                    </div>
                </div>
                <div class="file-actions">
                    <button class="share-btn"
                            data-url="${escapeAttr(downloadUrl)}"
                            data-filename="${escapeAttr(item.filename)}"
                            data-name="${escapeAttr(item.name || item.filename)}"
                            title="Share ${escapeAttr(item.name || item.filename)}">
                        <i class="fas fa-share-alt"></i>
                    </button>
                    <button class="download-btn"
                            data-url="${escapeAttr(downloadUrl)}"
                            data-filename="${escapeAttr(item.filename)}"
                            title="Download ${escapeAttr(item.name || item.filename)}">
                        <i class="fas fa-download"></i>
                    </button>
                </div>
            `;
            configList.appendChild(div);
        });

        // Download listeners
        configList.querySelectorAll('.download-btn').forEach(btn => {
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                downloadFile(this.dataset.url, this.dataset.filename);
            });
        });

        // Share listeners
        configList.querySelectorAll('.share-btn').forEach(btn => {
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                showSharePanel(this.dataset.url, this.dataset.filename, this.dataset.name);
            });
        });

        showState('content');
        handleConfigParam();
    }

    /* ── ?config= URL Param: Highlight & Scroll ── */
    function handleConfigParam() {
        const params  = new URLSearchParams(window.location.search);
        const target  = params.get('config');
        if (!target) return;

        const normalise = s => (s || '').trim().toLowerCase();
        const needle    = normalise(target);

        const cards = configList.querySelectorAll('.config-item[data-filename]');
        let matched = null;

        for (const card of cards) {
            if (normalise(card.dataset.filename) === needle) { matched = card; break; }
        }
        if (!matched) {
            for (const card of cards) {
                if (normalise(card.dataset.filename).includes(needle) ||
                    needle.includes(normalise(card.dataset.filename))) {
                    matched = card; break;
                }
            }
        }

        if (!matched) {
            console.warn('[deovex.js] ?config= target not found:', target);
            return;
        }

        console.log('[deovex.js] Highlighting card for config param:', target);
        matched.classList.add('config-item--highlighted');
        setTimeout(() => {
            matched.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 120);
    }

    if (retryButton) retryButton.addEventListener('click', fetchConfigData);
    document.addEventListener('DOMContentLoaded', fetchConfigData);
})();


/* ════════════════════════════════════════════════
   SHARE PANEL — Inline (no external card-overlay.js)
   Shows when user taps the share button on a card.
   Offers: Copy Link, Native Share (Web Share API),
   WhatsApp, Telegram deep links.
   ════════════════════════════════════════════════ */
(function initShareSystem() {

    /* ── Inject share panel CSS once ── */
    function injectShareStyles() {
        if (document.getElementById('dvx-share-style')) return;
        const style = document.createElement('style');
        style.id = 'dvx-share-style';
        style.textContent = `
            /* Share Button on cards */
            .share-btn {
                background: linear-gradient(135deg, rgba(0,200,212,0.06), rgba(30,143,255,0.04));
                border: 1px solid rgba(0,200,212,0.2);
                border-radius: 10px;
                padding: 12px 14px;
                cursor: pointer;
                transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
                flex-shrink: 0;
                min-width: 46px;
                min-height: 46px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .share-btn i {
                color: #00c8d4;
                font-size: 1rem;
                transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
            }
            .share-btn:hover {
                background: linear-gradient(135deg, rgba(0,200,212,0.18), rgba(30,143,255,0.12));
                border-color: #00c8d4;
                transform: scale(1.07);
                box-shadow: 0 0 14px rgba(0,200,212,0.22);
            }
            .share-btn:hover i { transform: translateY(-1px); }
            .share-btn:active  { transform: scale(0.94); }

            /* Overlay backdrop */
            #dvx-share-overlay {
                position: fixed;
                inset: 0;
                z-index: 88888;
                background: rgba(0,0,0,0.72);
                backdrop-filter: blur(6px);
                -webkit-backdrop-filter: blur(6px);
                display: flex;
                align-items: flex-end;
                justify-content: center;
                animation: dvxFadeIn 0.25s ease;
                padding-bottom: env(safe-area-inset-bottom);
            }
            @keyframes dvxFadeIn {
                from { opacity: 0; }
                to   { opacity: 1; }
            }

            /* Bottom sheet panel */
            #dvx-share-panel {
                width: 100%;
                max-width: 480px;
                background: #111827;
                border-radius: 22px 22px 0 0;
                border: 1px solid rgba(0,200,212,0.15);
                border-bottom: none;
                padding: 0 0 24px;
                box-shadow: 0 -8px 40px rgba(0,0,0,0.6), 0 0 0 0.5px rgba(0,200,212,0.08) inset;
                animation: dvxSlideUp 0.3s cubic-bezier(0.34,1.2,0.64,1);
                overflow: hidden;
            }
            @keyframes dvxSlideUp {
                from { transform: translateY(100%); opacity: 0.5; }
                to   { transform: translateY(0);    opacity: 1; }
            }

            /* Drag handle */
            #dvx-share-handle {
                width: 40px;
                height: 4px;
                background: rgba(255,255,255,0.15);
                border-radius: 2px;
                margin: 14px auto 0;
            }

            /* Panel header */
            #dvx-share-header {
                padding: 16px 20px 14px;
                border-bottom: 1px solid rgba(255,255,255,0.06);
            }
            #dvx-share-title {
                font-family: 'Oxanium', sans-serif;
                font-size: 0.72rem;
                font-weight: 600;
                color: #00c8d4;
                letter-spacing: 0.1em;
                text-transform: uppercase;
                margin-bottom: 4px;
            }
            #dvx-share-name {
                font-family: 'Oxanium', sans-serif;
                font-size: 1rem;
                font-weight: 600;
                color: #e8eaf0;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            /* URL copy row */
            #dvx-share-url-row {
                display: flex;
                align-items: center;
                gap: 8px;
                margin: 14px 20px 0;
                background: #0a0d14;
                border: 1px solid rgba(0,200,212,0.12);
                border-radius: 10px;
                padding: 10px 12px;
            }
            #dvx-share-url-text {
                flex: 1;
                font-family: 'DM Sans', sans-serif;
                font-size: 0.8rem;
                color: #6b7a90;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            #dvx-copy-btn {
                background: rgba(0,200,212,0.1);
                border: 1px solid rgba(0,200,212,0.25);
                border-radius: 7px;
                color: #00c8d4;
                font-family: 'DM Sans', sans-serif;
                font-size: 0.75rem;
                font-weight: 600;
                padding: 6px 12px;
                cursor: pointer;
                transition: all 0.2s ease;
                white-space: nowrap;
                display: flex;
                align-items: center;
                gap: 5px;
            }
            #dvx-copy-btn:hover {
                background: rgba(0,200,212,0.2);
                border-color: #00c8d4;
            }
            #dvx-copy-btn.copied {
                background: rgba(38,166,154,0.2);
                border-color: #26a69a;
                color: #26a69a;
            }

            /* Share actions grid */
            #dvx-share-actions {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 10px;
                padding: 16px 20px 0;
            }
            .dvx-share-action {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 7px;
                background: #0f1420;
                border: 1px solid rgba(255,255,255,0.06);
                border-radius: 14px;
                padding: 14px 8px;
                cursor: pointer;
                transition: all 0.25s cubic-bezier(0.4,0,0.2,1);
                text-decoration: none;
                -webkit-tap-highlight-color: transparent;
            }
            .dvx-share-action:hover {
                background: #161f30;
                border-color: rgba(0,200,212,0.2);
                transform: translateY(-2px);
            }
            .dvx-share-action:active { transform: scale(0.94); }
            .dvx-share-action .dvx-action-icon {
                width: 44px;
                height: 44px;
                border-radius: 14px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.25rem;
            }
            .dvx-share-action .dvx-action-label {
                font-family: 'DM Sans', sans-serif;
                font-size: 0.7rem;
                font-weight: 600;
                color: #b0b8c8;
                text-align: center;
                line-height: 1.2;
            }

            /* Action colour variants */
            .dvx-action-native  .dvx-action-icon { background: rgba(0,200,212,0.12); color: #00c8d4; }
            .dvx-action-whatsapp .dvx-action-icon { background: rgba(37,211,102,0.12); color: #25d366; }
            .dvx-action-telegram .dvx-action-icon { background: rgba(0,136,204,0.12); color: #0088cc; }

            /* Cancel button */
            #dvx-share-cancel {
                display: block;
                width: calc(100% - 40px);
                margin: 14px 20px 0;
                background: rgba(255,255,255,0.04);
                border: 1px solid rgba(255,255,255,0.07);
                border-radius: 12px;
                color: #6b7a90;
                font-family: 'DM Sans', sans-serif;
                font-size: 0.88rem;
                font-weight: 600;
                padding: 13px;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            #dvx-share-cancel:hover {
                background: rgba(255,255,255,0.07);
                color: #b0b8c8;
            }
            #dvx-share-cancel:active { transform: scale(0.97); }
        `;
        document.head.appendChild(style);
    }

    /* ── Build the share URL for a config ── */
    function buildShareUrl(rawUrl, filename) {
        // If we have a full URL already, use it; otherwise build a page ?config= link
        if (rawUrl && /^https?:/i.test(rawUrl)) {
            return rawUrl;
        }
        // Fall back: link to this same page with ?config=filename so it highlights
        const base = window.location.href.split('?')[0];
        return base + '?config=' + encodeURIComponent(filename);
    }

    /* ── Show the share bottom sheet ── */
    window.showSharePanel = function(rawUrl, filename, displayName) {
        injectShareStyles();

        // Remove any existing panel
        const existing = document.getElementById('dvx-share-overlay');
        if (existing) existing.remove();

        const shareUrl = buildShareUrl(rawUrl, filename);
        const name     = displayName || filename || 'Config';

        const overlay = document.createElement('div');
        overlay.id = 'dvx-share-overlay';

        // Detect Web Share API support
        const hasNativeShare = !!(navigator.share);

        overlay.innerHTML = `
            <div id="dvx-share-panel">
                <div id="dvx-share-handle"></div>
                <div id="dvx-share-header">
                    <div id="dvx-share-title">Share Config</div>
                    <div id="dvx-share-name">${name}</div>
                </div>
                <div id="dvx-share-url-row">
                    <span id="dvx-share-url-text">${shareUrl}</span>
                    <button id="dvx-copy-btn"><i class="fas fa-copy"></i> Copy</button>
                </div>
                <div id="dvx-share-actions">
                    ${hasNativeShare ? `
                    <div class="dvx-share-action dvx-action-native" id="dvx-native-share">
                        <div class="dvx-action-icon"><i class="fas fa-share-alt"></i></div>
                        <span class="dvx-action-label">More Options</span>
                    </div>
                    ` : ''}
                    <a class="dvx-share-action dvx-action-whatsapp"
                       href="https://wa.me/?text=${encodeURIComponent(name + '\n' + shareUrl)}"
                       target="_blank" rel="noopener noreferrer">
                        <div class="dvx-action-icon"><i class="fab fa-whatsapp"></i></div>
                        <span class="dvx-action-label">WhatsApp</span>
                    </a>
                    <a class="dvx-share-action dvx-action-telegram"
                       href="https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(name)}"
                       target="_blank" rel="noopener noreferrer">
                        <div class="dvx-action-icon"><i class="fab fa-telegram"></i></div>
                        <span class="dvx-action-label">Telegram</span>
                    </a>
                </div>
                <button id="dvx-share-cancel">Cancel</button>
            </div>
        `;

        document.body.appendChild(overlay);

        /* Copy button */
        const copyBtn = overlay.querySelector('#dvx-copy-btn');
        copyBtn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(shareUrl);
                copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                copyBtn.classList.add('copied');
                setTimeout(() => {
                    copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';
                    copyBtn.classList.remove('copied');
                }, 2000);
            } catch {
                // Fallback for older Android WebViews
                const ta = document.createElement('textarea');
                ta.value = shareUrl;
                ta.style.cssText = 'position:fixed;opacity:0;';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                copyBtn.classList.add('copied');
                setTimeout(() => {
                    copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';
                    copyBtn.classList.remove('copied');
                }, 2000);
            }
        });

        /* Native share */
        if (hasNativeShare) {
            const nativeBtn = overlay.querySelector('#dvx-native-share');
            if (nativeBtn) {
                nativeBtn.addEventListener('click', async () => {
                    try {
                        await navigator.share({ title: name, url: shareUrl });
                    } catch (err) {
                        if (err.name !== 'AbortError') {
                            console.warn('[Share] Native share failed:', err);
                        }
                    }
                });
            }
        }

        /* Cancel & backdrop close */
        const cancelBtn = overlay.querySelector('#dvx-share-cancel');
        cancelBtn.addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });

        /* Swipe down to dismiss */
        const panel = overlay.querySelector('#dvx-share-panel');
        let startY = 0;
        panel.addEventListener('touchstart', (e) => { startY = e.touches[0].clientY; }, { passive: true });
        panel.addEventListener('touchmove', (e) => {
            const delta = e.touches[0].clientY - startY;
            if (delta > 0) panel.style.transform = `translateY(${delta}px)`;
        }, { passive: true });
        panel.addEventListener('touchend', (e) => {
            const delta = e.changedTouches[0].clientY - startY;
            if (delta > 80) {
                panel.style.transition = 'transform 0.2s ease';
                panel.style.transform  = 'translateY(110%)';
                setTimeout(() => overlay.remove(), 200);
            } else {
                panel.style.transform = '';
            }
        });
    };

    injectShareStyles();
})();


/* ════════════════════════════════════════════════
   AD SYSTEM
   Two ad formats, both once-per-session:
     1. Timer Ad  — fires after N seconds on page
     2. Download Ad — fires after N downloads
   Both show a countdown, then redirect to ad URL.
   Settings are loaded from ad-settings.json.
   ════════════════════════════════════════════════ */
(function initAdSystem() {

    const SESSION_KEY_TIMER    = 'ch_timer_ad_done';
    const SESSION_KEY_DOWNLOAD = 'ch_download_ad_done';
    const SESSION_KEY_DL_COUNT = 'ch_download_count';

    let adSettings = null;

    async function loadAdSettings() {
        try {
            const r = await fetch('ad-settings.json?_t=' + Date.now());
            if (!r.ok) throw new Error('HTTP ' + r.status);
            adSettings = await r.json();
        } catch (e) {
            console.warn('[Ads] Could not load ad-settings.json, using defaults.', e);
            adSettings = getDefaultSettings();
        }
        if (adSettings.enabled) {
            scheduleTimerAd();
        }
    }

    function getDefaultSettings() {
        return {
            enabled: true,
            timerAd: {
                enabled: true,
                triggerAfterSeconds: 50,
                waitingPeriodSeconds: 5,
                redirectUrl: 'https://gizokraijaw.net/vignette.min.js',
                message: 'Support the creator by watching an ad to continue downloading.',
                buttonLabel: 'Continue to Ad'
            },
            downloadAd: {
                enabled: true,
                minDownloads: 2,
                maxDownloads: 4,
                waitingPeriodSeconds: 5,
                redirectUrl: 'https://groleegni.net/vignette.min.js',
                message: "You've been downloading for free! Please support the creator by watching a short ad.",
                buttonLabel: 'Watch Ad & Continue'
            },
            adZones: {
                vignette: '10338417',
                interstitial: '10338434'
            }
        };
    }

    function scheduleTimerAd() {
        const cfg = adSettings.timerAd;
        if (!cfg || !cfg.enabled) return;
        if (sessionStorage.getItem(SESSION_KEY_TIMER)) return;

        const delay = (cfg.triggerAfterSeconds || 50) * 1000;
        setTimeout(() => {
            if (!sessionStorage.getItem(SESSION_KEY_TIMER)) {
                showAdModal('timer');
            }
        }, delay);
    }

    window._adOnDownload = function () {
        if (!adSettings || !adSettings.enabled) return;
        const cfg = adSettings.downloadAd;
        if (!cfg || !cfg.enabled) return;
        if (sessionStorage.getItem(SESSION_KEY_DOWNLOAD)) return;

        let count = parseInt(sessionStorage.getItem(SESSION_KEY_DL_COUNT) || '0', 10);
        count += 1;
        sessionStorage.setItem(SESSION_KEY_DL_COUNT, count);

        const min = cfg.minDownloads || 2;
        const max = cfg.maxDownloads || 4;
        const THRESHOLD_KEY = 'ch_dl_threshold';
        let threshold = parseInt(sessionStorage.getItem(THRESHOLD_KEY) || '0', 10);
        if (!threshold) {
            threshold = Math.floor(Math.random() * (max - min + 1)) + min;
            sessionStorage.setItem(THRESHOLD_KEY, threshold);
        }

        if (count >= threshold) {
            showAdModal('download');
        }
    };

    function showAdModal(type) {
        if (type === 'timer')    sessionStorage.setItem(SESSION_KEY_TIMER, '1');
        if (type === 'download') sessionStorage.setItem(SESSION_KEY_DOWNLOAD, '1');

        const cfg         = type === 'timer' ? adSettings.timerAd : adSettings.downloadAd;
        const waitSeconds = cfg.waitingPeriodSeconds || 5;
        const redirectUrl = cfg.redirectUrl || '#';
        const message     = cfg.message || 'Please watch an ad to continue.';
        const btnLabel    = cfg.buttonLabel || 'Watch Ad';

        if (!document.getElementById('ch-ad-style')) {
            const style = document.createElement('style');
            style.id = 'ch-ad-style';
            style.textContent = `
                #ch-ad-overlay {
                    position: fixed; inset: 0; z-index: 99999;
                    background: rgba(0,0,0,0.82);
                    display: flex; align-items: center; justify-content: center;
                    animation: chFadeIn 0.35s ease; padding: 20px;
                }
                @keyframes chFadeIn { from { opacity: 0; } to { opacity: 1; } }
                #ch-ad-box {
                    background: #ffffff; border-radius: 18px;
                    padding: 32px 28px 28px; max-width: 380px; width: 100%;
                    text-align: center; box-shadow: 0 24px 60px rgba(0,0,0,0.45);
                    position: relative; animation: chSlideUp 0.4s cubic-bezier(0.34,1.56,0.64,1);
                }
                @keyframes chSlideUp {
                    from { transform: translateY(40px) scale(0.95); opacity: 0; }
                    to   { transform: translateY(0) scale(1); opacity: 1; }
                }
                #ch-ad-icon {
                    width: 64px; height: 64px; background: #1a1a1a; border-radius: 50%;
                    display: flex; align-items: center; justify-content: center; margin: 0 auto 18px;
                }
                #ch-ad-icon i { color: #fff; font-size: 1.6rem; }
                #ch-ad-title {
                    font-family: 'Segoe UI', system-ui, sans-serif; font-size: 1.2rem;
                    font-weight: 700; color: #1a1a1a; margin-bottom: 10px; line-height: 1.3;
                }
                #ch-ad-msg {
                    font-family: 'Segoe UI', system-ui, sans-serif; font-size: 0.92rem;
                    color: #555; line-height: 1.6; margin-bottom: 24px;
                }
                #ch-ad-ring-wrap { margin: 0 auto 22px; width: 80px; height: 80px; position: relative; }
                #ch-ad-ring-svg  { transform: rotate(-90deg); width: 80px; height: 80px; }
                #ch-ad-ring-bg   { fill: none; stroke: #eee; stroke-width: 6; }
                #ch-ad-ring-fill {
                    fill: none; stroke: #1a1a1a; stroke-width: 6; stroke-linecap: round;
                    transition: stroke-dashoffset 1s linear;
                }
                #ch-ad-ring-num {
                    position: absolute; inset: 0; display: flex;
                    align-items: center; justify-content: center;
                    font-family: 'Segoe UI', system-ui, sans-serif;
                    font-size: 1.6rem; font-weight: 700; color: #1a1a1a;
                }
                #ch-ad-btn {
                    display: inline-flex; align-items: center; gap: 8px;
                    background: #1a1a1a; color: #fff; border: none;
                    border-radius: 10px; padding: 14px 28px;
                    font-family: 'Segoe UI', system-ui, sans-serif;
                    font-size: 0.95rem; font-weight: 600; cursor: pointer;
                    transition: background 0.2s ease, transform 0.15s ease;
                    width: 100%; justify-content: center;
                }
                #ch-ad-btn:disabled { background: #ccc; cursor: not-allowed; transform: none; }
                #ch-ad-btn:not(:disabled):hover { background: #000; transform: translateY(-1px); }
                #ch-ad-btn:not(:disabled):active { transform: scale(0.97); }
                #ch-ad-tagline {
                    margin-top: 14px; font-family: 'Segoe UI', system-ui, sans-serif;
                    font-size: 0.76rem; color: #aaa;
                }
            `;
            document.head.appendChild(style);
        }

        const overlay = document.createElement('div');
        overlay.id = 'ch-ad-overlay';

        const iconClass = type === 'timer' ? 'fas fa-clock' : 'fas fa-heart';
        const titleText = type === 'timer' ? 'Support the Creator' : 'Keep the Downloads Free';
        const circumference = 2 * Math.PI * 30;

        overlay.innerHTML = `
            <div id="ch-ad-box">
                <div id="ch-ad-icon"><i class="${iconClass}"></i></div>
                <div id="ch-ad-title">${titleText}</div>
                <div id="ch-ad-msg">${message}</div>
                <div id="ch-ad-ring-wrap">
                    <svg id="ch-ad-ring-svg" viewBox="0 0 80 80">
                        <circle id="ch-ad-ring-bg" cx="40" cy="40" r="30"/>
                        <circle id="ch-ad-ring-fill" cx="40" cy="40" r="30"
                            stroke-dasharray="${circumference}" stroke-dashoffset="0"/>
                    </svg>
                    <div id="ch-ad-ring-num">${waitSeconds}</div>
                </div>
                <button id="ch-ad-btn" disabled>
                    <i class="fas fa-hourglass-half" id="ch-ad-btn-icon"></i>
                    <span id="ch-ad-btn-label">Please wait… ${waitSeconds}s</span>
                </button>
                <div id="ch-ad-tagline">Ads keep this service free for everyone ❤️</div>
            </div>
        `;

        document.body.appendChild(overlay);

        const ring    = document.getElementById('ch-ad-ring-fill');
        const numEl   = document.getElementById('ch-ad-ring-num');
        const btn     = document.getElementById('ch-ad-btn');
        const btnIcon = document.getElementById('ch-ad-btn-icon');
        const btnLbl  = document.getElementById('ch-ad-btn-label');

        ring.style.strokeDasharray  = circumference;
        ring.style.strokeDashoffset = '0';

        let remaining = waitSeconds;

        function tick() {
            remaining--;
            numEl.textContent = remaining;
            const progress = (waitSeconds - remaining) / waitSeconds;
            ring.style.strokeDashoffset = circumference * progress;

            if (remaining <= 0) {
                btn.disabled = false;
                btnIcon.className = 'fas fa-external-link-alt';
                btnLbl.textContent = btnLabel;
                numEl.textContent = '✓';
                ring.style.stroke = '#22c55e';
            } else {
                btnLbl.textContent = `Please wait… ${remaining}s`;
                setTimeout(tick, 1000);
            }
        }
        setTimeout(tick, 1000);

        btn.addEventListener('click', () => {
            if (btn.disabled) return;
            document.body.removeChild(overlay);
            window.open(redirectUrl, '_blank');
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadAdSettings);
    } else {
        loadAdSettings();
    }

})();
