// ── notifwriter.js ──
// Generates and writes notifications to notif.json after every upload batch.
// Also maintains notif-ref.json which tracks the last used notification ID,
// the last topic written, and the last write date — so every new notification
// always gets a strictly higher sequential ID and never collides.
//
// Load order in HTML:  uploaderapi.js  →  notifwriter.js  →  uploader.js

// ── Site base URL (Netlify deploy) ──
const SITE_BASE = "https://ethanchaos.srcnexus.app/imported_project_4";

// ── GitHub file paths ──
const NOTIF_JSON_PATH    = "notif.json";
const NOTIF_REF_PATH     = "notif-ref.json";

// ────────────────────────────────────────────────
// VPN page map — built from cards.json data.
// Keys must match the config-id keys in VPN_FORMATS.
// Any VPN added to VPN_FORMATS / VPN_DISPLAY_NAMES
// that also has a page can be added here later.
// ────────────────────────────────────────────────
const VPN_PAGE_MAP = {
  "httpcustom":   "hc.html",
  "hatunnel":     "hat.html",
  "letsvpngo":    "letsgo.html",
  "darktunnel":   "dark.html",
  "httpinjector": "ehi.html",
  "npvttunnel":   "npvt.html",
  "npvtunnel":    "npvt.html",
  "opentunnel":   "tnl.html",
  "tlstunnel":    "tls.html",
  "zivpntunnel":  "ziv.html",
  "sshcustom":    "ssc.html",
  "starkvpn":     "stk.html",
  "linklayer":    "ink.html",
  // ── Add future VPN pages here ──
  // "sbrinjector":  "sbr.html",
  // "wireguard":    "wg.html",
  // "ev2rayvpn":    "v2ray.html",
  // "sshinjector":  "ssh.html",
  // "hexxvpn":      "hex.html",
  // "snaketunnel":  "snake.html",
  // "reztunnel":    "rez.html",
  // "ousstunnel":   "ouss.html",
  // "smktunplus":   "smk.html",
  // "napsternetv":  "npv4.html",
  // "poyinjector":  "poy.html",
  // "royaltunnel":  "roy.html",
  // "binketunnel":  "pcx.html",
  // "socksiptunnel":"sip.html",
  // "agninjector":  "agn.html",
  // "austrovpn":    "aro.html",
  // "austroplusvpn":"arop.html",
  // "v2rayhybrid":  "vhd.html",
  // "jezproxy":     "jez.html",
};

// ────────────────────────────────────────────────────────────────────────────
// NotifWriter class
// ────────────────────────────────────────────────────────────────────────────
class NotifWriter {

  // ── GitHub helpers (re-uses credentials from uploaderapi.js) ──
  static _apiUrl(filePath) {
    return `https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}/contents/${filePath}`;
  }

  static _authHeaders() {
    return { Authorization: `token ${TOKEN}`, "Content-Type": "application/json" };
  }

  // ── Encode a JS value to base64 JSON ──
  static _encode(obj) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(obj, null, 2))));
  }

  // ── Fetch a JSON file from the repo; returns { data, sha } ──
  static async _fetchJSON(filePath, fallback) {
    try {
      const res = await fetch(NotifWriter._apiUrl(filePath), {
        headers: { Authorization: `token ${TOKEN}` }
      });
      if (res.status === 404) return { data: fallback, sha: null };
      if (!res.ok) throw new Error(`GitHub ${res.status} on ${filePath}`);
      const raw  = await res.json();
      const data = JSON.parse(atob(raw.content.replace(/\n/g, "")));
      return { data, sha: raw.sha };
    } catch (err) {
      console.warn(`[NotifWriter] _fetchJSON(${filePath}) failed:`, err);
      return { data: fallback, sha: null };
    }
  }

  // ── Write (create or update) a JSON file in the repo ──
  static async _writeJSON(filePath, data, sha, commitMessage) {
    const body = { message: commitMessage, content: NotifWriter._encode(data) };
    if (sha) body.sha = sha;
    const res = await fetch(NotifWriter._apiUrl(filePath), {
      method:  "PUT",
      headers: NotifWriter._authHeaders(),
      body:    JSON.stringify(body)
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`GitHub write failed (${filePath}): ${res.status} — ${errText}`);
    }
    return res;
  }

  // ────────────────────────────────────────────────────────────────────────
  // buildNotification(metadataBatch)
  //
  // metadataBatch format (comes straight from handleUpload in uploader.js):
  //   { configId: count, ... }
  //   e.g. { "hatunnel": 4 }
  //   e.g. { "hatunnel": 3, "httpcustom": 2 }
  //   e.g. { "hatunnel": 2, "httpcustom": 1, "darktunnel": 1, "tlstunnel": 1 }
  //
  // Returns a ready-to-push notification object { id, title, message, link, date, priority }
  // ────────────────────────────────────────────────────────────────────────
  static buildNotification(metadataBatch, nextId) {
    const entries    = Object.entries(metadataBatch); // [[configId, count], ...]
    const vpnCount   = entries.length;                // how many distinct VPN types
    const totalFiles = entries.reduce((s, [, c]) => s + c, 0);
    const today      = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    // ── Helper: display name for a configId ──
    const displayName = id => VPN_DISPLAY_NAMES[id] || id;

    // ── Helper: link for a configId (single-VPN upload) ──
    const pageLink = id => {
      const page = VPN_PAGE_MAP[id];
      return page ? `${SITE_BASE}/${page}` : `${SITE_BASE}/index.html`;
    };

    let title, message, link;

    // ────────────────────────────────────────────────
    // CASE 1 — Only ONE VPN type uploaded
    //   Sub-case A: 1 file   → "<VPN> config added"
    //   Sub-case B: 2+ files → "<VPN> configs added"
    //   Link → that VPN's own page (or main if unknown)
    // ────────────────────────────────────────────────
    if (vpnCount === 1) {
      const [[configId, count]] = entries;
      const name = displayName(configId);
      link  = pageLink(configId);

      if (count === 1) {
        title   = `🆕 New ${name} Config Added`;
        message = `A fresh ${name} configuration has just been added. Tap to download it now.`;
      } else {
        title   = `📦 ${count} New ${name} Configs Added`;
        message = `${count} new ${name} configurations have just been uploaded. Tap to browse and download them.`;
      }

    // ────────────────────────────────────────────────
    // CASE 2 — EXACTLY 2 different VPN types
    //   Title  → "New files added"
    //   Message → "New files for <A> and <B> have been added recently."
    //   Link → main page (configs from multiple apps)
    // ────────────────────────────────────────────────
    } else if (vpnCount === 2) {
      const names = entries.map(([id]) => displayName(id));
      title   = "🆕 New Files Added";
      message = `New files for ${names[0]} and ${names[1]} have been added recently. Tap to explore them.`;
      link    = `${SITE_BASE}/index.html`;

    // ────────────────────────────────────────────────
    // CASE 3 — 3 different VPN types
    //   Title  → "New files added"
    //   Message → "New files for <A>, <B> and <C> configs have been added."
    //   Link → main page
    // ────────────────────────────────────────────────
    } else if (vpnCount === 3) {
      const names = entries.map(([id]) => displayName(id));
      title   = "🆕 New Files Added";
      message = `New files for ${names[0]}, ${names[1]} and ${names[2]} configs have been added. Tap to check them out.`;
      link    = `${SITE_BASE}/index.html`;

    // ────────────────────────────────────────────────
    // CASE 4 — 4 or more different VPN types (mixed / unknown protocol)
    //   Title  → "🔥 Multiple Config Update"
    //   Message → mentions total file count but not individual VPN names
    //   Link → main page
    // ────────────────────────────────────────────────
    } else {
      title   = "🔥 Multiple Config Update";
      message = `${totalFiles} new configuration files across ${vpnCount} different VPN apps have been uploaded. Visit the site to browse all the latest additions.`;
      link    = `${SITE_BASE}/index.html`;
    }

    return {
      id:       nextId,
      title,
      message,
      link,
      date:     today,
      priority: "high"
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // run(metadataBatch)
  //
  // Entry point called by the uploader after a successful batch.
  // 1. Loads notif-ref.json to get the last used ID.
  // 2. Loads notif.json (current notifications array).
  // 3. Builds the new notification object.
  // 4. Prepends it to notif.json and saves.
  // 5. Updates notif-ref.json with the new last ID, topic, and date.
  // ────────────────────────────────────────────────────────────────────────
  static async run(metadataBatch) {
    if (!metadataBatch || !Object.keys(metadataBatch).length) return;

    // Skip in Android app environment (Java handles its own notif writes if needed)
    if (typeof isAndroidApp === "function" && isAndroidApp()) return;

    console.log("[NotifWriter] Starting notification write for batch:", metadataBatch);

    try {
      // ── Step 1: Read notif-ref.json ──
      const refFallback = { lastId: 0, lastTopic: null, lastDate: null };
      const { data: ref, sha: refSha } = await NotifWriter._fetchJSON(
        NOTIF_REF_PATH, refFallback
      );

      // Next ID is always 1 higher than the last recorded ID.
      // This handles gaps gracefully — if someone manually added id:10, we use 11.
      const nextId = (ref.lastId || 0) + 1;

      // ── Step 2: Read notif.json ──
      const { data: notifArray, sha: notifSha } = await NotifWriter._fetchJSON(
        NOTIF_JSON_PATH, []
      );

      // ── Step 3: Build the new notification ──
      const newNotif = NotifWriter.buildNotification(metadataBatch, nextId);
      console.log("[NotifWriter] Built notification:", newNotif);

      // ── Step 4: Prepend and write notif.json ──
      const updatedNotifs = [newNotif, ...notifArray];
      await NotifWriter._writeJSON(
        NOTIF_JSON_PATH,
        updatedNotifs,
        notifSha,
        `notif: add #${nextId} — ${newNotif.title}`
      );

      // ── Step 5: Update notif-ref.json ──
      const updatedRef = {
        lastId:    nextId,
        lastTopic: newNotif.title,
        lastDate:  newNotif.date
      };
      await NotifWriter._writeJSON(
        NOTIF_REF_PATH,
        updatedRef,
        refSha,
        `notif-ref: update to id ${nextId}`
      );

      console.log(`[NotifWriter] ✅ Notification #${nextId} written successfully.`);

    } catch (err) {
      // Non-fatal — never break the upload flow
      console.error("[NotifWriter] ❌ Failed to write notification:", err);
    }
  }
}
