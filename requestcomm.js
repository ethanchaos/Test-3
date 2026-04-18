/**
 * requestcomm.js
 * ─────────────────────────────────────────────────────────────
 * Handles the community request modal in community.html.
 * Depends on COMM_API from commapi.js being loaded first.
 * ─────────────────────────────────────────────────────────────
 */

(function () {

  /* ── Element refs ── */
  const overlay    = document.getElementById("requestModal");
  const openBtn    = document.getElementById("requestBtn");
  const closeBtn   = document.getElementById("modalClose");
  const submitBtn  = document.getElementById("modalSubmit");

  const photoInput      = document.getElementById("photoInput");
  const photoUploadArea = document.getElementById("photoUploadArea");
  const photoPreview    = document.getElementById("photoPreview");
  const photoPreviewImg = document.getElementById("photoPreviewImg");
  const removePhotoBtn  = document.getElementById("removePhoto");

  const nameInput     = document.getElementById("reqName");
  const platformInput = document.getElementById("reqPlatform");
  const linkInput     = document.getElementById("reqLink");
  const membersInput  = document.getElementById("reqMembers");

  /* ── Status element (injected below submit btn) ── */
  const statusEl = document.createElement("div");
  statusEl.id = "reqStatus";
  statusEl.style.cssText = "margin-top:10px;font-size:.82rem;text-align:center;min-height:18px;";
  submitBtn.insertAdjacentElement("afterend", statusEl);

  /* ════════════════════════════════════════════
     Open / Close
     ════════════════════════════════════════════ */
  function openModal() {
    overlay.classList.add("open");
    nameInput.focus();
  }

  function closeModal() {
    overlay.classList.remove("open");
    _reset();
  }

  if (openBtn)  openBtn.addEventListener("click",  openModal);
  if (closeBtn) closeBtn.addEventListener("click",  closeModal);

  // Close on backdrop tap
  overlay.addEventListener("click", e => {
    if (e.target === overlay) closeModal();
  });

  /* ════════════════════════════════════════════
     Photo preview
     ════════════════════════════════════════════ */
  photoInput.addEventListener("change", () => {
    const file = photoInput.files[0];
    if (file) _showPreview(file);
  });

  removePhotoBtn.addEventListener("click", () => {
    photoInput.value = "";
    photoPreview.style.display = "none";
    photoUploadArea.style.display = "";
  });

  function _showPreview(file) {
    const reader = new FileReader();
    reader.onload = e => {
      photoPreviewImg.src = e.target.result;
      photoPreview.style.display = "flex";
      photoUploadArea.style.display = "none";
    };
    reader.readAsDataURL(file);
  }

  /* ════════════════════════════════════════════
     Submit
     ════════════════════════════════════════════ */
  submitBtn.addEventListener("click", _handleSubmit);

  async function _handleSubmit() {
    const name     = nameInput.value.trim();
    const platform = platformInput.value.trim();
    const link     = linkInput.value.trim();
    const size     = membersInput.value.trim();
    const picFile  = photoInput.files[0] || null;

    /* ── Validate ── */
    if (!name)     return _setStatus("Please enter the community name.", "err");
    if (!platform) return _setStatus("Please select a platform.", "err");
    if (!link)     return _setStatus("Please enter the invite/profile link.", "err");

    if (picFile) {
      if (picFile.size > 2 * 1024 * 1024) return _setStatus("Image too large — max 2 MB.", "err");
      if (!picFile.type.startsWith("image/")) return _setStatus("Only image files are accepted.", "err");
    }

    /* ── Lock UI ── */
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting…";
    _setStatus("", "");

    try {
      /* ── Step 1: Upload image if provided ── */
      let picPath = "pics/default.png";
      if (picFile) {
        _setStatus("Uploading picture…", "");
        picPath = await COMM_API.uploadImage(picFile);
      }

      /* ── Step 2: Read current pending-communities.json ── */
      _setStatus("Saving request…", "");

      let pendingSha  = null;
      let pendingList = [];

      const getRes = await fetch(COMM_API.url(COMM_API.PENDING_JSON_PATH), {
        headers: COMM_API.headers()
      });

      if (getRes.ok) {
        const meta  = await getRes.json();
        pendingSha  = meta.sha;
        pendingList = JSON.parse(atob(meta.content.replace(/[\r\n]/g, "")));
      }
      // 404 is fine — file will be created fresh

      /* ── Step 3: Build new entry ── */
      const newEntry = {
        id:          `req-${Date.now()}`,
        name,
        description: "",
        platform:    _platformKey(platform),
        href:        link,
        pic:         picPath,
        status:      "active",
        activity:    "",
        size:        size || "",
        enabled:     false,
        submittedAt: new Date().toISOString()
      };

      pendingList.push(newEntry);

      /* ── Step 4: Write back to GitHub ── */
      const _toB64 = (list) => {
        const bytes = new TextEncoder().encode(JSON.stringify(list, null, 2));
        return btoa(String.fromCharCode(...bytes));
      };

      let putRes = await fetch(COMM_API.url(COMM_API.PENDING_JSON_PATH), {
        method:  "PUT",
        headers: COMM_API.headers(),
        body:    JSON.stringify({
          message: `feat: new community request — ${name}`,
          content: _toB64(pendingList),
          ...(pendingSha ? { sha: pendingSha } : {})
        })
      });

      // 409 conflict — re-fetch latest SHA and retry once
      if (putRes.status === 409) {
        const freshMeta = await fetch(COMM_API.url(COMM_API.PENDING_JSON_PATH), { headers: COMM_API.headers() });
        if (freshMeta.ok) {
          const freshData = await freshMeta.json();
          const freshList = JSON.parse(atob(freshData.content.replace(/[\r\n]/g, "")));
          freshList.push(newEntry);
          putRes = await fetch(COMM_API.url(COMM_API.PENDING_JSON_PATH), {
            method:  "PUT",
            headers: COMM_API.headers(),
            body:    JSON.stringify({
              message: `feat: new community request — ${name}`,
              content: _toB64(freshList),
              sha:     freshData.sha
            })
          });
        }
      }

      if (!putRes.ok) {
        const err = await putRes.json().catch(() => ({}));
        throw new Error(err.message || `GitHub write failed (${putRes.status})`);
      }

      /* ── Done ── */
      _setStatus("✓ Request submitted! We'll review it soon.", "ok");
      submitBtn.textContent = "Sent!";
      setTimeout(closeModal, 2200);

    } catch (err) {
      console.error("requestcomm.js — submit error:", err);
      _setStatus("Something went wrong: " + (err.message || "unknown error"), "err");
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit Request";
    }
  }

  /* ════════════════════════════════════════════
     Helpers
     ════════════════════════════════════════════ */
  function _setStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.style.color = type === "err" ? "#c00" : type === "ok" ? "#1a7a1a" : "#555";
  }

  function _reset() {
    nameInput.value     = "";
    platformInput.value = "";
    linkInput.value     = "";
    membersInput.value  = "";
    photoInput.value    = "";
    photoPreview.style.display    = "none";
    photoUploadArea.style.display = "";
    _setStatus("", "");
    submitBtn.disabled    = false;
    submitBtn.textContent = "Submit Request";
  }

  // Map display label → platform key used in communities.json
  function _platformKey(label) {
    const map = {
      "whatsapp group":   "whatsapp-group",
      "whatsapp channel": "whatsapp-channel",
      "telegram":         "telegram",
      "youtube":          "youtube",
      "tiktok":           "tiktok",
      "facebook":         "facebook",
      "discord":          "discord",
      "other":            "generic"
    };
    return map[label.toLowerCase()] || "generic";
  }

})();
