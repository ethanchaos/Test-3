/**
 * AD CONFIG — ads-config.js
 */

window.AdConfig = {

  /* TIMING */
  triggerDelay: 20,

  /* VIDEO ADS */
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

  /* SKIP RULES */
  skipRules: {
    autoAdvanceThreshold: 15,
    shortSkipTime: 15,
    longSkipTime: 30,
    longVideoThreshold: 30
  },

  /* PLAY STORE APPS */
  apps: [
    {
      name: "Lets VPN go",
      developer: "lets vpn go",
      rating: 4.7,
      reviews: "10k+",
      icon: "🐇",
      iconUrl: "pics/lets.jpg",
      description: "Fast, secure and reliable VPN. Protect your privacy, bypass geo-restrictions and enjoy unrestricted internet access worldwide.",
      playStoreUrl: "https://play.google.com/store/apps/details?id=smith.vpn.ko.ni.pro",
      screenshots: [
        "pics/let1.webp",
        "pics/let2.webp",
        "pics/let3.webp",
        "pics/let4.webp"
      ],
      category: "FAST VPN - FREE NET",
      size: "38 MB",
      installs: "100k+"
    }
  ],

  /* MODAL */
  modal: {
    closeTimerSeconds: 10
  }

};