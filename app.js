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
    // Fire download-ad hook first
    if (typeof window._adOnDownload === 'function') {
        window._adOnDownload();
    }

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
        return;
    }

    if (window.Android && typeof window.Android.downloadFile === 'function') {
        window.Android.downloadFile(url, filename);
        return;
    }

    // ── Blob fetch approach ──
    // Fetching the file first into a Blob makes the anchor download attribute
    // work reliably in ALL browsers, even for cross-origin URLs (GitHub raw, etc).
    // The browser can no longer override the filename or force a .txt extension.
    try {
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

/* ════════════════════════════════════════════════
   AD SYSTEM
   Two ad formats, both once-per-session:
     1. Timer Ad  — fires after N seconds on page
     2. Download Ad — fires after N downloads
   Both show a countdown, then redirect to ad URL.
   Settings are loaded from ad-settings.json.
   ════════════════════════════════════════════════ */
(function initAdSystem() {

    /* ── Session flags (reset on page reload) ── */
    const SESSION_KEY_TIMER    = 'ch_timer_ad_done';
    const SESSION_KEY_DOWNLOAD = 'ch_download_ad_done';
    const SESSION_KEY_DL_COUNT = 'ch_download_count';

    let adSettings = null;

    /* ── Load settings from JSON ── */
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

    /* ── Timer Ad ── */
    function scheduleTimerAd() {
        const cfg = adSettings.timerAd;
        if (!cfg || !cfg.enabled) return;
        if (sessionStorage.getItem(SESSION_KEY_TIMER)) return; // already shown this session

        const delay = (cfg.triggerAfterSeconds || 50) * 1000;
        setTimeout(() => {
            if (!sessionStorage.getItem(SESSION_KEY_TIMER)) {
                showAdModal('timer');
            }
        }, delay);
    }

    /* ── Download Ad — called after each download ── */
    window._adOnDownload = function () {
        if (!adSettings || !adSettings.enabled) return;
        const cfg = adSettings.downloadAd;
        if (!cfg || !cfg.enabled) return;
        if (sessionStorage.getItem(SESSION_KEY_DOWNLOAD)) return; // already shown this session

        let count = parseInt(sessionStorage.getItem(SESSION_KEY_DL_COUNT) || '0', 10);
        count += 1;
        sessionStorage.setItem(SESSION_KEY_DL_COUNT, count);

        const min = cfg.minDownloads || 2;
        const max = cfg.maxDownloads || 4;
        /* Pick a random threshold between min and max once and store it */
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

    /* ════════════════════════════════════════════
       MODAL BUILDER
       type: 'timer' | 'download'
    ════════════════════════════════════════════ */
    function showAdModal(type) {
        /* Mark as shown immediately so duplicate triggers don't stack */
        if (type === 'timer')    sessionStorage.setItem(SESSION_KEY_TIMER, '1');
        if (type === 'download') sessionStorage.setItem(SESSION_KEY_DOWNLOAD, '1');

        const cfg = type === 'timer' ? adSettings.timerAd : adSettings.downloadAd;
        const waitSeconds = cfg.waitingPeriodSeconds || 5;
        const redirectUrl = cfg.redirectUrl || '#';
        const message     = cfg.message || 'Please watch an ad to continue.';
        const btnLabel    = cfg.buttonLabel || 'Watch Ad';

        /* ── Inject modal CSS once ── */
        if (!document.getElementById('ch-ad-style')) {
            const style = document.createElement('style');
            style.id = 'ch-ad-style';
            style.textContent = `
                /* ── Ad Overlay ── */
                #ch-ad-overlay {
                    position: fixed;
                    inset: 0;
                    z-index: 99999;
                    background: rgba(0, 0, 0, 0.82);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    animation: chFadeIn 0.35s ease;
                    padding: 20px;
                }
                @keyframes chFadeIn {
                    from { opacity: 0; }
                    to   { opacity: 1; }
                }

                #ch-ad-box {
                    background: #ffffff;
                    border-radius: 18px;
                    padding: 32px 28px 28px;
                    max-width: 380px;
                    width: 100%;
                    text-align: center;
                    box-shadow: 0 24px 60px rgba(0,0,0,0.45);
                    position: relative;
                    animation: chSlideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
                @keyframes chSlideUp {
                    from { transform: translateY(40px) scale(0.95); opacity: 0; }
                    to   { transform: translateY(0)    scale(1);    opacity: 1; }
                }

                #ch-ad-icon {
                    width: 64px;
                    height: 64px;
                    background: #1a1a1a;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 18px;
                }
                #ch-ad-icon i {
                    color: #fff;
                    font-size: 1.6rem;
                }

                #ch-ad-title {
                    font-family: 'Segoe UI', system-ui, sans-serif;
                    font-size: 1.2rem;
                    font-weight: 700;
                    color: #1a1a1a;
                    margin-bottom: 10px;
                    line-height: 1.3;
                }

                #ch-ad-msg {
                    font-family: 'Segoe UI', system-ui, sans-serif;
                    font-size: 0.92rem;
                    color: #555;
                    line-height: 1.6;
                    margin-bottom: 24px;
                }

                /* ── Countdown ring ── */
                #ch-ad-ring-wrap {
                    margin: 0 auto 22px;
                    width: 80px;
                    height: 80px;
                    position: relative;
                }
                #ch-ad-ring-svg {
                    transform: rotate(-90deg);
                    width: 80px;
                    height: 80px;
                }
                #ch-ad-ring-bg {
                    fill: none;
                    stroke: #eeeeee;
                    stroke-width: 6;
                }
                #ch-ad-ring-fill {
                    fill: none;
                    stroke: #1a1a1a;
                    stroke-width: 6;
                    stroke-linecap: round;
                    transition: stroke-dashoffset 1s linear;
                }
                #ch-ad-ring-num {
                    position: absolute;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-family: 'Segoe UI', system-ui, sans-serif;
                    font-size: 1.6rem;
                    font-weight: 700;
                    color: #1a1a1a;
                }

                /* ── CTA Button ── */
                #ch-ad-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    background: #1a1a1a;
                    color: #ffffff;
                    border: none;
                    border-radius: 10px;
                    padding: 14px 28px;
                    font-family: 'Segoe UI', system-ui, sans-serif;
                    font-size: 0.95rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: background 0.2s ease, transform 0.15s ease;
                    width: 100%;
                    justify-content: center;
                }
                #ch-ad-btn:disabled {
                    background: #cccccc;
                    cursor: not-allowed;
                    transform: none;
                }
                #ch-ad-btn:not(:disabled):hover {
                    background: #000000;
                    transform: translateY(-1px);
                }
                #ch-ad-btn:not(:disabled):active {
                    transform: scale(0.97);
                }

                #ch-ad-tagline {
                    margin-top: 14px;
                    font-family: 'Segoe UI', system-ui, sans-serif;
                    font-size: 0.76rem;
                    color: #aaa;
                }
            `;
            document.head.appendChild(style);
        }

        /* ── Build modal ── */
        const overlay = document.createElement('div');
        overlay.id = 'ch-ad-overlay';

        const iconClass = type === 'timer' ? 'fas fa-clock' : 'fas fa-heart';
        const titleText = type === 'timer'
            ? 'Support the Creator'
            : 'Keep the Downloads Free';

        const circumference = 2 * Math.PI * 30; // r=30

        overlay.innerHTML = `
            <div id="ch-ad-box">
                <div id="ch-ad-icon"><i class="${iconClass}"></i></div>
                <div id="ch-ad-title">${titleText}</div>
                <div id="ch-ad-msg">${message}</div>

                <div id="ch-ad-ring-wrap">
                    <svg id="ch-ad-ring-svg" viewBox="0 0 80 80">
                        <circle id="ch-ad-ring-bg" cx="40" cy="40" r="30"/>
                        <circle id="ch-ad-ring-fill" cx="40" cy="40" r="30"
                            stroke-dasharray="${circumference}"
                            stroke-dashoffset="0"/>
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

        /* ── Countdown logic ── */
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

            /* Countdown goes downward: offset increases as time passes */
            const progress  = (waitSeconds - remaining) / waitSeconds; // 0 → 1
            const offset    = circumference * progress;
            ring.style.strokeDashoffset = offset;

            if (remaining <= 0) {
                /* Unlock button */
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

        /* ── Button click → redirect ── */
        btn.addEventListener('click', () => {
            if (btn.disabled) return;
            document.body.removeChild(overlay);
            /* Open ad in new tab so user returns to site */
            window.open(redirectUrl, '_blank');
        });
    }

    /* ── Boot ── */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadAdSettings);
    } else {
        loadAdSettings();
    }

})();
