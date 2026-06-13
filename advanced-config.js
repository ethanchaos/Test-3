// ════════════════════════════════════════════════════════
// advanced-config.js
// Expiration dates · Location tags · AI-powered name suggest
// Writes config data so uploader.js can embed it in uploads.json
// ════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ── Config store: keyed by filename ──
  // { filename: { expiration: "2025-12-31T23:59:00", locations: ["ZA","JHB"] } }
  const store = {};

  // ── Temporary staging for bulk location tags (not yet applied) ──
  let bulkLocTags  = [];   // bulk exp modal
  let bulkExpDate  = null; // bulk exp datetime string

  // ── DOM refs ──
  const openExpBtn    = document.getElementById("openExpModal");
  const openLocBtn    = document.getElementById("openLocModal");

  // Expiration modal
  const expModal      = document.getElementById("expModal");
  const expModalClose = document.getElementById("expModalClose");
  const expBulkDt     = document.getElementById("expBulkDt");
  const expBulkApply  = document.getElementById("expBulkApply");
  const expBulkClear  = document.getElementById("expBulkClear");
  const expPerApply   = document.getElementById("expPerApply");
  const expPerClear   = document.getElementById("expPerClear");
  const expPerFileList= document.getElementById("expPerFileList");

  // Location modal
  const locModal      = document.getElementById("locModal");
  const locModalClose = document.getElementById("locModalClose");
  const locBulkInput  = document.getElementById("locBulkInput");
  const locBulkAdd    = document.getElementById("locBulkAdd");
  const locBulkTags   = document.getElementById("locBulkTags");
  const locBulkApply  = document.getElementById("locBulkApply");
  const locBulkClear  = document.getElementById("locBulkClear");
  const locPerApply   = document.getElementById("locPerApply");
  const locPerClear   = document.getElementById("locPerClear");
  const locPerFileList= document.getElementById("locPerFileList");

  // ── Tab switching helper ──
  function setupTabs(containerSel, tabSel, contentSel) {
    const tabs = document.querySelectorAll(tabSel);
    tabs.forEach(tab => {
      tab.addEventListener("click", () => {
        tabs.forEach(t => t.classList.remove("active"));
        document.querySelectorAll(contentSel).forEach(c => c.classList.remove("active"));
        tab.classList.add("active");
        const target = document.getElementById(tab.dataset.tab);
        if (target) target.classList.add("active");
      });
    });
  }

  setupTabs(null, ".exp-tab", ".exp-tab-content");
  setupTabs(null, ".loc-tab", ".loc-tab-content");

  // ══════════════════════════════════════════════════════
  // ── Helpers ──
  // ══════════════════════════════════════════════════════

  /** Return currently selected filenames (adv checkbox) or all files */
  function getSelectedFilenames() {
    const checked = document.querySelectorAll(".file-check:checked");
    if (checked.length) {
      return Array.from(checked).map(cb => cb.dataset.filename);
    }
    // Fall back to all loaded files
    return (window.filesToUpload || []).map(f => f.name);
  }

  /** Convert datetime-local string → ISO8601 with seconds (pure numeric-friendly) */
  function toISOExpiry(dtLocalStr) {
    if (!dtLocalStr) return null;
    // datetime-local gives "YYYY-MM-DDTHH:MM" — add :00 for seconds
    const s = dtLocalStr.length === 16 ? dtLocalStr + ":00" : dtLocalStr;
    const d = new Date(s);
    if (isNaN(d.getTime())) return null;
    // Return numeric ISO: "YYYY-MM-DDTHH:MM:SS" (no timezone suffix — servers interpret as local)
    const pad = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` +
           `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  /** Unix epoch ms (for server numeric comparisons) */
  function toEpochMs(isoStr) {
    if (!isoStr) return null;
    return new Date(isoStr).getTime();
  }

  function ensureEntry(filename) {
    if (!store[filename]) store[filename] = { expiration: null, locations: [] };
    return store[filename];
  }

  // ── Refresh expiration tag visual on file items ──
  function refreshTagStates() {
    document.querySelectorAll(".adv-tag.exp-tag").forEach(btn => {
      const fn = btn.dataset.filename;
      const entry = store[fn];
      btn.classList.toggle("set", !!(entry && entry.expiration));
      if (entry && entry.expiration) {
        btn.title = `Expires: ${entry.expiration}`;
      } else {
        btn.title = "Set expiration";
      }
    });
    document.querySelectorAll(".adv-tag.loc-tag").forEach(btn => {
      const fn = btn.dataset.filename;
      const entry = store[fn];
      const hasLoc = !!(entry && entry.locations && entry.locations.length);
      btn.classList.toggle("set", hasLoc);
      btn.title = hasLoc ? `Locations: ${entry.locations.join(", ")}` : "Set location";
    });
    updateJsonPreview();
  }

  // ── JSON Preview (no-op — preview removed) ──
  function updateJsonPreview() {}

  // ══════════════════════════════════════════════════════
  // ── Expiration Modal ──
  // ══════════════════════════════════════════════════════

  function openExpModal() {
    // Reset tabs
    document.querySelectorAll(".exp-tab").forEach((t,i) => t.classList.toggle("active", i===0));
    document.querySelectorAll(".exp-tab-content").forEach((c,i) => c.classList.toggle("active", i===0));

    // Bulk: pre-fill if a common expiry exists
    const names = getSelectedFilenames();
    const commonExp = names.length && store[names[0]] ? store[names[0]].expiration : null;
    expBulkDt.value = commonExp ? commonExp.substring(0,16) : "";

    // Per-file list
    buildExpPerFileList(names);

    expModal.classList.add("active");
  }

  function buildExpPerFileList(names) {
    expPerFileList.innerHTML = "";
    if (!names.length) {
      expPerFileList.innerHTML = `<p style="color:var(--text-mid);font-size:.84rem;padding:.5rem 0;">No files selected. Check files in the list first.</p>`;
      return;
    }
    names.forEach(fn => {
      const entry = store[fn] || {};
      const row = document.createElement("div");
      row.className = "per-file-row";
      const short = fn.length > 30 ? fn.substring(0,27)+"…" : fn;
      row.innerHTML = `
        <span class="per-file-name" title="${fn}">${short}</span>
        <div class="per-file-field">
          <input type="datetime-local" class="m-input per-exp-input" data-filename="${fn}"
            value="${entry.expiration ? entry.expiration.substring(0,16) : ''}"
            style="font-size:.8rem;padding:.4rem .6rem;">
        </div>`;
      expPerFileList.appendChild(row);
    });
  }

  expModalClose.addEventListener("click", () => expModal.classList.remove("active"));
  expModal.addEventListener("click", e => { if (e.target === expModal) expModal.classList.remove("active"); });

  // Bulk apply
  expBulkApply.addEventListener("click", () => {
    const dt  = toISOExpiry(expBulkDt.value);
    const names = getSelectedFilenames();
    if (!names.length) { showToastAdv("warning", "No files selected to apply expiration."); return; }
    if (!dt)           { showToastAdv("warning", "Please set a valid date and time."); return; }

    names.forEach(fn => { ensureEntry(fn).expiration = dt; });
    expModal.classList.remove("active");
    refreshTagStates();
    showToastAdv("success", `Expiration set for ${names.length} file(s): ${dt}`);
  });

  // Bulk clear
  expBulkClear.addEventListener("click", () => {
    const names = getSelectedFilenames();
    names.forEach(fn => { if (store[fn]) store[fn].expiration = null; });
    expBulkDt.value = "";
    refreshTagStates();
    showToastAdv("success", "Expiration cleared for selected files.");
  });

  // Per-file apply
  expPerApply.addEventListener("click", () => {
    const inputs = document.querySelectorAll(".per-exp-input");
    let count = 0;
    inputs.forEach(input => {
      const fn = input.dataset.filename;
      const dt = toISOExpiry(input.value);
      if (dt) { ensureEntry(fn).expiration = dt; count++; }
      else if (store[fn]) store[fn].expiration = null;
    });
    expModal.classList.remove("active");
    refreshTagStates();
    showToastAdv("success", `Expiration applied to ${count} file(s).`);
  });

  // Per-file clear all
  expPerClear.addEventListener("click", () => {
    document.querySelectorAll(".per-exp-input").forEach(input => {
      input.value = "";
      const fn = input.dataset.filename;
      if (store[fn]) store[fn].expiration = null;
    });
    refreshTagStates();
  });

  openExpBtn.addEventListener("click", openExpModal);

  // ── Open exp for a specific file (from per-file tag button) ──
  function openExpForFile(filename) {
    // Switch to per-file tab
    document.querySelectorAll(".exp-tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".exp-tab-content").forEach(c => c.classList.remove("active"));
    document.querySelector('[data-tab="exp-perfile"]').classList.add("active");
    document.getElementById("exp-perfile").classList.add("active");

    buildExpPerFileList([filename]);
    expModal.classList.add("active");
  }

  // ══════════════════════════════════════════════════════
  // ── Location Modal ──
  // ══════════════════════════════════════════════════════

  function openLocModal() {
    document.querySelectorAll(".loc-tab").forEach((t,i) => t.classList.toggle("active", i===0));
    document.querySelectorAll(".loc-tab-content").forEach((c,i) => c.classList.toggle("active", i===0));

    // Reset bulk staging
    bulkLocTags = [];
    renderBulkLocTags();
    if (locBulkInput) locBulkInput.value = "";

    // Reset province chip selections
    const grid = document.getElementById("locBulkProvinceGrid");
    if (grid) {
      grid.querySelectorAll(".sa-province-chip.selected").forEach(c => c.classList.remove("selected"));
      const summary = document.getElementById("locBulkSummary");
      if (summary) summary.style.display = "none";
    }

    // Per-file list
    const names = getSelectedFilenames();
    buildLocPerFileList(names);

    locModal.classList.add("active");
  }
  const SA_PROVINCES = [
    { value: "Gauteng",       icon: "fa-city" },
    { value: "Western Cape",  icon: "fa-mountain" },
    { value: "KwaZulu-Natal", icon: "fa-water" },
    { value: "Eastern Cape",  icon: "fa-anchor" },
    { value: "Limpopo",       icon: "fa-tree" },
    { value: "Mpumalanga",    icon: "fa-leaf" },
    { value: "North West",    icon: "fa-sun" },
    { value: "Free State",    icon: "fa-wheat-awn" },
    { value: "Northern Cape", icon: "fa-gem" }
  ];

  function buildLocPerFileList(names) {
    locPerFileList.innerHTML = "";
    if (!names.length) {
      locPerFileList.innerHTML = `<p style="color:var(--text-mid);font-size:.84rem;padding:.5rem 0;">No files selected. Check files in the list first.</p>`;
      return;
    }
    names.forEach(fn => {
      const entry = store[fn] || {};
      const selected = entry.locations || [];
      const short = fn.length > 30 ? fn.substring(0,27)+"…" : fn;

      const row = document.createElement("div");
      row.className = "per-file-row";
      row.style.cssText = "flex-direction:column;align-items:flex-start;gap:8px;";

      const chipsHtml = SA_PROVINCES.map(p => {
        const isSelected = selected.includes(p.value);
        return `<button type="button" class="sa-province-chip${isSelected ? ' selected' : ''}" data-province="${p.value}" style="font-size:.72rem;padding:.4rem .7rem;">
          <i class="fas ${p.icon}"></i> ${p.value}
        </button>`;
      }).join('');

      row.innerHTML = `
        <span class="per-file-name" title="${fn}" style="font-weight:700;">${short}</span>
        <div class="sa-province-grid" data-perfile="${fn}" style="width:100%;gap:5px;">
          ${chipsHtml}
        </div>`;

      // chip toggle
      row.querySelector(`[data-perfile="${fn}"]`).addEventListener('click', e => {
        const chip = e.target.closest('.sa-province-chip');
        if (chip) chip.classList.toggle('selected');
      });

      locPerFileList.appendChild(row);
    });
  }

  // Bulk location tag chip management
  function renderBulkLocTags() {
    locBulkTags.innerHTML = "";
    bulkLocTags.forEach((tag, i) => {
      const chip = document.createElement("span");
      chip.className = "loc-tag-chip";
      chip.innerHTML = `${tag} <button class="rm" data-i="${i}"><i class="fas fa-times"></i></button>`;
      chip.querySelector(".rm").addEventListener("click", () => {
        bulkLocTags.splice(i, 1);
        renderBulkLocTags();
      });
      locBulkTags.appendChild(chip);
    });
  }

  function addBulkLocTag(val) {
    const tags = val.split(/[,;]+/).map(t => t.trim()).filter(t => t && !bulkLocTags.includes(t));
    bulkLocTags.push(...tags);
    renderBulkLocTags();
    if (locBulkInput) locBulkInput.value = "";
  }

  if (locBulkAdd) locBulkAdd.addEventListener("click", () => addBulkLocTag(locBulkInput ? locBulkInput.value : ""));
  if (locBulkInput) locBulkInput.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addBulkLocTag(locBulkInput.value); }
  });

  locModalClose.addEventListener("click", () => locModal.classList.remove("active"));
  locModal.addEventListener("click", e => { if (e.target === locModal) locModal.classList.remove("active"); });

  // Bulk apply — reads from SA province chips OR legacy bulkLocTags
  locBulkApply.addEventListener("click", () => {
    // Read selected province chips
    const grid = document.getElementById("locBulkProvinceGrid");
    const chipTags = grid
      ? Array.from(grid.querySelectorAll(".sa-province-chip.selected")).map(b => b.dataset.province)
      : [];
    // Also expose globally for any external listener
    window._saSelectedProvinces = chipTags;

    const tagsToApply = chipTags.length ? chipTags : bulkLocTags;

    if (!tagsToApply.length) { showToastAdv("warning", "Select at least one province first."); return; }
    const names = getSelectedFilenames();
    if (!names.length) { showToastAdv("warning", "No files selected."); return; }

    names.forEach(fn => {
      const entry = ensureEntry(fn);
      const merged = Array.from(new Set([...entry.locations, ...tagsToApply]));
      entry.locations = merged;
    });
    locModal.classList.remove("active");
    refreshTagStates();
    showToastAdv("success", `Location tags applied to ${names.length} file(s).`);
  });

  // Bulk clear
  locBulkClear.addEventListener("click", () => {
    const names = getSelectedFilenames();
    names.forEach(fn => { if (store[fn]) store[fn].locations = []; });
    bulkLocTags = [];
    renderBulkLocTags();
    // Also clear chip selections
    const grid = document.getElementById("locBulkProvinceGrid");
    if (grid) grid.querySelectorAll(".sa-province-chip.selected").forEach(c => c.classList.remove("selected"));
    const summary = document.getElementById("locBulkSummary");
    if (summary) summary.style.display = "none";
    refreshTagStates();
    showToastAdv("success", "Locations cleared for selected files.");
  });

  // Per-file apply — reads from province chips per file
  locPerApply.addEventListener("click", () => {
    let count = 0;
    document.querySelectorAll("[data-perfile]").forEach(grid => {
      const fn = grid.dataset.perfile;
      const tags = Array.from(grid.querySelectorAll(".sa-province-chip.selected")).map(c => c.dataset.province);
      ensureEntry(fn).locations = tags;
      if (tags.length) count++;
    });
    locModal.classList.remove("active");
    refreshTagStates();
    showToastAdv("success", `Locations applied to ${count} file(s).`);
  });

  // Per-file clear
  locPerClear.addEventListener("click", () => {
    document.querySelectorAll("[data-perfile] .sa-province-chip.selected").forEach(c => c.classList.remove("selected"));
    document.querySelectorAll("[data-perfile]").forEach(grid => {
      const fn = grid.dataset.perfile;
      if (store[fn]) store[fn].locations = [];
    });
    refreshTagStates();
  });

  openLocBtn.addEventListener("click", openLocModal);

  // ── Open loc for a specific file (per-file tag button) ──
  function openLocForFile(filename) {
    document.querySelectorAll(".loc-tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".loc-tab-content").forEach(c => c.classList.remove("active"));
    document.querySelector('[data-tab="loc-perfile"]').classList.add("active");
    document.getElementById("loc-perfile").classList.add("active");

    buildLocPerFileList([filename]);
    locModal.classList.add("active");
  }

  // ══════════════════════════════════════════════════════
  // ── AI Name Suggest (Anthropic API) ──
  // Used by uploader.js rename modal "AI Suggest" button
  // ══════════════════════════════════════════════════════
  async function aiSuggestName(originalFilename) {
    const ext = originalFilename.split('.').pop();

    const prompt = `You are a VPN config file naming assistant.
A VPN config file has this original filename: "${originalFilename}"
The filename may contain characters from Arabic, Chinese, Cyrillic, emoji, or other non-ASCII scripts.

Your task: Suggest a clean, descriptive English filename that:
1. Preserves the meaning or context of the original name (translate/interpret any non-Latin text or symbols)
2. Uses only standard ASCII keyboard characters (a-z, A-Z, 0-9, hyphen, underscore, dot)
3. Keeps the original file extension: .${ext}
4. Is concise (max 40 characters including extension)
5. Uses underscores or hyphens instead of spaces

Respond with ONLY the filename string, nothing else. No explanation, no quotes, no punctuation outside the filename.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 80,
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!response.ok) throw new Error("AI API error: " + response.status);
    const data = await response.json();
    const suggested = (data.content[0]?.text || "").trim().replace(/^["']|["']$/g, "");

    // Safety check — reject if still has unicode or empty
    if (!suggested || /[^\x00-\x7F]/.test(suggested)) {
      throw new Error("AI returned invalid name");
    }
    // Ensure extension is preserved
    if (!suggested.toLowerCase().endsWith(`.${ext.toLowerCase()}`)) {
      return suggested.replace(/\.[^.]+$/, "") + "." + ext;
    }
    return suggested;
  }

  // ══════════════════════════════════════════════════════
  // ── Public API (called by uploader.js) ──
  // ══════════════════════════════════════════════════════

  /** Called before upload — returns map of filename → { expiration, locations } */
  function getBatchConfig(files) {
    const result = {};
    files.forEach(f => {
      const entry = store[f.name];
      if (entry && (entry.expiration || (entry.locations && entry.locations.length))) {
        result[f.name] = {
          expiration: entry.expiration || null,
          locations:  entry.locations  || []
        };
      }
    });
    return result;
  }

  /** Remove config entries for deleted files */
  function removeFiles(filenameSet) {
    filenameSet.forEach(fn => delete store[fn]);
    refreshTagStates();
  }

  /** Clear everything after upload */
  function clearAll() {
    Object.keys(store).forEach(k => delete store[k]);
    bulkLocTags = [];
    bulkExpDate = null;
  }

  // ── Local toast (avoids conflict with uploader.js showToast) ──
  function showToastAdv(type, message) {
    if (window.showToast) { window.showToast(type, message); return; }
    // fallback
    document.querySelectorAll(`.toast-msg.${type}`).forEach(t => t.remove());
    const div = document.createElement("div");
    div.className = `toast-msg ${type}`;
    const icons = { error:"exclamation-triangle", success:"check-circle", warning:"exclamation-circle" };
    div.innerHTML = `<i class="fas fa-${icons[type]||'info-circle'}"></i><span>${message}</span>
      <button class="toast-close"><i class="fas fa-times"></i></button>`;
    div.querySelector(".toast-close").addEventListener("click", () => {
      div.style.animation = "slideOutRight .3s ease forwards";
      setTimeout(() => div.remove(), 300);
    });
    setTimeout(() => { if (div.parentElement) { div.style.animation = "slideOutRight .3s ease forwards"; setTimeout(() => div.remove(), 300); } }, 4500);
    document.body.appendChild(div);
  }

  // ── Expose to global ──
  window.AdvConfig = {
    getBatchConfig,
    removeFiles,
    clearAll,
    refreshTagStates,
    aiSuggestName,
    openExpForFile,
    openLocForFile
  };

})();
