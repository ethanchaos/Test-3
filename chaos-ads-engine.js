/**
 * CHAOS AD ENGINE — chaos-ads-engine.js
 * ─────────────────────────────────────────────────────────────────
 * Drop these two script tags into any page (in this order):
 *   <script src="chaos-ads-config.js"></script>
 *   <script src="chaos-ads-engine.js"></script>
 * This file injects all HTML + wires up all logic automatically.
 * Depends on: chaos-ads-config.js  +  chaos-ad-styles.css
 *
 * v2 changes:
 *  - Removed the "install app" bottom-sheet step entirely. The
 *    button that used to say "Next" and open that sheet is now a
 *    "Cancel" button that closes the ad directly.
 *  - Video pick is randomized fresh every time an ad shows
 *    (no longer locked to one video per session).
 *  - Ads now fire on a schedule (first ad / second ad / repeating
 *    interval) instead of a single one-shot timer — see
 *    AdConfig.schedule in chaos-ads-config.js.
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
    link.href = base + "chaos-ad-styles.css";
    document.head.appendChild(link);
  })();

  /* ─── 2. INJECT HTML ─────────────────────────────────────────── */
  function injectHTML() {
    const html = `
<!-- ══════════ CHAOS AD SYSTEM OVERLAY ══════════ -->
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

      <!-- Timer pill (shows countdown before Cancel is available) -->
      <div id="ad-timer-pill">
        <span id="ad-timer-text">—</span>
      </div>

      <!-- Cancel button (appears after timer, closes the ad immediately) -->
      <button id="ad-skip-btn" aria-label="Cancel advertisement">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
        Cancel
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

</div>
<!-- ══════════ / CHAOS AD SYSTEM ══════════ -->
    `;
    document.body.insertAdjacentHTML("beforeend", html);
  }

  /* ─── 3. UTILITY HELPERS ─────────────────────────────────────── */
  function randomFrom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // Pick a random point inside a [min, max] seconds range, return ms.
  function randomDelayMs(range, fallback) {
    const r = range || fallback;
    const [min, max] = r;
    return (min + Math.random() * (max - min)) * 1000;
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
    const progressFill  = document.getElementById("ad-progress-fill");
    const muteBtn       = document.getElementById("ad-mute-btn");
    const iconSound     = document.getElementById("ad-icon-sound");
    const iconMuted     = document.getElementById("ad-icon-muted");
    const volumeBar     = document.getElementById("ad-volume-bar");
    const volumeFill    = document.getElementById("ad-volume-fill");

    /* State */
    let currentAd       = null;
    let skipDelay        = null;
    let skipTimerLeft    = 0;
    let skipInterval     = null;
    let progressInterval = null;
    let isPaused         = false;
    let isMuted           = true;  // starts muted for autoplay; unmute prompt shown to user
    let pauseHideTimer    = null;
    let adDuration        = 0;

    const unmutePrompt = document.getElementById("ad-unmute-prompt");
    let unmuteShown    = false;
    let unmuteTimer    = null;

    /* ── Show overlay ── */
    function showAd() {
      // Fresh random pick every single time the ad fires.
      currentAd = randomFrom(config.videos);

      // Always start muted for autoplay — unmute prompt shown to user
      isMuted       = true;
      isPaused      = false;
      unmuteShown   = false;
      clearTimeout(unmuteTimer);
      video.muted   = true;
      video.volume  = 1;
      syncMuteUI();

      loadingEl.classList.remove("hidden");
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
      console.warn("[ChaosAdSystem] Video failed to load:", currentAd ? currentAd.src : "unknown");
      loadingEl.classList.add("hidden");
      skipDelay = null;
      hideAd();
    });

    /* ── Timer logic ── */
    function setupTimer() {
      clearInterval(skipInterval);
      skipBtn.classList.remove("visible");

      if (skipDelay === null) {
        // Auto-advance: no timer shown, no cancel button needed
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

    /* ── Video ended naturally — just close, no extra step ── */
    video.addEventListener("ended", () => {
      clearInterval(skipInterval);
      clearInterval(progressInterval);
      progressFill.style.width = "100%";
      hideAd();
    });

    /* ── Cancel button — closes the ad immediately ── */
    skipBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      hideAd();
    });

    /* ── Click to pause / resume ── */
    clickArea.addEventListener("click", () => {
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

    /* ── Hide ad overlay ── */
    function hideAd() {
      overlay.classList.remove("ad-visible");
      document.body.style.overflow = "";
      video.src = "";
      clearInterval(skipInterval);
      clearInterval(progressInterval);
      isPaused = false;
      currentAd = null;
      video.classList.remove("playing");
      clearTimeout(unmuteTimer);
      unmutePrompt.classList.remove("visible");
      unmuteShown = false;
      document.getElementById("ad-progress-track").style.display = "";
    }

    /* ── PUBLIC ── */
    return {
      show: showAd,
      isVisible: () => overlay.classList.contains("ad-visible")
    };
  }

  /* ─── 5. SCHEDULER ───────────────────────────────────────────── */
  // first ad → second ad → then repeating, per AdConfig.schedule.
  function scheduleAds(system, config) {
    const sched = config.schedule || {};

    function safeShow() {
      // Don't stack a new ad on top of one already playing.
      if (system.isVisible()) return;
      system.show();
    }

    // 1st ad — somewhere in the first 30s
    setTimeout(safeShow, randomDelayMs(sched.firstAd, [20, 30]));

    // 2nd ad — between 1:30 and 2:00
    const secondDelay = randomDelayMs(sched.secondAd, [90, 120]);
    setTimeout(safeShow, secondDelay);

    // From then on, repeat every 4–5 min (fresh random gap each cycle)
    function repeatCycle() {
      const gap = randomDelayMs(sched.repeatInterval, [240, 300]);
      setTimeout(() => {
        safeShow();
        repeatCycle();
      }, gap);
    }
    setTimeout(repeatCycle, secondDelay);
  }

  /* ─── 6. BOOT SEQUENCE ───────────────────────────────────────── */
  function boot() {
    // Ensure config is loaded
    if (!window.AdConfig) {
      console.error("[ChaosAdSystem] chaos-ads-config.js must be loaded before chaos-ads-engine.js");
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

    scheduleAds(system, window.AdConfig);

    // Expose globally for manual trigger: ChaosAdSystem.show()
    window.ChaosAdSystem = system;
  }

  /* Run after DOM is ready */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

})();
