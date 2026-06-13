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
            /* Share Button on cards - BLACK & WHITE theme */
            .share-btn {
                background: rgba(0,0,0,0.05);
                border: 1px solid rgba(0,0,0,0.15);
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
                color: #1a1a1a;
                font-size: 1rem;
                transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
            }
            .share-btn:hover {
                background: rgba(0,0,0,0.12);
                border-color: #1a1a1a;
                transform: scale(1.07);
                box-shadow: 0 0 14px rgba(0,0,0,0.1);
            }
            .share-btn:hover i { transform: translateY(-1px); }
            .share-btn:active  { transform: scale(0.94); }

            /* Overlay backdrop */
            #dvx-share-overlay {
                position: fixed;
                inset: 0;
                z-index: 88888;
                background: rgba(0,0,0,0.85);
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

            /* Bottom sheet panel - DARK THEME */
            #dvx-share-panel {
                width: 100%;
                max-width: 480px;
                background: #111111;
                border-radius: 22px 22px 0 0;
                border: 1px solid rgba(255,255,255,0.1);
                border-bottom: none;
                padding: 0 0 24px;
                box-shadow: 0 -8px 40px rgba(0,0,0,0.6);
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
                background: rgba(255,255,255,0.2);
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
                color: #ffffff;
                letter-spacing: 0.1em;
                text-transform: uppercase;
                margin-bottom: 4px;
                opacity: 0.7;
            }
            #dvx-share-name {
                font-family: 'Oxanium', sans-serif;
                font-size: 1rem;
                font-weight: 600;
                color: #ffffff;
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
                background: #1a1a1a;
                border: 1px solid rgba(255,255,255,0.1);
                border-radius: 10px;
                padding: 10px 12px;
            }
            #dvx-share-url-text {
                flex: 1;
                font-family: 'DM Sans', sans-serif;
                font-size: 0.8rem;
                color: #aaaaaa;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            #dvx-copy-btn {
                background: rgba(255,255,255,0.1);
                border: 1px solid rgba(255,255,255,0.2);
                border-radius: 7px;
                color: #ffffff;
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
                background: rgba(255,255,255,0.2);
                border-color: #ffffff;
            }
            #dvx-copy-btn.copied {
                background: rgba(34,197,94,0.2);
                border-color: #22c55e;
                color: #22c55e;
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
                background: #1a1a1a;
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 14px;
                padding: 14px 8px;
                cursor: pointer;
                transition: all 0.25s cubic-bezier(0.4,0,0.2,1);
                text-decoration: none;
                -webkit-tap-highlight-color: transparent;
            }
            .dvx-share-action:hover {
                background: #2a2a2a;
                border-color: rgba(255,255,255,0.2);
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
                color: #cccccc;
                text-align: center;
                line-height: 1.2;
            }

            /* Action colour variants - B&W */
            .dvx-action-native  .dvx-action-icon { background: rgba(255,255,255,0.1); color: #ffffff; }
            .dvx-action-whatsapp .dvx-action-icon { background: rgba(255,255,255,0.1); color: #ffffff; }
            .dvx-action-telegram .dvx-action-icon { background: rgba(255,255,255,0.1); color: #ffffff; }
            .dvx-action-qr .dvx-action-icon { background: rgba(255,255,255,0.1); color: #ffffff; }

            /* Cancel button */
            #dvx-share-cancel {
                display: block;
                width: calc(100% - 40px);
                margin: 14px 20px 0;
                background: rgba(255,255,255,0.04);
                border: 1px solid rgba(255,255,255,0.1);
                border-radius: 12px;
                color: #aaaaaa;
                font-family: 'DM Sans', sans-serif;
                font-size: 0.88rem;
                font-weight: 600;
                padding: 13px;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            #dvx-share-cancel:hover {
                background: rgba(255,255,255,0.08);
                color: #ffffff;
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
                <div id="dvx-qr-divider"><span>or share via QR Code</span></div>
                <div id="dvx-qr-row">
                    <div class="dvx-share-action dvx-action-qr" id="dvx-qr-btn">
                        <div class="dvx-action-icon"><i class="fas fa-qrcode"></i></div>
                        <span class="dvx-action-label">QR Code</span>
                    </div>
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

        /* QR Code button */
        const qrBtn = overlay.querySelector('#dvx-qr-btn');
        if (qrBtn) {
            qrBtn.addEventListener('click', () => {
                overlay.remove();
                showQRModal(shareUrl, name);
            });
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

    /* ════════════════════════════════════════════════
       QR CODE MODAL - HIGH QUALITY BLACK & WHITE
       Generates a branded QR code image for a config.
       Uses qrcode.js (loaded on demand via CDN).
       ════════════════════════════════════════════════ */

    function injectQRStyles() {
        if (document.getElementById('dvx-qr-style')) return;
        const style = document.createElement('style');
        style.id = 'dvx-qr-style';
        style.textContent = `
            #dvx-qr-overlay {
                position: fixed;
                inset: 0;
                z-index: 99990;
                background: rgba(0,0,0,0.9);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
                display: flex;
                align-items: center;
                justify-content: center;
                animation: dvxFadeIn 0.25s ease;
                padding: 20px;
            }
            #dvx-qr-box {
                background: #111111;
                border: 1px solid rgba(255,255,255,0.15);
                border-radius: 22px;
                padding: 28px 24px 24px;
                max-width: 380px;
                width: 100%;
                text-align: center;
                box-shadow: 0 24px 60px rgba(0,0,0,0.7);
                animation: dvxSlideUp 0.35s cubic-bezier(0.34,1.2,0.64,1);
            }
            #dvx-qr-title {
                font-family: 'Oxanium', sans-serif;
                font-size: 0.68rem;
                font-weight: 700;
                color: #ffffff;
                letter-spacing: 0.14em;
                text-transform: uppercase;
                margin-bottom: 4px;
                opacity: 0.7;
            }
            #dvx-qr-filename {
                font-family: 'Oxanium', sans-serif;
                font-size: 1rem;
                font-weight: 600;
                color: #ffffff;
                margin-bottom: 20px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            #dvx-qr-canvas-wrap {
                background: #ffffff;
                border-radius: 14px;
                padding: 16px;
                display: inline-block;
                margin-bottom: 16px;
                box-shadow: 0 0 0 1px rgba(255,255,255,0.2), 0 8px 24px rgba(0,0,0,0.4);
            }
            #dvx-qr-canvas-wrap canvas { display: block; }
            #dvx-qr-scan-hint {
                font-family: 'DM Sans', sans-serif;
                font-size: 0.8rem;
                color: #aaaaaa;
                margin-bottom: 18px;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
            }
            #dvx-qr-scan-hint i { color: #ffffff; font-size: 0.85rem; opacity: 0.7; }
            #dvx-qr-actions {
                display: flex;
                gap: 10px;
                margin-bottom: 12px;
            }
            #dvx-qr-save-btn {
                flex: 1;
                background: #ffffff;
                color: #111111;
                border: none;
                border-radius: 11px;
                padding: 13px 16px;
                font-family: 'Oxanium', sans-serif;
                font-size: 0.88rem;
                font-weight: 700;
                letter-spacing: 0.04em;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 7px;
                transition: all 0.25s ease;
            }
            #dvx-qr-save-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(0,0,0,0.3);
            }
            #dvx-qr-save-btn:active { transform: scale(0.97); }
            #dvx-qr-back-btn {
                background: rgba(255,255,255,0.05);
                border: 1px solid rgba(255,255,255,0.15);
                border-radius: 11px;
                padding: 13px 16px;
                color: #cccccc;
                font-family: 'DM Sans', sans-serif;
                font-size: 0.88rem;
                font-weight: 600;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 7px;
                transition: all 0.2s ease;
            }
            #dvx-qr-back-btn:hover { background: rgba(255,255,255,0.1); color: #ffffff; }
            #dvx-qr-back-btn:active { transform: scale(0.97); }
            #dvx-qr-close-btn {
                display: block;
                width: 100%;
                background: transparent;
                border: none;
                padding: 10px;
                font-family: 'DM Sans', sans-serif;
                font-size: 0.8rem;
                font-weight: 600;
                color: #aaaaaa;
                cursor: pointer;
                transition: color 0.2s;
            }
            #dvx-qr-close-btn:hover { color: #ffffff; }
            /* QR divider and row in share panel */
            #dvx-qr-divider {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 14px 20px 0;
            }
            #dvx-qr-divider::before,
            #dvx-qr-divider::after {
                content: '';
                flex: 1;
                height: 1px;
                background: rgba(255,255,255,0.1);
            }
            #dvx-qr-divider span {
                font-family: 'DM Sans', sans-serif;
                font-size: 0.72rem;
                color: #aaaaaa;
                white-space: nowrap;
                font-weight: 600;
                letter-spacing: 0.04em;
            }
            #dvx-qr-row {
                display: flex;
                justify-content: center;
                padding: 12px 20px 0;
            }
            #dvx-qr-row .dvx-share-action {
                width: 100%;
                flex-direction: row;
                justify-content: center;
                gap: 10px;
                padding: 14px 16px;
                border-color: rgba(255,255,255,0.15);
            }
            #dvx-qr-row .dvx-action-label {
                font-size: 0.82rem;
            }
        `;
        document.head.appendChild(style);
    }

    /* Load qrcode.js from CDN on demand */
    function loadQRLib(callback) {
        if (window.QRCode) { callback(); return; }
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
        s.onload = callback;
        s.onerror = () => console.error('[QR] Failed to load qrcode.js');
        document.head.appendChild(s);
    }

    /* Draw high quality branded QR image onto a canvas and return dataURL */
    function renderHighQualityBrandedQR(qrCanvas, fileName) {
        // Use higher resolution (4x scale) for sharp QR
        const SIZE_QRSRC = qrCanvas.width;     // usually 200
        const TARGET_QR_SIZE = 400;            // Double resolution for sharpness
        const CARD_W = 800;
        const CARD_H = 860;
        const out = document.createElement('canvas');
        out.width = CARD_W;
        out.height = CARD_H;
        const ctx = out.getContext('2d');
        
        // Enable high-quality image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Background gradient - dark theme
        const bg = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
        bg.addColorStop(0, '#0a0a0a');
        bg.addColorStop(0.6, '#141414');
        bg.addColorStop(1, '#1a1a1a');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, CARD_W, CARD_H);
        
        // Rounded corners effect (draw rounded border)
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(30, 0);
        ctx.lineTo(CARD_W - 30, 0);
        ctx.quadraticCurveTo(CARD_W, 0, CARD_W, 30);
        ctx.lineTo(CARD_W, CARD_H - 30);
        ctx.quadraticCurveTo(CARD_W, CARD_H, CARD_W - 30, CARD_H);
        ctx.lineTo(30, CARD_H);
        ctx.quadraticCurveTo(0, CARD_H, 0, CARD_H - 30);
        ctx.lineTo(0, 30);
        ctx.quadraticCurveTo(0, 0, 30, 0);
        ctx.closePath();
        ctx.clip();

        // Border stroke
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Top accent line (white)
        ctx.beginPath();
        ctx.moveTo(120, 2);
        ctx.lineTo(CARD_W - 120, 2);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.stroke();

        /* Site name — CONFIGHUB */
        ctx.font = 'bold 52px "Oxanium", "Segoe UI", system-ui, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText('CONFIGHUB', CARD_W / 2, 100);

        /* Dot separator */
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(CARD_W / 2, 130, 6, 0, Math.PI * 2);
        ctx.fill();

        /* Developer tag */
        ctx.font = '600 20px "Oxanium", "Segoe UI", system-ui, sans-serif';
        ctx.fillStyle = '#aaaaaa';
        ctx.fillText('BY ETHAN CHAOS', CARD_W / 2, 170);
        
        // Scale and draw QR code at higher quality
        const QR_X = (CARD_W - TARGET_QR_SIZE) / 2;
        const QR_Y = 220;
        
        // White background for QR area
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
        ctx.beginPath();
        ctx.roundRect(QR_X - 20, QR_Y - 20, TARGET_QR_SIZE + 40, TARGET_QR_SIZE + 40, 24);
        ctx.fill();
        
        // Draw QR with scaling for crisp rendering
        ctx.drawImage(qrCanvas, QR_X, QR_Y, TARGET_QR_SIZE, TARGET_QR_SIZE);
        
        // File name label
        let displayName = fileName || 'Config File';
        ctx.font = 'bold 26px "Oxanium", "Segoe UI", system-ui, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        // Truncate if needed
        let maxWidth = CARD_W - 100;
        if (ctx.measureText(displayName).width > maxWidth) {
            while (ctx.measureText(displayName + '…').width > maxWidth && displayName.length > 5) {
                displayName = displayName.slice(0, -1);
            }
            displayName = displayName + '…';
        }
        ctx.fillText(displayName, CARD_W / 2, QR_Y + TARGET_QR_SIZE + 80);

        /* "Scan to Download" message */
        ctx.font = '500 20px "DM Sans", "Segoe UI", system-ui, sans-serif';
        ctx.fillStyle = '#aaaaaa';
        ctx.fillText('Scan to download file', CARD_W / 2, QR_Y + TARGET_QR_SIZE + 120);

        /* Shareable badge */
        const badge = '⬡  SHAREABLE';
        ctx.font = '700 18px "Oxanium", "Segoe UI", system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText(badge, CARD_W / 2, CARD_H - 40);
        
        ctx.restore();
        return out.toDataURL('image/png');
    }

    window.showQRModal = function(shareUrl, fileName) {
        injectQRStyles();

        const existing = document.getElementById('dvx-qr-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'dvx-qr-overlay';
        overlay.innerHTML = `
            <div id="dvx-qr-box">
                <div id="dvx-qr-title">QR Code</div>
                <div id="dvx-qr-filename">${fileName || 'Config File'}</div>
                <div id="dvx-qr-canvas-wrap">
                    <div id="dvx-qr-placeholder" style="width:200px;height:200px;display:flex;align-items:center;justify-content:center;">
                        <i class="fas fa-spinner" style="font-size:2rem;color:#ffffff;animation:spin 1.2s linear infinite;"></i>
                    </div>
                </div>
                <div id="dvx-qr-scan-hint">
                    <i class="fas fa-mobile-alt"></i>
                    Point your camera to scan & download
                </div>
                <div id="dvx-qr-actions">
                    <button id="dvx-qr-save-btn" disabled>
                        <i class="fas fa-download"></i> Save QR Code
                    </button>
                    <button id="dvx-qr-back-btn">
                        <i class="fas fa-arrow-left"></i> Back
                    </button>
                </div>
                <button id="dvx-qr-close-btn">Close</button>
            </div>
        `;

        document.body.appendChild(overlay);

        const wrap    = overlay.querySelector('#dvx-qr-canvas-wrap');
        const saveBtn = overlay.querySelector('#dvx-qr-save-btn');
        const backBtn = overlay.querySelector('#dvx-qr-back-btn');
        const closeBtn= overlay.querySelector('#dvx-qr-close-btn');

        loadQRLib(() => {
            /* Remove placeholder */
            const ph = overlay.querySelector('#dvx-qr-placeholder');
            if (ph) ph.remove();

            /* Render QR into a temp div */
            const tempDiv = document.createElement('div');
            tempDiv.style.cssText = 'position:absolute;left:-9999px;top:-9999px;';
            document.body.appendChild(tempDiv);

            new QRCode(tempDiv, {
                text:          shareUrl,
                width:         400,      // Higher resolution QR
                height:        400,
                colorDark:     '#000000',
                colorLight:    '#ffffff',
                correctLevel:  QRCode.CorrectLevel.H
            });

            /* Wait a bit for QRCode to finish rendering */
            setTimeout(() => {
                const qrCanvas = tempDiv.querySelector('canvas');
                if (!qrCanvas) {
                    document.body.removeChild(tempDiv);
                    wrap.innerHTML = '<p style="color:#ef5350;font-size:0.85rem;padding:20px;">QR generation failed.</p>';
                    return;
                }

                /* Show the raw QR for immediate scanning */
                const displayCanvas = document.createElement('canvas');
                displayCanvas.width  = 200;
                displayCanvas.height = 200;
                const displayCtx = displayCanvas.getContext('2d');
                displayCtx.drawImage(qrCanvas, 0, 0, 200, 200);
                wrap.appendChild(displayCanvas);

                /* Pre-render branded image for download */
                const brandedDataUrl = renderHighQualityBrandedQR(qrCanvas, fileName);
                document.body.removeChild(tempDiv);

                /* Enable save button */
                saveBtn.disabled = false;
                saveBtn.addEventListener('click', () => {
                    const a = document.createElement('a');
                    a.href     = brandedDataUrl;
                    a.download = (fileName || 'config').replace(/[^a-zA-Z0-9_\-]/g, '_') + '_qr.png';
                    a.style.display = 'none';
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(() => { if (a.parentNode) a.parentNode.removeChild(a); }, 500);

                    saveBtn.innerHTML = '<i class="fas fa-check"></i> Saved!';
                    setTimeout(() => { saveBtn.innerHTML = '<i class="fas fa-download"></i> Save QR Code'; }, 2000);
                });

            }, 100);
        });

        /* Back → re-open share panel */
        backBtn.addEventListener('click', () => {
            overlay.remove();
            window.showSharePanel(shareUrl, fileName, fileName);
        });

        closeBtn.addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
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
                triggerAfterSeconds: 120,
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
                    background: rgba(0,0,0,0.85);
                    display: flex; align-items: center; justify-content: center;
                    animation: chFadeIn 0.35s ease; padding: 20px;
                }
                @keyframes chFadeIn { from { opacity: 0; } to { opacity: 1; } }
                #ch-ad-box {
                    background: #111111; border-radius: 18px;
                    padding: 32px 28px 28px; max-width: 380px; width: 100%;
                    text-align: center; box-shadow: 0 24px 60px rgba(0,0,0,0.45);
                    position: relative; animation: chSlideUp 0.4s cubic-bezier(0.34,1.56,0.64,1);
                    border: 1px solid rgba(255,255,255,0.1);
                }
                @keyframes chSlideUp {
                    from { transform: translateY(40px) scale(0.95); opacity: 0; }
                    to   { transform: translateY(0) scale(1); opacity: 1; }
                }
                #ch-ad-icon {
                    width: 64px; height: 64px; background: #ffffff; border-radius: 50%;
                    display: flex; align-items: center; justify-content: center; margin: 0 auto 18px;
                }
                #ch-ad-icon i { color: #111111; font-size: 1.6rem; }
                #ch-ad-title {
                    font-family: 'Segoe UI', system-ui, sans-serif; font-size: 1.2rem;
                    font-weight: 700; color: #ffffff; margin-bottom: 10px; line-height: 1.3;
                }
                #ch-ad-msg {
                    font-family: 'Segoe UI', system-ui, sans-serif; font-size: 0.92rem;
                    color: #cccccc; line-height: 1.6; margin-bottom: 24px;
                }
                #ch-ad-ring-wrap { margin: 0 auto 22px; width: 80px; height: 80px; position: relative; }
                #ch-ad-ring-svg  { transform: rotate(-90deg); width: 80px; height: 80px; }
                #ch-ad-ring-bg   { fill: none; stroke: #333333; stroke-width: 6; }
                #ch-ad-ring-fill {
                    fill: none; stroke: #ffffff; stroke-width: 6; stroke-linecap: round;
                    transition: stroke-dashoffset 1s linear;
                }
                #ch-ad-ring-num {
                    position: absolute; inset: 0; display: flex;
                    align-items: center; justify-content: center;
                    font-family: 'Segoe UI', system-ui, sans-serif;
                    font-size: 1.6rem; font-weight: 700; color: #ffffff;
                }
                #ch-ad-btn {
                    display: inline-flex; align-items: center; gap: 8px;
                    background: #ffffff; color: #111111; border: none;
                    border-radius: 10px; padding: 14px 28px;
                    font-family: 'Segoe UI', system-ui, sans-serif;
                    font-size: 0.95rem; font-weight: 600; cursor: pointer;
                    transition: background 0.2s ease, transform 0.15s ease;
                    width: 100%; justify-content: center;
                }
                #ch-ad-btn:disabled { background: #444444; cursor: not-allowed; transform: none; color: #888888; }
                #ch-ad-btn:not(:disabled):hover { background: #e0e0e0; transform: translateY(-1px); }
                #ch-ad-btn:not(:disabled):active { transform: scale(0.97); }
                #ch-ad-tagline {
                    margin-top: 14px; font-family: 'Segoe UI', system-ui, sans-serif;
                    font-size: 0.76rem; color: #777777;
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
