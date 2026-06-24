/**
 * CHAOS AD CONFIG — chaos-ads-config.js
 * Load this BEFORE chaos-ads-engine.js
 */

window.AdConfig = {

  /* ── SCHEDULE ──────────────────────────────────────────────
     Controls when ads fire relative to page load.
     Each entry is a [min, max] range in seconds — a random
     point inside that range is picked every time, so the
     schedule doesn't feel mechanical. */
  schedule: {
    firstAd:        [20, 30],    // 1st ad: somewhere in the first 30s
    secondAd:       [90, 120],   // 2nd ad: between 1:30 and 2:00
    repeatInterval: [240, 300]   // after that: every 4–5 min, repeating
  },

  /* ── VIDEO ADS ─────────────────────────────────────────────
     A fresh random pick is made every single time an ad fires
     (not locked to one video per session). */
  videos: [
    { src: "pics/vid1.mp4",  label: "Ad" },
    { src: "pics/vid2.mp4",  label: "Ad" },
    { src: "pics/vid3.mp4",  label: "Ad" },
    { src: "pics/vid4.mp4",  label: "Ad" },
    { src: "pics/vid5.mp4",  label: "Ad" },
    { src: "pics/vid6.mp4",  label: "Ad" },
    { src: "pics/vid7.mp4",  label: "Ad" },
    { src: "pics/vid8.mp4",  label: "Ad" },
    { src: "pics/vid9.mp4",  label: "Ad" },
    { src: "pics/vid10.mp4", label: "Ad" },
    { src: "pics/vid11.mp4", label: "Ad" },
    { src: "pics/vid12.mp4", label: "Ad" },
    { src: "pics/vid13.mp4", label: "Ad" },
    { src: "pics/vid14.mp4", label: "Ad" },
    { src: "pics/vid15.mp4", label: "Ad" }
  ],

  /* ── SKIP / CANCEL RULES ───────────────────────────────────
     How long someone has to wait before the Cancel button
     appears, based on the video's own duration. */
  skipRules: {
    autoAdvanceThreshold: 15,   // videos shorter than this: no wait, auto-close on end
    shortSkipTime: 15,         // videos 15–30s: cancel unlocks after 15s
    longSkipTime: 30,          // videos > 30s: cancel unlocks after 30s
    longVideoThreshold: 30
  }

};
