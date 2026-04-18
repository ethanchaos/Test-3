/**
 * community.js
 * ─────────────────────────────────────────────────────────────
 * Main logic for community.html:
 *  - Fetches communities.json  → renders community cards (enabled only)
 *  - Fetches commupdates.json  → renders update items (enabled only)
 *  - Nav toggle
 *  - Bottom-nav active state
 *  - Scroll-reveal animations
 *  - Community request modal  → writes to pending-communities.json on GitHub
 *    (pic field is left blank — to be filled in manually)
 * ─────────────────────────────────────────────────────────────
 */

/* ── Boot MainActivty (addon/plugin controller) ── */
const _maScript = document.createElement('script');
_maScript.src = 'mainactivity.js';
document.head.appendChild(_maScript);

/* ════════════════════════════════════════════
   Platform metadata lookup
   ════════════════════════════════════════════ */
const PLATFORM_META = {
  "whatsapp-group":   { label: "WhatsApp Group",   icon: "fab fa-whatsapp",  badge: "whatsapp" },
  "whatsapp-channel": { label: "WhatsApp Channel", icon: "fab fa-whatsapp",  badge: "whatsapp" },
  "telegram":         { label: "Telegram Channel", icon: "fab fa-telegram",  badge: "telegram" },
  "youtube":          { label: "YouTube Channel",  icon: "fab fa-youtube",   badge: "youtube"  },
  "tiktok":           { label: "TikTok",           icon: "fab fa-tiktok",    badge: "tiktok"   },
  "facebook":         { label: "Facebook",         icon: "fab fa-facebook",  badge: "facebook" },
  "instagram":        { label: "Instagram",        icon: "fab fa-instagram", badge: "instagram"},
  "discord":          { label: "Discord",          icon: "fab fa-discord",   badge: "discord"  },
  "twitter":          { label: "Twitter / X",      icon: "fab fa-twitter",   badge: "twitter"  },
  "reddit":           { label: "Reddit",           icon: "fab fa-reddit",    badge: "reddit"   },
  "generic":          { label: "Community",        icon: "fas fa-globe",     badge: "generic"  }
};

/* ════════════════════════════════════════════
   Activity icon lookup (by keyword)
   ════════════════════════════════════════════ */
function activityIcon(activity) {
  const a = activity.toLowerCase();
  if (a.includes("daily") || a.includes("update")) return "fas fa-bolt";
  if (a.includes("video") || a.includes("weekly")) return "fas fa-video";
  if (a.includes("upload"))                        return "fas fa-film";
  if (a.includes("member"))                        return "fas fa-users";
  return "fas fa-circle-dot";
}

/* ════════════════════════════════════════════
   Build a community card element
   ════════════════════════════════════════════ */
function buildCard(comm) {
  const meta = PLATFORM_META[comm.platform] || PLATFORM_META["generic"];

  const card = document.createElement("div");
  card.className   = "community-card";
  card.dataset.href = comm.href || "#";

  card.innerHTML = `
    <div class="icon-wrap">
      <div class="channel-icon">
        <img src="${comm.pic}" alt="${escHtml(comm.name)}"
             onerror="this.src='https://cdn-icons-png.flaticon.com/512/2972/2972185.png'">
      </div>
      <div class="platform-badge ${meta.badge}">
        <i class="${meta.icon}"></i>
      </div>
    </div>
    <div class="community-info">
      <div class="community-name">${escHtml(comm.name)}</div>
      <div class="platform-label">
        <i class="${meta.icon}"></i> ${meta.label}
      </div>
      <div class="community-meta">
        <span>
          <span class="status-dot${comm.status === "active" ? "" : " offline"}"></span>
          ${comm.status === "active" ? "Active" : "Offline"}
        </span>
        ${comm.activity ? `<span><i class="${activityIcon(comm.activity)}"></i> ${escHtml(comm.activity)}</span>` : ""}
        ${comm.size     ? `<span><i class="fas fa-users"></i> ${escHtml(comm.size)}</span>` : ""}
      </div>
    </div>
    <a href="${comm.href || "#"}" target="_blank" class="join-btn" title="Join" aria-label="Join ${escHtml(comm.name)}">
      <i class="fas fa-arrow-right"></i>
    </a>`;

  card.addEventListener("click", e => {
    if (e.target.closest(".join-btn")) return;
    const href = card.dataset.href;
    if (href && href !== "#") window.open(href, "_blank");
  });

  return card;
}

/* ════════════════════════════════════════════
   Build an update item element
   ════════════════════════════════════════════ */
function buildUpdate(upd) {
  const el = document.createElement("div");
  el.className = "update-item";
  el.innerHTML = `
    <div>${escHtml(upd.text)}</div>
    <div class="update-time">${escHtml(upd.time)}</div>`;
  return el;
}

/* ════════════════════════════════════════════
   Scroll-reveal helper
   ════════════════════════════════════════════ */
function setupReveal(selector, delay = 45) {
  const els = document.querySelectorAll(selector);
  function reveal() {
    els.forEach((el, i) => {
      if (el.getBoundingClientRect().top < window.innerHeight * 0.95) {
        setTimeout(() => el.classList.add("visible"), delay * i);
      }
    });
  }
  window.addEventListener("scroll", reveal, { passive: true });
  reveal();
}

/* ════════════════════════════════════════════
   Fetch + render communities
   ════════════════════════════════════════════ */
async function loadCommunities() {
  const list = document.getElementById("communityList");
  if (!list) return;

  try {
    const res  = await fetch("https://raw.githubusercontent.com/ethanchaos/Test-3/main/communities.json?_=" + Date.now());
    const data = await res.json();

    list.innerHTML = "";
    data
      .filter(c => c.enabled)
      .forEach(c => list.appendChild(buildCard(c)));

    setupReveal(".community-card", 45);
  } catch (err) {
    console.error("community.js — loadCommunities error:", err);
    list.innerHTML = `<p style="padding:20px;color:#9aa0aa;font-size:.85rem;">
      Could not load communities. Check back soon.</p>`;
  }
}

/* ════════════════════════════════════════════
   Fetch + render updates
   ════════════════════════════════════════════ */
async function loadUpdates() {
  const list = document.getElementById("updatesList");
  if (!list) return;

  try {
    const res  = await fetch("commupdates.json?_=" + Date.now());
    const data = await res.json();

    list.innerHTML = "";
    data
      .filter(u => u.enabled)
      .forEach(u => list.appendChild(buildUpdate(u)));

    setupReveal(".update-item", 60);
  } catch (err) {
    console.error("community.js — loadUpdates error:", err);
  }
}

/* ════════════════════════════════════════════
   Modal (exists in HTML)
   ════════════════════════════════════════════ */

// Generate platform pills from PLATFORM_META
function generatePlatformPills() {
  const container = document.getElementById("platPills");
  if (!container) return;

  const platforms = Object.keys(PLATFORM_META);
  container.innerHTML = platforms.map(key => {
    const meta = PLATFORM_META[key];
    return `<div class="plat-pill" data-platform="${key}">
      <i class="${meta.icon}"></i> ${meta.label}
    </div>`;
  }).join('');
}

function openRequestModal() {
  const overlay = document.getElementById("commReqOverlay");
  overlay.classList.add("open");
  document.getElementById("creqName").focus();
}

function closeRequestModal() {
  const overlay = document.getElementById("commReqOverlay");
  if (overlay) overlay.classList.remove("open");
  _resetRequestModal();
}

function _resetRequestModal() {
  // Clear all text inputs
  const inputIds = [
    "creqName","creqLink","creqWhatsapp","creqFbUser","creqIgUser",
    "creqDiscordUser","creqTwitterUser","creqHandle",
    "creqOptFacebook","creqOptTelegram"
  ];
  inputIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  const members = document.getElementById("creqMembers");
  if (members) members.value = "";

  const hidden = document.getElementById("creqPlatform");
  if (hidden) hidden.value = "";
  document.querySelectorAll(".plat-pill").forEach(p => p.classList.remove("selected"));
  _showConditionalField(null);

  const success = document.getElementById("commReqSuccess");
  const form    = document.getElementById("commReqForm");
  if (success) success.classList.remove("show");
  if (form) form.style.display = "";

  const status = document.getElementById("commReqStatus");
  if (status) { status.textContent = ""; status.className = ""; }
  const btn = document.getElementById("commReqSubmit");
  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Request'; }
}

function _showConditionalField(platform) {
  // Hide all conditional fields
  const conditionals = [
    "condWhatsapp", "condFacebook", "condInstagram",
    "condDiscord", "condTwitter", "condGeneric"
  ];
  conditionals.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove("show");
  });

  if (!platform) return;

  // Show appropriate field based on platform
  if (platform === "whatsapp-group" || platform === "whatsapp-channel") {
    document.getElementById("condWhatsapp")?.classList.add("show");
  } else if (platform === "facebook") {
    document.getElementById("condFacebook")?.classList.add("show");
  } else if (platform === "instagram") {
    document.getElementById("condInstagram")?.classList.add("show");
  } else if (platform === "discord") {
    document.getElementById("condDiscord")?.classList.add("show");
  } else if (platform === "twitter") {
    document.getElementById("condTwitter")?.classList.add("show");
  } else {
    // Telegram, TikTok, YouTube, Reddit, Generic → use generic handle field
    document.getElementById("condGeneric")?.classList.add("show");
  }
}

function _wireRequestModal() {
  // Overlay close
  document.getElementById("commReqOverlay").addEventListener("click", e => {
    if (e.target.id === "commReqOverlay") closeRequestModal();
  });

  // Cancel button
  document.getElementById("commReqCancel").addEventListener("click", closeRequestModal);

  // Platform pills
  document.querySelectorAll(".plat-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      document.querySelectorAll(".plat-pill").forEach(p => p.classList.remove("selected"));
      pill.classList.add("selected");
      const platform = pill.dataset.platform;
      document.getElementById("creqPlatform").value = platform;
      _showConditionalField(platform);
    });
  });

  // Submit button
  document.getElementById("commReqSubmit").addEventListener("click", _handleRequestSubmit);
}

function _setStatus(msg, type) {
  const el = document.getElementById("commReqStatus");
  if (!el) return;
  el.textContent = msg;
  el.className   = type;
}

async function _handleRequestSubmit() {
  const name     = (document.getElementById("creqName")?.value     || "").trim();
  const platform = (document.getElementById("creqPlatform")?.value || "");
  const link     = (document.getElementById("creqLink")?.value     || "").trim();
  const members  = (document.getElementById("creqMembers")?.value  || "");

  // Requester fields
  const whatsapp   = (document.getElementById("creqWhatsapp")?.value    || "").trim();
  const fbUser     = (document.getElementById("creqFbUser")?.value      || "").trim();
  const igUser     = (document.getElementById("creqIgUser")?.value      || "").trim();
  const discordUser= (document.getElementById("creqDiscordUser")?.value || "").trim();
  const twitterUser= (document.getElementById("creqTwitterUser")?.value || "").trim();
  const handle     = (document.getElementById("creqHandle")?.value      || "").trim();

  const optFacebook = (document.getElementById("creqOptFacebook")?.value || "").trim();
  const optTelegram = (document.getElementById("creqOptTelegram")?.value || "").trim();

  const submitBtn = document.getElementById("commReqSubmit");

  // Basic validation
  if (!name)     return _setStatus("Please enter the community name.", "err");
  if (!platform) return _setStatus("Please select a platform.", "err");
  if (!members)  return _setStatus("Please select the approximate member range.", "err");
  if (!link)     return _setStatus("Please enter the invite/profile link.", "err");

  // Platform-specific requester validation
  if ((platform === "whatsapp-group" || platform === "whatsapp-channel") && !whatsapp) {
    return _setStatus("Please enter your WhatsApp number.", "err");
  }
  if (platform === "facebook" && !fbUser) {
    return _setStatus("Please enter your Facebook username.", "err");
  }
  if (platform === "instagram" && !igUser) {
    return _setStatus("Please enter your Instagram username.", "err");
  }
  if (platform === "discord" && !discordUser) {
    return _setStatus("Please enter your Discord username.", "err");
  }
  if (platform === "twitter" && !twitterUser) {
    return _setStatus("Please enter your Twitter handle.", "err");
  }
  if (!["whatsapp-group","whatsapp-channel","facebook","instagram","discord","twitter"].includes(platform) && !handle) {
    return _setStatus("Please enter your handle or username.", "err");
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting…';
  _setStatus("", "");

  try {
    let pendingSha  = null;
    let pendingList = [];

    const getRes = await fetch(COMM_API.url(COMM_API.PENDING_JSON_PATH), {
      headers: COMM_API.headers()
    });

    if (getRes.ok) {
      const meta = await getRes.json();
      pendingSha  = meta.sha;
      try { pendingList = JSON.parse(atob(meta.content.replace(/\n/g, ""))); } catch { pendingList = []; }
    }

    const requester = {};
    if (whatsapp)    requester.whatsapp   = whatsapp;
    if (fbUser)      requester.facebook   = fbUser;
    if (igUser)      requester.instagram  = igUser;
    if (discordUser) requester.discord    = discordUser;
    if (twitterUser) requester.twitter    = twitterUser;
    if (handle)      requester.handle     = handle;
    if (optFacebook) requester.facebook   = requester.facebook || optFacebook;
    if (optTelegram) requester.telegram   = optTelegram;

    const newEntry = {
      id:          `req-${Date.now()}`,
      name,
      platform,
      size:        members,
      pic:         "",
      href:        link,
      status:      "pending",
      activity:    "",
      enabled:     false,
      requester,
      submittedAt: new Date().toISOString()
    };

    pendingList.push(newEntry);

    const putBody = {
      message: `Community request: ${name}`,
      content: btoa(unescape(encodeURIComponent(JSON.stringify(pendingList, null, 2)))),
      ...(pendingSha ? { sha: pendingSha } : {})
    };

    const putRes = await fetch(COMM_API.url(COMM_API.PENDING_JSON_PATH), {
      method:  "PUT",
      headers: COMM_API.headers(),
      body:    JSON.stringify(putBody)
    });

    if (!putRes.ok) {
      const errData = await putRes.json().catch(() => ({}));
      throw new Error(errData.message || `GitHub write failed (${putRes.status})`);
    }

    document.getElementById("commReqForm").style.display    = "none";
    document.getElementById("commReqSuccess").classList.add("show");

  } catch (err) {
    console.error("community.js — request submit error:", err);
    _setStatus("Something went wrong: " + (err.message || "unknown error"), "err");
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Request';
  }
}

/* ════════════════════════════════════════════
   Nav toggle
   ════════════════════════════════════════════ */
function initNav() {
  const navToggle    = document.getElementById("navToggle");
  const dropdownMenu = document.getElementById("dropdownMenu");
  if (!navToggle || !dropdownMenu) return;

  navToggle.addEventListener("click", e => {
    e.stopPropagation();
    navToggle.classList.toggle("active");
    dropdownMenu.classList.toggle("active");
  });

  document.addEventListener("click", e => {
    if (!e.target.closest(".nav-container")) {
      navToggle.classList.remove("active");
      dropdownMenu.classList.remove("active");
    }
  });

  dropdownMenu.addEventListener("click", () => {
    navToggle.classList.remove("active");
    dropdownMenu.classList.remove("active");
  });
}

/* ════════════════════════════════════════════
   Bottom-nav active state
   ════════════════════════════════════════════ */
function initBottomNav() {
  const items = document.querySelectorAll(".bottom-nav-item:not(.bottom-nav-upload)");
  items.forEach(item => {
    item.addEventListener("click", function () {
      items.forEach(i => i.classList.remove("active"));
      this.classList.add("active");
    });
  });
}

/* ════════════════════════════════════════════
   Tiny HTML escape helper
   ════════════════════════════════════════════ */
function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ════════════════════════════════════════════
   Boot
   ════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  // Generate platform pills from PLATFORM_META
  generatePlatformPills();

  // Set developer contact URLs (replace with actual links)
  const devLinks = {
    whatsapp: "https://wa.me/qr/6ICCFY7TKDZ4C1",   // ← replace with actual number
    tiktok:   "https://www.tiktok.com/@ethanchaos",
    telegram: "https://t.me/EthanChaoss",
    facebook: "https://www.facebook.com/Mr.Heckar.01"
  };
  document.querySelectorAll('.dev-contact-btn').forEach(btn => {
    const platform = btn.dataset.contact;
    if (devLinks[platform]) btn.href = devLinks[platform];
  });

  initNav();
  initBottomNav();
  loadCommunities();
  loadUpdates();
  _wireRequestModal();

  document.querySelectorAll("[data-open-comm-request], #requestBtn").forEach(btn => {
    btn.addEventListener("click", openRequestModal);
  });
});

window.openRequestModal = openRequestModal;