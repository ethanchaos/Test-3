/* ════════════════════════════════════════════════
   app.js — Shared JS for all pages
   Handles: nav toggle, download logic, bottom nav,
            fetch/render engine, and ads.
   Requires: sources.js (sets window.JSON_SOURCES)
   Each HTML page defines its own filter constants
   (VPN_SEARCH_TERMS, VPN_DISPLAY_NAME, VPN_ICON)
   before loading this script.
   ════════════════════════════════════════════════ */


/* ── Boot MainActivty (addon/plugin controller) ── */
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

/* ── Bottom Navigation Active State ── */
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

// Strips any extra extension the server/browser might append (e.g. .txt added to .hc files)
// and ensures the saved file always keeps its original extension from the filename in JSON.
function sanitizeFilename(filename) {
    if (!filename) return 'config';
    // Trim whitespace
    filename = filename.trim();
    // If the server URL might have appended .txt to a non-txt file, we strip it.
    // We trust the filename from JSON as the ground truth — return it as-is.
    return filename;
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
    filename = sanitizeFilename(filename);

    // Fix GitHub blob URLs → raw so they actually serve the file
    url = fixGitHubUrl(url);

    // If url is a bare filename or relative path (no scheme),
    // resolve it against the GitHub raw base from sources.js so we get the right file.
    if (url && !/^(https?:|blob:|data:)/i.test(url)) {
        const source = (window.JSON_SOURCES || []).find(s => s.includes('raw.githubusercontent.com'));
        if (source) {
            // Strip the JSON filename and point to the uploads/ subfolder where files live:
            // https://raw.githubusercontent.com/ethanchaos/Test-3/main/upload.json
            // → https://raw.githubusercontent.com/ethanchaos/Test-3/main/uploads/
            const base = source.replace(/\/[^/]+$/, '/uploads/');
            url = base + url;
        } else {
            url = new URL(url, window.location.href).href;
        }
    }

    // ── Native app bridges (Android WebView / React Native) ──
    if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(
            JSON.stringify({ type: 'DOWNLOAD_FILE', url, filename })
        );
        showDownloadFeedback(filename);
        return;
    }

    if (window.Android && typeof window.Android.downloadFile === 'function') {
        window.Android.downloadFile(url, filename);
        showDownloadFeedback(filename);
        return;
    }

    // ── Blob fetch approach ──
    // Fetching the file first into a Blob makes the anchor download attribute
    // work reliably in ALL browsers, even for cross-origin URLs (GitHub raw, etc).
    // The browser can no longer override the filename or force a .txt extension.
    try {
        showDownloadFeedback(filename); // show feedback immediately so it feels snappy

        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok: ' + response.status);

        const blob = await response.blob();

        // Re-type as octet-stream so browsers treat it as a raw file download,
        // not as text/plain (which causes the .txt rename on some browsers).
        const typedBlob = new Blob([blob], { type: 'application/octet-stream' });
        const blobUrl   = URL.createObjectURL(typedBlob);

        const a = document.createElement('a');
        a.href     = blobUrl;
        a.download = filename; // always respected for same-origin blob URLs
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();

        // Clean up
        setTimeout(() => {
            URL.revokeObjectURL(blobUrl);
            if (a.parentNode) a.parentNode.removeChild(a);
        }, 1000);

    } catch (err) {
        console.warn('[app.js] Blob download failed, falling back to direct link:', err);
        // Last-resort fallback: direct anchor or new tab
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

function showDownloadFeedback(filename) {
    const existing = document.querySelector('.download-feedback');
    if (existing) existing.remove();

    const feedback = document.createElement('div');
    feedback.className = 'download-feedback';
    feedback.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: var(--card-bg);
        color: var(--text-dark);
        padding: 14px 20px;
        border-radius: 8px;
        border: 1px solid var(--border-color);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 9999;
        font-size: 14px;
        font-weight: 500;
        animation: slideInRight 0.3s ease;
        max-width: 300px;
    `;
    feedback.innerHTML = `
        <i class="fas fa-download" style="color:var(--text-dark); margin-right:10px;"></i>
        Downloading: <span style="font-weight:600;">${escapeHtml(filename)}</span>
    `;
    document.body.appendChild(feedback);

    setTimeout(() => {
        feedback.style.animation = 'fadeOutRight 0.3s ease';
        setTimeout(() => feedback.remove(), 300);
    }, 3000);
}

// helper to escape HTML in filename
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

    if (!configList) return; // page doesn't use the engine

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

    // Normalize string for matching
    function normalizeVPN(s) { return s ? s.toLowerCase().trim() : ''; }

    // Check if an item should be shown based on VPN_SEARCH_TERMS
    function isTargetVPN(item) {
        // If VPN_SEARCH_TERMS is empty or contains '*', show everything
        if (!VPN_SEARCH_TERMS || VPN_SEARCH_TERMS.length === 0 || VPN_SEARCH_TERMS[0] === '*') {
            return true;
        }
        const fields = [item.vpn, item.name, item.filename];
        return fields.some(field => {
            const norm = normalizeVPN(field);
            return VPN_SEARCH_TERMS.some(term => norm.includes(term.toLowerCase()));
        });
    }

    // Parse JSON data (array or object)
    function parseDataJson(data) {
        if (Array.isArray(data)) return data;
        // If it's an object, convert each key to an item
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

    // Add cache-busting parameter to URL
    function addBust(url) {
        const sep = url.includes('?') ? '&' : '?';
        return url + sep + '_t=' + Date.now();
    }

    // Fetch with timeout
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

    // Main fetch function
    async function fetchConfigData() {
        showState('loading');
        try {
            // Read sources directly from sources.js (window.JSON_SOURCES)
            const sources = Array.isArray(window.JSON_SOURCES)
                ? window.JSON_SOURCES.filter(s => typeof s === 'string' && s.trim())
                : [];

            if (sources.length === 0) {
                throw new Error('No sources defined in sources.js.');
            }

            console.log('[app.js] Fetching from sources:', sources);

            // Fetch all sources in parallel, ignore failures
            const results = await Promise.allSettled(
                sources.map(url => fetchWithTimeout(url))
            );

            configData = [];
            results.forEach((result, idx) => {
                if (result.status === 'fulfilled') {
                    const parsed = parseDataJson(result.value);
                    console.log(`[app.js] Loaded ${parsed.length} items from ${sources[idx]}`);
                    configData.push(...parsed);
                } else {
                    console.error(`[app.js] Failed to load ${sources[idx]}:`, result.reason.message);
                }
            });

            console.log(`[app.js] Total configs loaded: ${configData.length}`);

            if (configData.length === 0) {
                showState('empty');
                // Optionally show a more detailed message in the empty state
                const emptyMsg = document.querySelector('#emptyState p');
                if (emptyMsg) {
                    emptyMsg.innerHTML = 'No configurations found. Check the console for errors.';
                }
            } else {
                filterAndRenderConfigs();
            }
        } catch (error) {
            console.error('[app.js] Fetch error:', error.message);
            showState('error');
            // Show the error message in the error state
            const errorMsg = document.querySelector('#errorState p');
            if (errorMsg) {
                errorMsg.innerHTML = `Error: ${error.message}. Please check your internet connection and try again.`;
            }
        }
    }

    function filterAndRenderConfigs() {
        filteredData = configData.filter(item => isTargetVPN(item));
        console.log(`[app.js] After filtering, ${filteredData.length} items match the VPN filter.`);
        renderConfigItems();
    }

    // Helper to escape attribute values
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
            // Store the filename on the card itself so the highlighter can find it fast
            div.dataset.filename = item.filename || '';
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

        // Attach download listeners
        configList.querySelectorAll('.download-btn').forEach(btn => {
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                downloadFile(this.dataset.url, this.dataset.filename);
            });
        });

        showState('content');

        // ── After rendering, check if a ?config= param is in the URL ──
        handleConfigParam();
    }

    /* ── ?config= URL Param: Highlight & Scroll ── */
    function handleConfigParam() {
        const params   = new URLSearchParams(window.location.search);
        const target   = params.get('config');
        if (!target) return;

        // Normalise both sides the same way for a reliable match
        const normalise = s => (s || '').trim().toLowerCase();
        const needle    = normalise(target);

        // Search the already-rendered cards using the data-filename attribute
        const cards = configList.querySelectorAll('.config-item[data-filename]');
        let matched = null;

        for (const card of cards) {
            if (normalise(card.dataset.filename) === needle) {
                matched = card;
                break;
            }
        }

        // Fallback: try a partial / contains match if no exact hit
        if (!matched) {
            for (const card of cards) {
                if (normalise(card.dataset.filename).includes(needle) ||
                    needle.includes(normalise(card.dataset.filename))) {
                    matched = card;
                    break;
                }
            }
        }

        if (!matched) {
            console.warn('[app.js] ?config= target not found in rendered list:', target);
            return;
        }

        console.log('[app.js] Highlighting card for config param:', target);

        // Apply highlight class (CSS pulse + blue border defined in styles.css)
        matched.classList.add('config-item--highlighted');

        // Scroll into view — use a small delay so the layout is fully painted
        setTimeout(() => {
            matched.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 120);

        // Remove the highlight after the animation finishes so it doesn't stick
        matched.addEventListener('animationend', () => {
            // Keep the blue border but stop pulsing — just fade border back naturally
        }, { once: true });
    }

    if (retryButton) retryButton.addEventListener('click', fetchConfigData);
    document.addEventListener('DOMContentLoaded', fetchConfigData);
})();

/* ── Card Overlay (power-button style: Share & Download) ── */
(function loadCardOverlay() {
    const s = document.createElement('script');
    // Resolve relative to wherever app.js lives
    const base = (function () {
        const scripts = document.querySelectorAll('script[src]');
        for (const sc of scripts) {
            if (sc.src && sc.src.includes('app.js')) {
                return sc.src.replace(/app\.js.*$/, '');
            }
        }
        return '';
    })();
    s.src = base + 'card-overlay.js';
    s.defer = true;
    document.head.appendChild(s);
})();

/* ── Ads ── */
(function initAds() {
    const ads = [
        function showVignette() {
            const s = document.createElement('script');
            s.dataset.zone = '10338417';
            s.src = 'https://gizokraijaw.net/vignette.min.js';
            document.body.appendChild(s);
        },
        function showInterstitial() {
            const s = document.createElement('script');
            s.dataset.zone = '10338434';
            s.src = 'https://groleegni.net/vignette.min.js';
            document.body.appendChild(s);
        }
    ];

    function showRandomAd() {
        if (ads.length) ads[Math.floor(Math.random() * ads.length)]();
    }

    setInterval(showRandomAd, 10000);
    showRandomAd();
})();
