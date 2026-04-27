/**
 * AD ENGINE — ads-engine.js
 * ─────────────────────────────────────────────────────────────────
 * Drop a single <script src="ads-engine.js"> into any page.
 * This file injects all HTML + wires up all logic automatically.
 * Depends on: ads-config.js  +  ad-styles.css
 * ─────────────────────────────────────────────────────────────────
 */

(function () {
  "use strict";

  /* ─── 1. INJECT CSS LINK ─────────────────────────────────────── */
  (function injectCSS() {
    const scriptSrc = document.currentScript
      ? document.currentScript.src
      : "";
    const base = scriptSrc.substring(0, scriptSrc.lastIndexOf("/") + 1);
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = base + "ad-styles.css";
    document.head.appendChild(link);
  })();

  /* ─── 2. INJECT HTML ─────────────────────────────────────────── */
  function injectHTML() {
    const html = `
<!-- ══════════ AD SYSTEM OVERLAY ══════════ -->
<div id="ad-overlay" role="dialog" aria-modal="true" aria-label="Advertisement">

  <!-- Video layer -->
  <div id="ad-video-container">
    <video id="ad-video" playsinline webkit-playsinline></video>
  </div>

  <!-- Loading overlay (hides once video is ready to play) -->
  <div id="ad-loading">
    <div class="ad-loader-ring">
      <div class="ad-loader-dot"></div>
    </div>
    <span class="ad-loading-text">Loading</span>
  </div>

  <!-- Unmute prompt pill (shown briefly after ad starts) -->
  <div id="ad-unmute-prompt">
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
      <path d="M14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
    </svg>
    <span>Tap to unmute</span>
  </div>

  <!-- Click-anywhere-to-pause area -->
  <div id="ad-click-area"></div>

  <!-- Pause indicator (centre) -->
  <div id="ad-pause-indicator">
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
  </div>

  <!-- ── TOP BAR ── -->
  <div id="ad-top-bar">
    <span id="ad-label">Ad</span>
    <div id="ad-skip-area">

      <!-- Timer pill (shows countdown before skip is available) -->
      <div id="ad-timer-pill">
        <span id="ad-timer-text">—</span>
      </div>

      <!-- Skip / Next button (appears after timer) -->
      <button id="ad-skip-btn" aria-label="Skip ad">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 18l8.5-6L6 6v12zm2-8.14L11.03 12 8 14.14V9.86zM16 6h2v12h-2z"/>
        </svg>
        Next
      </button>

      <!-- Exit button (shown after modal is closed / after skip) -->
      <button id="ad-exit-btn" aria-label="Close advertisement">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>

    </div>
  </div>

  <!-- ── PROGRESS BAR ── -->
  <div id="ad-progress-track">
    <div id="ad-progress-bg">
      <div id="ad-progress-fill"></div>
    </div>
  </div>

  <!-- ── BOTTOM BAR ── -->
  <div id="ad-bottom-bar">

    <!-- Mute toggle -->
    <button id="ad-mute-btn" aria-label="Toggle mute">
      <svg id="ad-icon-sound" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
        <path id="ad-icon-wave" d="M14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
      </svg>
      <svg id="ad-icon-muted" viewBox="0 0 24 24" fill="currentColor" style="display:none">
        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
      </svg>
    </button>

    <!-- Volume track (shows on hover of mute btn) -->
    <div id="ad-volume-bar">
      <div id="ad-volume-track">
        <div id="ad-volume-fill"></div>
      </div>
    </div>

  </div>

  <!-- ── PLAY STORE MODAL (bottom sheet) ── -->
  <div id="ad-playstore-modal" role="dialog" aria-label="Download app">
    <div id="ad-playstore-backdrop"></div>
    <div id="ad-playstore-sheet">

      <div id="ad-sheet-handle"></div>

      <!-- Countdown bar at top of modal -->
      <div id="ad-close-timer-bar">
        <div id="ad-close-timer-fill"></div>
      </div>

      <div id="ad-app-card">

        <!-- App header -->
        <div id="ad-app-header">
          <div id="ad-app-icon"><span id="ad-app-icon-emoji"></span></div>
          <div id="ad-app-info">
            <div id="ad-app-name"></div>
            <div id="ad-app-developer"></div>
            <div id="ad-app-rating">
              <span id="ad-app-stars"></span>
              <span id="ad-app-rating-num"></span>
            </div>
          </div>
        </div>

        <!-- Screenshots strip -->
        <div id="ad-app-screenshots"></div>

        <!-- Description -->
        <div id="ad-app-description"></div>

        <!-- CTA row -->
        <div id="ad-app-cta-row">
          <button id="ad-install-btn">Install</button>
          <button id="ad-close-modal-btn" aria-label="Close ad">
            <span class="close-countdown" id="ad-close-countdown">5</span>
          </button>
        </div>

      </div>
    </div>
  </div>

</div>
<!-- ══════════ / AD SYSTEM ══════════ -->
    `;
    document.body.insertAdjacentHTML("beforeend", html);
  }

  /* ─── 3. UTILITY HELPERS ─────────────────────────────────────── */
  function randomFrom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function starsHTML(rating) {
    const full  = Math.floor(rating);
    const half  = rating % 1 >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    return "★".repeat(full) + (half ? "½" : "") + "☆".repeat(empty);
  }

  function getSkipDelay(duration, rules) {
    if (duration < rules.autoAdvanceThreshold) return null; // auto-advance
    if (duration <= rules.longVideoThreshold)  return rules.shortSkipTime;
    return rules.longSkipTime;
  }

  /* ─── 4. MAIN AD CONTROLLER ──────────────────────────────────── */
  function AdSystem(config) {
    /* Elements */
    const overlay       = document.getElementById("ad-overlay");
    const video         = document.getElementById("ad-video");
    const loadingEl     = document.getElementById("ad-loading");
    const clickArea     = document.getElementById("ad-click-area");
    const pauseInd      = document.getElementById("ad-pause-indicator");
    const timerPill     = document.getElementById("ad-timer-pill");
    const timerText     = document.getElementById("ad-timer-text");
    const skipBtn       = document.getElementById("ad-skip-btn");
    const exitBtn       = document.getElementById("ad-exit-btn");
    const progressFill  = document.getElementById("ad-progress-fill");
    const muteBtn       = document.getElementById("ad-mute-btn");
    const iconSound     = document.getElementById("ad-icon-sound");
    const iconMuted     = document.getElementById("ad-icon-muted");
    const iconWave      = document.getElementById("ad-icon-wave");
    const volumeBar     = document.getElementById("ad-volume-bar");
    const volumeFill    = document.getElementById("ad-volume-fill");
    const modal         = document.getElementById("ad-playstore-modal");
    const modalBackdrop = document.getElementById("ad-playstore-backdrop");
    const closeTimerFill= document.getElementById("ad-close-timer-fill");
    const appIcon       = document.getElementById("ad-app-icon-emoji");
    const appName       = document.getElementById("ad-app-name");
    const appDev        = document.getElementById("ad-app-developer");
    const appStars      = document.getElementById("ad-app-stars");
    const appRatingNum  = document.getElementById("ad-app-rating-num");
    const appScreenshots= document.getElementById("ad-app-screenshots");
    const appDesc       = document.getElementById("ad-app-description");
    const installBtn    = document.getElementById("ad-install-btn");
    const closeModalBtn = document.getElementById("ad-close-modal-btn");
    const closeCountdown= document.getElementById("ad-close-countdown");

    /* State */
    let currentAd       = null;
    let skipDelay       = null;
    let skipTimerLeft   = 0;
    let skipInterval    = null;
    let progressInterval= null;
    let isPaused        = false;
    let isMuted         = true;  // starts muted for autoplay; unmute prompt shown to user
    let pauseHideTimer  = null;
    let currentApp      = null;
    let modalCloseLeft  = 0;
    let modalInterval   = null;
    let adDuration      = 0;

    const unmutePrompt = document.getElementById("ad-unmute-prompt");
    let unmuteShown    = false;
    let unmuteTimer    = null;

    /* ── Show overlay ── */
    function showAd() {
      // Lock the video choice for this entire session — never changes mid-run
      if (!currentAd) {
        currentAd = randomFrom(config.videos);
      }

      // Always start muted for autoplay — unmute prompt shown to user
      isMuted       = true;
      isPaused      = false;
      unmuteShown   = false;
      clearTimeout(unmuteTimer);
      video.muted   = true;
      video.volume  = 1;
      syncMuteUI();

      loadingEl.classList.remove("hidden");
      exitBtn.classList.remove("visible");
      unmutePrompt.classList.remove("visible");
      overlay.classList.add("ad-visible");
      document.body.style.overflow = "hidden";
      video.classList.remove("playing");

      timerPill.style.display = "none";
      skipBtn.classList.remove("visible");
      progressFill.style.width = "0%";

      video.src = currentAd.src;
      video.load();
      video.play().catch(() => {});
    }

    /* ── playing: video is actually rendering frames ── */
    video.addEventListener("playing", () => {
      loadingEl.classList.add("hidden");
      video.classList.add("playing");

      // Show unmute prompt if muted and not yet shown this session
      if (!unmuteShown && isMuted) {
        unmuteShown = true;
        unmutePrompt.classList.add("visible");
        // Dismiss time scales with video length
        const dismissMs = adDuration > 30 ? 20000 : adDuration > 15 ? 13000 : 10000;
        unmuteTimer = setTimeout(() => {
          unmutePrompt.classList.remove("visible");
        }, dismissMs);
      }
    });

    /* ── Tapping the unmute prompt unmutes and saves preference ── */
    unmutePrompt.addEventListener("click", (e) => {
      e.stopPropagation();
      clearTimeout(unmuteTimer);
      isMuted = false;
      video.muted = false;
      video.volume = 1;
      syncMuteUI();
      unmutePrompt.classList.remove("visible");

    });

    /* ── Once metadata is loaded, set up timer and progress bar ── */
    video.addEventListener("loadedmetadata", () => {
      adDuration = video.duration;
      console.log(`[AdSystem] Detected duration: ${adDuration.toFixed(2)}s`);

      skipDelay = getSkipDelay(adDuration, config.skipRules);
      setupTimer();

      // Only show progress bar for videos ≤ 15 seconds
      if (adDuration <= config.skipRules.autoAdvanceThreshold) {
        startProgress(adDuration);
      } else {
        document.getElementById("ad-progress-track").style.display = "none";
      }
    });

    /* ── Handle video load failure ── */
    video.addEventListener("error", () => {
      console.warn("[AdSystem] Video failed to load:", currentAd ? currentAd.src : "unknown");
      loadingEl.classList.add("hidden");
      skipDelay = null;
      finishAd();
    });

    /* ── Exit button (shown after ad is done, before full close) ── */
    exitBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      hideAd();
    });

    /* ── Timer logic ── */
    function setupTimer() {
      clearInterval(skipInterval);
      skipBtn.classList.remove("visible");

      if (skipDelay === null) {
        // Auto-advance: no timer shown
        timerPill.style.display = "none";
        return;
      }

      skipTimerLeft = skipDelay;
      timerText.textContent = skipTimerLeft;
      timerPill.style.display = "flex";

      skipInterval = setInterval(() => {
        if (isPaused) return;
        skipTimerLeft--;
        timerText.textContent = skipTimerLeft;

        if (skipTimerLeft <= 0) {
          clearInterval(skipInterval);
          timerPill.style.display = "none";
          skipBtn.classList.add("visible");
        }
      }, 1000);
    }

    /* ── Progress bar ── */
    function startProgress(duration) {
      clearInterval(progressInterval);
      progressFill.style.width = "0%";

      const startTime = Date.now();
      const totalMs   = duration * 1000;

      progressInterval = setInterval(() => {
        if (isPaused) return;
        const elapsed = Date.now() - startTime;
        const pct     = Math.min((elapsed / totalMs) * 100, 100);
        progressFill.style.width = pct + "%";

        if (pct >= 100) {
          clearInterval(progressInterval);
        }
      }, 100);
    }

    /* ── Video ended — always auto-advance to app modal ── */
    video.addEventListener("ended", () => {
      clearInterval(skipInterval);
      clearInterval(progressInterval);
      progressFill.style.width = "100%";
      // Always go straight to modal when video finishes
      finishAd();
    });

    /* ── Skip button ── */
    skipBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      finishAd();
    });

    /* ── Finish ad → show modal ── */
    function finishAd() {
      clearInterval(skipInterval);
      clearInterval(progressInterval);
      video.pause();
      showModal();
    }

    /* ── Click to pause / resume ── */
    clickArea.addEventListener("click", () => {
      if (modal.classList.contains("open")) return;
      togglePause();
    });

    function togglePause() {
      if (isPaused) {
        video.play();
        isPaused = false;
        overlay.classList.remove("show-controls");
        pauseInd.classList.remove("show");
      } else {
        video.pause();
        isPaused = true;
        overlay.classList.add("show-controls");
        showPauseIndicator();
      }
    }

    function showPauseIndicator() {
      pauseInd.classList.add("show");
      clearTimeout(pauseHideTimer);
      if (!isPaused) {
        pauseHideTimer = setTimeout(() => pauseInd.classList.remove("show"), 900);
      }
    }

    /* ── Mute / unmute ── */
    muteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      isMuted = !isMuted;
      video.muted = isMuted;
      if (!isMuted) {
        video.volume = 1;
      }
      clearTimeout(unmuteTimer);
      unmutePrompt.classList.remove("visible");
      syncMuteUI();
    });

    muteBtn.addEventListener("mouseenter", () => volumeBar.classList.add("visible"));
    muteBtn.addEventListener("mouseleave", () => volumeBar.classList.remove("visible"));

    function syncMuteUI() {
      if (isMuted) {
        iconSound.style.display = "none";
        iconMuted.style.display = "block";
        volumeFill.style.width  = "0%";
      } else {
        iconSound.style.display = "block";
        iconMuted.style.display = "none";
        // Show full volume bar — video.volume may be 0 briefly during load, so hardcode 100%
        volumeFill.style.width  = "100%";
      }
    }

    /* Volume track click */
    document.getElementById("ad-volume-track").addEventListener("click", (e) => {
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();
      const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      video.volume = pct;
      video.muted  = pct === 0;
      isMuted      = pct === 0;
      syncMuteUI();
    });

    /* ── PLAY STORE MODAL ── */
    function showModal() {
      currentApp = randomFrom(config.apps);
      populateModal(currentApp);

      modal.classList.add("open");
      overlay.classList.add("show-controls");
      startModalTimer();
    }

    function populateModal(app) {
      // App icon — use real image if iconUrl is set, else emoji fallback
      appIcon.textContent = "";
      if (app.iconUrl) {
        const img = document.createElement("img");
        img.src = app.iconUrl;
        img.alt = app.name + " icon";
        img.style.cssText = "width:100%;height:100%;object-fit:cover;border-radius:18px;";
        appIcon.appendChild(img);
      } else {
        appIcon.textContent = app.icon || "📱";
      }
      appName.textContent          = app.name;
      appDev.textContent           = app.developer;
      appStars.textContent         = starsHTML(app.rating);
      appRatingNum.textContent     = `${app.rating} (${app.reviews})`;
      appDesc.textContent          = app.description;
      installBtn.textContent       = "Install";

      // Screenshots
      appScreenshots.innerHTML = "";
      if (app.screenshots && app.screenshots.length > 0) {
        app.screenshots.forEach(src => {
          const div = document.createElement("div");
          div.className = "ad-screenshot";
          const img = document.createElement("img");
          img.src = src;
          img.alt = "Screenshot";
          div.appendChild(img);
          appScreenshots.appendChild(div);
        });
      } else {
        // Placeholder tiles
        for (let i = 0; i < 4; i++) {
          const div = document.createElement("div");
          div.className = "ad-screenshot";
          div.style.background = `hsl(${200 + i * 30}, 25%, 88%)`;
          appScreenshots.appendChild(div);
        }
      }
    }

    function startModalTimer() {
      clearInterval(modalInterval);
      modalCloseLeft    = config.modal.closeTimerSeconds;
      closeCountdown.textContent = modalCloseLeft;
      closeTimerFill.style.transition = "none";
      closeTimerFill.style.width = "100%";

      // Animate the bar draining
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          closeTimerFill.style.transition = `width ${config.modal.closeTimerSeconds}s linear`;
          closeTimerFill.style.width = "0%";
        });
      });

      modalInterval = setInterval(() => {
        modalCloseLeft--;
        closeCountdown.textContent = Math.max(0, modalCloseLeft);

        if (modalCloseLeft <= 0) {
          clearInterval(modalInterval);
          closeModalBtn.style.cursor = "pointer";
          closeCountdown.textContent = "✕";
          closeModalBtn.setAttribute("aria-label", "Close ad");
        }
      }, 1000);
    }

    function dismissModal() {
      clearInterval(modalInterval);
      modal.classList.remove("open");
      // Directly close the entire ad — no extra exit button step
      hideAd();
    }

    closeModalBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (modalCloseLeft > 0) return; // blocked until timer is done
      dismissModal();
    });

    modalBackdrop.addEventListener("click", (e) => {
      e.stopPropagation();
      if (modalCloseLeft > 0) return;
      dismissModal();
    });

    installBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (currentApp && currentApp.playStoreUrl) {
        window.open(currentApp.playStoreUrl, "_blank", "noopener");
      }
      dismissModal();
    });

    /* ── Hide ad overlay ── */
    function hideAd() {
      overlay.classList.remove("ad-visible");
      document.body.style.overflow = "";
      video.src = "";
      clearInterval(skipInterval);
      clearInterval(progressInterval);
      clearInterval(modalInterval);
      isPaused = false;
      currentAd = null;
      video.classList.remove("playing");
      clearTimeout(unmuteTimer);
      unmutePrompt.classList.remove("visible");
      unmuteShown = false;
      document.getElementById("ad-progress-track").style.display = "";
    }

    /* ── PUBLIC ── */
    return { show: showAd };
  }

  /* ─── 5. BOOT SEQUENCE ───────────────────────────────────────── */
  function boot() {
    // Ensure config is loaded
    if (!window.AdConfig) {
      console.error("[AdSystem] ads-config.js must be loaded before ads-engine.js");
      return;
    }

    injectHTML();

    const system = AdSystem(window.AdConfig);

    // Unlock audio context on any user interaction before the ad fires.
    // This primes the browser so unmuted autoplay succeeds when the ad starts.
    function unlockAudio() {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      ctx.resume().then(() => ctx.close());
      document.removeEventListener("click",      unlockAudio);
      document.removeEventListener("touchstart", unlockAudio);
      document.removeEventListener("keydown",    unlockAudio);
      document.removeEventListener("scroll",     unlockAudio);
    }
    document.addEventListener("click",      unlockAudio, { once: true });
    document.addEventListener("touchstart", unlockAudio, { once: true });
    document.addEventListener("keydown",    unlockAudio, { once: true });
    document.addEventListener("scroll",     unlockAudio, { once: true });

    // Trigger after configured delay
    const delay = (window.AdConfig.triggerDelay || 5) * 1000;
    setTimeout(() => {
      system.show();
    }, delay);

    // Expose globally for manual trigger: AdSystem.show()
    window.AdSystem = system;
  }

  /* Run after DOM is ready */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

})();
