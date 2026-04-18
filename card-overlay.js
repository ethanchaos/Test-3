/* ════════════════════════════════════════════════
   card-overlay.js — Card long-press / tap overlay
   Power-button style: blur backdrop + Share & Download
   Linked dynamically by app.js
   ════════════════════════════════════════════════ */

(function initCardOverlay() {

    /* ── Inject Styles ── */
    const style = document.createElement('style');
    style.textContent = `
        /* ── Blur Backdrop ── */
        #ch-overlay-backdrop {
            position: fixed;
            inset: 0;
            z-index: 3000;
            background: rgba(10, 10, 10, 0.55);
            backdrop-filter: blur(18px) saturate(0.8);
            -webkit-backdrop-filter: blur(18px) saturate(0.8);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 0;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.28s cubic-bezier(0.4, 0, 0.2, 1);
        }

        #ch-overlay-backdrop.ch-active {
            opacity: 1;
            pointer-events: all;
        }

        /* ── File name label at top of overlay ── */
        #ch-overlay-label {
            color: rgba(255,255,255,0.55);
            font-size: 0.82rem;
            font-weight: 500;
            letter-spacing: 0.04em;
            margin-bottom: 32px;
            max-width: 260px;
            text-align: center;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            transform: translateY(10px);
            opacity: 0;
            transition: opacity 0.3s 0.08s ease, transform 0.3s 0.08s ease;
        }

        #ch-overlay-backdrop.ch-active #ch-overlay-label {
            opacity: 1;
            transform: translateY(0);
        }

        /* ── Button Row ── */
        #ch-overlay-buttons {
            display: flex;
            gap: 36px;
            align-items: center;
            justify-content: center;
        }

        /* ── Each Action Button ── */
        .ch-action-btn {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
            background: none;
            border: none;
            cursor: pointer;
            -webkit-tap-highlight-color: transparent;
            transform: scale(0.75) translateY(20px);
            opacity: 0;
            transition:
                transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1),
                opacity 0.28s ease;
        }

        #ch-overlay-backdrop.ch-active .ch-action-btn {
            transform: scale(1) translateY(0);
            opacity: 1;
        }

        #ch-overlay-backdrop.ch-active .ch-action-btn:nth-child(1) {
            transition-delay: 0.06s;
        }

        #ch-overlay-backdrop.ch-active .ch-action-btn:nth-child(2) {
            transition-delay: 0.13s;
        }

        .ch-action-btn:active .ch-btn-circle {
            transform: scale(0.9);
        }

        /* ── Circle Icon Container ── */
        .ch-btn-circle {
            width: 72px;
            height: 72px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.18s cubic-bezier(0.4, 0, 0.2, 1),
                        background 0.18s ease;
        }

        .ch-btn-circle.ch-share {
            background: rgba(255, 255, 255, 0.15);
            border: 1.5px solid rgba(255, 255, 255, 0.25);
        }

        .ch-btn-circle.ch-download {
            background: rgba(255, 255, 255, 0.15);
            border: 1.5px solid rgba(255, 255, 255, 0.25);
        }

        .ch-btn-circle i {
            font-size: 1.5rem;
            color: #ffffff;
        }

        .ch-action-btn:hover .ch-btn-circle {
            background: rgba(255, 255, 255, 0.25);
            transform: scale(1.06);
        }

        .ch-action-btn span {
            color: rgba(255, 255, 255, 0.85);
            font-size: 0.78rem;
            font-weight: 600;
            letter-spacing: 0.05em;
            text-transform: uppercase;
        }

        /* ════════════════════════
           Share Panel (slides up)
           ════════════════════════ */
        #ch-share-panel {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            z-index: 4000;
            background: #1a1a1a;
            border-radius: 20px 20px 0 0;
            padding: 20px 24px 36px;
            transform: translateY(100%);
            transition: transform 0.34s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 -8px 40px rgba(0,0,0,0.4);
        }

        #ch-share-panel.ch-panel-open {
            transform: translateY(0);
        }

        #ch-share-panel-handle {
            width: 36px;
            height: 4px;
            background: rgba(255,255,255,0.2);
            border-radius: 2px;
            margin: 0 auto 20px;
        }

        #ch-share-panel h4 {
            color: rgba(255,255,255,0.5);
            font-size: 0.72rem;
            font-weight: 600;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            margin-bottom: 10px;
        }

        /* ── URL Row ── */
        #ch-share-url-row {
            display: flex;
            align-items: center;
            gap: 10px;
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 12px;
            padding: 12px 14px;
            margin-bottom: 8px;
        }

        #ch-share-url-text {
            flex: 1;
            font-size: 0.85rem;
            color: #ffffff;
            font-family: 'Segoe UI', system-ui, monospace;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            user-select: all;
            -webkit-user-select: all;
        }

        /* ── Highlighted fragment in URL ── */
        #ch-share-url-text .ch-url-highlight {
            background: rgba(255, 255, 255, 0.18);
            border-radius: 4px;
            padding: 0 3px;
            color: #fff;
            font-weight: 700;
        }

        /* ── Copy Button ── */
        #ch-copy-btn {
            flex-shrink: 0;
            background: rgba(255,255,255,0.12);
            border: 1px solid rgba(255,255,255,0.18);
            border-radius: 8px;
            color: #fff;
            font-size: 0.78rem;
            font-weight: 600;
            letter-spacing: 0.04em;
            padding: 8px 14px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: background 0.2s ease, transform 0.15s ease;
            -webkit-tap-highlight-color: transparent;
            white-space: nowrap;
        }

        #ch-copy-btn:hover {
            background: rgba(255,255,255,0.22);
        }

        #ch-copy-btn:active {
            transform: scale(0.95);
        }

        #ch-copy-btn.ch-copied {
            background: rgba(56, 142, 60, 0.35);
            border-color: rgba(56, 142, 60, 0.5);
        }

        /* ── Hint text ── */
        #ch-share-hint {
            font-size: 0.75rem;
            color: rgba(255,255,255,0.3);
            margin-top: 6px;
            line-height: 1.4;
        }

        /* ── Dismiss button ── */
        #ch-share-close {
            width: 100%;
            margin-top: 20px;
            padding: 14px;
            border-radius: 12px;
            background: rgba(255,255,255,0.07);
            border: 1px solid rgba(255,255,255,0.1);
            color: rgba(255,255,255,0.7);
            font-size: 0.9rem;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.2s ease;
            -webkit-tap-highlight-color: transparent;
        }

        #ch-share-close:hover {
            background: rgba(255,255,255,0.12);
        }
    `;
    document.head.appendChild(style);

    /* ── Build DOM ── */
    // Backdrop
    const backdrop = document.createElement('div');
    backdrop.id = 'ch-overlay-backdrop';

    const label = document.createElement('div');
    label.id = 'ch-overlay-label';

    const btnRow = document.createElement('div');
    btnRow.id = 'ch-overlay-buttons';

    // Share button
    const shareBtn = document.createElement('button');
    shareBtn.className = 'ch-action-btn';
    shareBtn.innerHTML = `
        <div class="ch-btn-circle ch-share"><i class="fas fa-share-nodes"></i></div>
        <span>Share</span>
    `;

    // Download button
    const dlBtn = document.createElement('button');
    dlBtn.className = 'ch-action-btn';
    dlBtn.innerHTML = `
        <div class="ch-btn-circle ch-download"><i class="fas fa-download"></i></div>
        <span>Download</span>
    `;

    btnRow.appendChild(shareBtn);
    btnRow.appendChild(dlBtn);
    backdrop.appendChild(label);
    backdrop.appendChild(btnRow);
    document.body.appendChild(backdrop);

    // Share Panel
    const panel = document.createElement('div');
    panel.id = 'ch-share-panel';
    panel.innerHTML = `
        <div id="ch-share-panel-handle"></div>
        <h4>Share this config</h4>
        <div id="ch-share-url-row">
            <span id="ch-share-url-text"></span>
            <button id="ch-copy-btn"><i class="fas fa-copy"></i> Copy</button>
        </div>
        <div id="ch-share-hint"></div>
        <button id="ch-share-close">Done</button>
    `;
    document.body.appendChild(panel);

    /* ── State ── */
    let activeItem = null; // { url, filename, name }

    /* ── Open overlay ── */
    function openOverlay(item) {
        activeItem = item;
        label.textContent = item.filename || item.name || '';
        backdrop.classList.add('ch-active');
        document.body.style.overflow = 'hidden';
    }

    /* ── Close overlay ── */
    function closeOverlay() {
        backdrop.classList.remove('ch-active');
        document.body.style.overflow = '';
        activeItem = null;
    }

    /* ── Build the share URL ── */
    function buildShareUrl(item) {
        // Use the full current page URL (origin + pathname + search)
        const base = window.location.origin + window.location.pathname;
        // Append a ?config= query so the URL points at this specific file
        const slug = encodeURIComponent(item.filename || item.name || '');
        return base + '?config=' + slug;
    }

    /* ── Highlight the relevant part of the URL ── */
    function buildHighlightedUrl(fullUrl, item) {
        const slug = encodeURIComponent(item.filename || item.name || '');
        const param = 'config=' + slug;
        const idx = fullUrl.indexOf(param);
        if (idx === -1) return escapeHtml(fullUrl);
        const before = escapeHtml(fullUrl.slice(0, idx));
        const mid    = escapeHtml(fullUrl.slice(idx, idx + param.length));
        const after  = escapeHtml(fullUrl.slice(idx + param.length));
        return `${before}<span class="ch-url-highlight">${mid}</span>${after}`;
    }

    function escapeHtml(s) {
        return s.replace(/[&<>"']/g, m => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        }[m]));
    }

    /* ── Open share panel ── */
    function openSharePanel(item) {
        const url = buildShareUrl(item);
        const urlTextEl = document.getElementById('ch-share-url-text');
        const hintEl    = document.getElementById('ch-share-hint');
        urlTextEl.innerHTML = buildHighlightedUrl(url, item);
        urlTextEl.dataset.rawUrl = url;
        hintEl.textContent = 'Share this link — it points directly to "' +
            (item.filename || item.name || 'this config') + '"';

        // Reset copy btn
        const copyBtn = document.getElementById('ch-copy-btn');
        copyBtn.classList.remove('ch-copied');
        copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';

        panel.classList.add('ch-panel-open');
    }

    /* ── Close share panel ── */
    function closeSharePanel() {
        panel.classList.remove('ch-panel-open');
    }

    /* ── Copy handler ── */
    document.getElementById('ch-copy-btn').addEventListener('click', function () {
        const urlTextEl = document.getElementById('ch-share-url-text');
        const raw = urlTextEl.dataset.rawUrl || urlTextEl.textContent;
        navigator.clipboard.writeText(raw).then(() => {
            this.classList.add('ch-copied');
            this.innerHTML = '<i class="fas fa-check"></i> Copied!';
        }).catch(() => {
            // fallback
            const ta = document.createElement('textarea');
            ta.value = raw;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            this.classList.add('ch-copied');
            this.innerHTML = '<i class="fas fa-check"></i> Copied!';
        });
    });

    /* ── Share button in overlay ── */
    shareBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (!activeItem) return;
        // Close overlay first so backdrop stays, then open share panel
        backdrop.classList.remove('ch-active');
        document.body.style.overflow = '';
        openSharePanel(activeItem);
    });

    /* ── Download button in overlay ── */
    dlBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (!activeItem) return;

        // Snapshot the item before closing (closeOverlay nulls activeItem)
        const itemToDownload = {
            url:      activeItem.url,
            filename: activeItem.filename
        };

        closeOverlay();

        // Use the global downloadFile from app.js.
        // activeItem.url may be a bare filename — downloadFile handles resolution.
        if (typeof downloadFile === 'function') {
            downloadFile(itemToDownload.url, itemToDownload.filename);
        } else {
            // downloadFile not yet available — retry after a short tick
            setTimeout(() => {
                if (typeof downloadFile === 'function') {
                    downloadFile(itemToDownload.url, itemToDownload.filename);
                } else {
                    console.error('[card-overlay] downloadFile() not found on window.');
                }
            }, 200);
        }
    });

    /* ── Backdrop click → close ── */
    backdrop.addEventListener('click', function (e) {
        if (e.target === backdrop) closeOverlay();
    });

    /* ── Share close button ── */
    document.getElementById('ch-share-close').addEventListener('click', closeSharePanel);

    /* ── Attach listeners to cards once rendered ── */
    function attachCardListeners() {
        const configList = document.getElementById('configList');
        if (!configList) return;

        // Use event delegation — catches cards added dynamically
        configList.addEventListener('click', function (e) {
            // If the click is on the download button, let app.js handle it
            if (e.target.closest('.download-btn')) return;

            const card = e.target.closest('.config-item');
            if (!card) return;

            e.preventDefault();
            e.stopPropagation();

            // Pull data from the download button inside the card
            const btn = card.querySelector('.download-btn');
            if (!btn) return;

            openOverlay({
                url:      btn.dataset.url,
                filename: btn.dataset.filename,
                name:     card.querySelector('h3')?.textContent || btn.dataset.filename
            });
        });
    }

    // Wait for the render engine to finish building the list
    // We observe the configList for childList changes
    function waitForList() {
        const configList = document.getElementById('configList');
        if (!configList) {
            // Try again after DOM is ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', waitForList);
            } else {
                setTimeout(waitForList, 200);
            }
            return;
        }
        attachCardListeners();
    }

    waitForList();

})();
