// ════════════════════════════════════════════════════════
// uploader.js  — UI logic
// File selection · validation · rename modal · PIN guard
// Progress · upload orchestration · advanced-config bridge
// ════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════
// ── Allowed Extensions ──
// ════════════════════════════════════════════════════════
const allowedExts = [
  "dark","hc","pcx","sip","agn","v2","hat","aro","stk","hex","ziv",
  "sbr","ssc","vhd","ssh","rez","tnl","ost","tls","sut","ehi",
  "npv4","npvt","ink","pin","roy","js","conf","jez"
];

// ════════════════════════════════════════════════════════
// ── Let's VPN Go Detection ──
// ════════════════════════════════════════════════════════
const VPNGO_KEYWORDS = [
  "letsvpngo","letsvpn","lvpngo","lvgo",
  "lets_vpn","lets-vpn","letsgo","vpngo"
];

function isVpnGoFile(filename) {
  const lower = filename.toLowerCase();
  const ext   = lower.split('.').pop();
  if (ext === "js") return true;
  return VPNGO_KEYWORDS.some(kw => lower.includes(kw));
}

// ════════════════════════════════════════════════════════
// ── Authorised PINs (hashed at runtime) ──
// ════════════════════════════════════════════════════════
const ALLOWED_PINS = [
  "Let'svpngo#/1",
  "Go@Techmaster",
  "User1-@chaosdevs",
  "De-@#489hjhkk",
  "368$789@378",
  "letsvpn@go-2"
];

async function hashPin(raw) {
  const encoded = new TextEncoder().encode(raw);
  const buf     = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");
}

let _allowedHashes = null;
async function getAllowedHashes() {
  if (!_allowedHashes) _allowedHashes = await Promise.all(ALLOWED_PINS.map(hashPin));
  return _allowedHashes;
}

async function isPinValid(pin) {
  const [inputHash, allowed] = await Promise.all([hashPin(pin), getAllowedHashes()]);
  return allowed.includes(inputHash);
}

// ════════════════════════════════════════════════════════
// ── DOM References ──
// ════════════════════════════════════════════════════════
const fileInput      = document.getElementById("fileInput");
const browseBtn      = document.getElementById("browseBtn");
const uploadArea     = document.getElementById("uploadArea");
const uploadBtn      = document.getElementById("uploadBtn");
const uploadProgress = document.getElementById("uploadProgress");
const uploadSection  = document.getElementById("uploadSection");
const progressFill   = document.querySelector(".progress-circle-fill");
const progressText   = document.querySelector(".progress-text");
const uploadStatus   = document.getElementById("uploadStatus");
const selectedFiles  = document.getElementById("selectedFiles");
const vpnGrid        = document.getElementById("vpnGrid");
const vpnInfo        = document.getElementById("vpnInfo");
const showFilesBtn   = document.getElementById("showFilesBtn");
const navToggle      = document.getElementById("navToggle");
const dropdownMenu   = document.getElementById("dropdownMenu");
const renameModal    = document.getElementById("renameModal");
const renameClose    = document.getElementById("renameClose");
const renameCancelBtn= document.getElementById("renameCancelBtn");
const renameApplyBtn = document.getElementById("renameApplyBtn");
const renameList     = document.getElementById("renameList");
const deleteSelectedBtn = document.getElementById("deleteSelectedBtn");
const advToggle      = document.getElementById("advToggle");

// PIN modal refs
const pinModal           = document.getElementById("pinModal");
const pinInput           = document.getElementById("pinInput");
const pinConfirmInput    = document.getElementById("pinConfirmInput");
const pinCancelBtn       = document.getElementById("pinCancelBtn");
const pinNextBtn         = document.getElementById("pinNextBtn");
const pinErrorMsg        = document.getElementById("pinErrorMsg");
const pinErrorText       = document.getElementById("pinErrorText");
const pinVpngoCount      = document.getElementById("pinVpngoCount");
const pinVpngoFilesList  = document.getElementById("pinVpngoFilesList");
const pinToggleVis       = document.getElementById("pinToggleVis");
const pinEyeIcon         = document.getElementById("pinEyeIcon");
const pinConfirmToggleVis= document.getElementById("pinConfirmToggleVis");
const pinConfirmEyeIcon  = document.getElementById("pinConfirmEyeIcon");

// ════════════════════════════════════════════════════════
// ── State ──
// ════════════════════════════════════════════════════════
let filesToUpload    = [];
let filesWithUnicode = [];
let showFilesVisible = false;
let renamedFilesMap  = new Map();
let advModeActive    = false;

// PIN gate state
let pendingVpnGoFiles = [];
let pinResolve        = null;

// ════════════════════════════════════════════════════════
// ── Android Bridge ──
// ════════════════════════════════════════════════════════
function isAndroidApp() {
  return typeof window.Android !== "undefined" &&
         typeof window.Android.openFilePicker === "function";
}

// ════════════════════════════════════════════════════════
// ── Nav Toggle ──
// ════════════════════════════════════════════════════════
navToggle.addEventListener("click", e => {
  e.stopPropagation();
  navToggle.classList.toggle("active");
  dropdownMenu.classList.toggle("active");
});
document.addEventListener("click", event => {
  if (!event.target.closest(".nav-container")) {
    navToggle.classList.remove("active");
    dropdownMenu.classList.remove("active");
  }
});

// ════════════════════════════════════════════════════════
// ── Advanced Config Toggle ──
// ════════════════════════════════════════════════════════
advToggle.addEventListener("click", () => {
  advModeActive = !advModeActive;
  advToggle.classList.toggle("on", advModeActive);

  const panel = document.getElementById("advPanel");
  panel.classList.toggle("open", advModeActive);

  // Put the file list into adv-mode class (shows checkboxes & per-file tag buttons)
  selectedFiles.classList.toggle("adv-mode", advModeActive);

  // Show/hide delete button
  deleteSelectedBtn.classList.toggle("visible", advModeActive);

  if (!advModeActive) {
    // Clear all checkboxes when turning off
    document.querySelectorAll(".file-check").forEach(cb => { cb.checked = false; });
  }
});

// ════════════════════════════════════════════════════════
// ── Delete Selected ──
// ════════════════════════════════════════════════════════
deleteSelectedBtn.addEventListener("click", () => {
  const checkedBoxes = document.querySelectorAll(".file-check:checked");
  if (!checkedBoxes.length) {
    showToast("warning", "No files selected — tick the checkboxes first.");
    return;
  }
  const namesToRemove = new Set(
    Array.from(checkedBoxes).map(cb => cb.dataset.filename)
  );
  const removed = namesToRemove.size;
  filesToUpload = filesToUpload.filter(f => !namesToRemove.has(f.name));

  // Also remove advanced config data for deleted files
  if (window.AdvConfig) window.AdvConfig.removeFiles(namesToRemove);

  updateFileSelectionUI();
  showToast("success", `Removed ${removed} file(s).`);
  if (!filesToUpload.length) uploadBtn.disabled = true;
});

// ════════════════════════════════════════════════════════
// ── Core Event Listeners ──
// ════════════════════════════════════════════════════════
browseBtn.addEventListener("click", () => {
  isAndroidApp() ? window.Android.openFilePicker() : fileInput.click();
});

fileInput.addEventListener("change", handleFileSelect);
uploadBtn.addEventListener("click", handleUpload);
showFilesBtn.addEventListener("click", toggleShowFiles);
renameClose.addEventListener("click", closeRenameModal);
renameCancelBtn.addEventListener("click", cancelRename);
renameApplyBtn.addEventListener("click", applyRenames);

// ── Drag & Drop ──
uploadArea.addEventListener("dragover",  e => { e.preventDefault(); uploadArea.classList.add("active"); });
uploadArea.addEventListener("dragleave", () => uploadArea.classList.remove("active"));
uploadArea.addEventListener("drop", e => {
  e.preventDefault();
  uploadArea.classList.remove("active");
  if (e.dataTransfer.files.length) {
    fileInput.files = e.dataTransfer.files;
    handleFileSelect();
  }
});

// ════════════════════════════════════════════════════════
// ── Toggle Supported Formats Panel ──
// ════════════════════════════════════════════════════════
function toggleShowFiles() {
  showFilesVisible = !showFilesVisible;
  vpnInfo.classList.toggle("active", showFilesVisible);
  showFilesBtn.innerHTML = showFilesVisible
    ? '<i class="fas fa-times"></i> Hide Formats'
    : '<i class="fas fa-list"></i> Show Supported Files';
}

// ════════════════════════════════════════════════════════
// ── Unicode helpers ──
// ════════════════════════════════════════════════════════
function containsUnicode(filename) {
  for (const char of filename) {
    if (char.codePointAt(0) > 255) return true;
  }
  return false;
}

function generateSafeFilename(filename) {
  let result = '';
  for (const char of filename) result += char.codePointAt(0) <= 255 ? char : '_';
  return result;
}

// ════════════════════════════════════════════════════════
// ── Toast Notifications ──
// ════════════════════════════════════════════════════════
function showToast(type, message) {
  document.querySelectorAll(`.toast-msg.${type}`).forEach(t => t.remove());
  const div = document.createElement("div");
  div.className = `toast-msg ${type}`;

  const icons = { error:"exclamation-triangle", success:"check-circle", warning:"exclamation-circle" };
  div.innerHTML = `
    <i class="fas fa-${icons[type] || 'info-circle'}"></i>
    <span>${message}</span>
    <button class="toast-close"><i class="fas fa-times"></i></button>`;

  const close = () => {
    div.style.animation = "slideOutRight 0.3s ease forwards";
    setTimeout(() => div.remove(), 300);
  };
  div.querySelector(".toast-close").addEventListener("click", close);
  setTimeout(() => { if (div.parentElement) close(); }, 5000);
  document.body.appendChild(div);
}

const showErrorMessage   = msg => showToast("error",   msg);
const showSuccessMessage = msg => showToast("success", msg);
const showWarningMessage = msg => showToast("warning", msg);

// ════════════════════════════════════════════════════════
// ── Build a file-item element ──
// ════════════════════════════════════════════════════════
function buildFileItem(file, options = {}) {
  const { wasRenamed = false, isUnicode = false } = options;
  const isVpnGo = isVpnGoFile(file.name);

  let borderClass = "";
  if (isUnicode)   borderClass = " file-unicode";
  else if (isVpnGo) borderClass = " file-vpngo";
  else if (wasRenamed) borderClass = " file-renamed";

  const iconColor = isVpnGo ? "var(--vpngo)" : wasRenamed ? "var(--text-mid)" : isUnicode ? "var(--warn)" : "var(--success)";
  const iconName  = isVpnGo ? "shield-alt" : isUnicode ? "exclamation-triangle" : "file";

  const badges = [
    wasRenamed ? `<small style="color:var(--text-mid)">(renamed)</small>` : '',
    isVpnGo    ? `<small style="color:var(--vpngo)">(PIN required)</small>` : '',
    isUnicode  ? `<small style="color:var(--warn)">(needs rename)</small>` : ''
  ].filter(Boolean).join(' ');

  const item = document.createElement("div");
  item.className = `file-item${borderClass}`;
  item.dataset.filename = file.name;

  item.innerHTML = `
    <input type="checkbox" class="file-check" data-filename="${file.name}">
    <div class="file-name">
      <i class="fas fa-${iconName}" style="color:${iconColor};flex-shrink:0;"></i>
      <span title="${file.name}">${file.name}</span>
      ${badges}
    </div>
    <div class="file-adv-tags">
      <button class="adv-tag exp-tag" data-filename="${file.name}" title="Set expiration">
        <i class="fas fa-clock"></i> EXP
      </button>
      <button class="adv-tag loc-tag" data-filename="${file.name}" title="Set location">
        <i class="fas fa-map-marker-alt"></i> LOC
      </button>
    </div>
    <div class="file-size">${formatFileSize(file.size)}</div>`;

  // Checkbox → highlight row
  const cb = item.querySelector(".file-check");
  cb.addEventListener("change", () => item.classList.toggle("file-selected", cb.checked));

  // Per-file EXP tag button
  item.querySelector(".exp-tag").addEventListener("click", () => {
    if (window.AdvConfig) window.AdvConfig.openExpForFile(file.name);
  });

  // Per-file LOC tag button
  item.querySelector(".loc-tag").addEventListener("click", () => {
    if (window.AdvConfig) window.AdvConfig.openLocForFile(file.name);
  });

  return item;
}

// ════════════════════════════════════════════════════════
// ── Update File Selection UI ──
// ════════════════════════════════════════════════════════
function updateFileSelectionUI() {
  if (!filesToUpload.length) {
    selectedFiles.innerHTML = `
      <div class="files-empty-state">
        <i class="fas fa-file-upload"></i>
        <p>No files selected yet</p>
      </div>`;
    uploadBtn.disabled = true;
    return;
  }

  selectedFiles.innerHTML = "";

  // Header row with count + select-all
  const header = document.createElement("div");
  header.className = "selected-files-header";
  header.innerHTML = `
    <h4>Selected Files (${filesToUpload.length})</h4>
    <label class="select-all-wrap ${advModeActive ? 'visible' : ''}">
      <input type="checkbox" id="selectAllCheck"> Select All
    </label>`;
  selectedFiles.appendChild(header);

  // Select-all logic
  const selectAll = header.querySelector("#selectAllCheck");
  selectAll.addEventListener("change", () => {
    document.querySelectorAll(".file-check").forEach(cb => {
      cb.checked = selectAll.checked;
      cb.closest(".file-item").classList.toggle("file-selected", selectAll.checked);
    });
  });

  // File rows
  filesToUpload.forEach(file => {
    const wasRenamed = Array.from(renamedFilesMap.values()).includes(file.name);
    const item = buildFileItem(file, { wasRenamed });
    if (advModeActive) item.classList.add("adv-mode-item");
    selectedFiles.appendChild(item);
  });

  // If adv mode is on, re-apply the adv-mode class
  if (advModeActive) selectedFiles.classList.add("adv-mode");

  uploadBtn.disabled = false;

  // Refresh adv config tags visual state
  if (window.AdvConfig) window.AdvConfig.refreshTagStates();
}

// ════════════════════════════════════════════════════════
// ── File Selection Handler (browser <input>) ──
// ════════════════════════════════════════════════════════
function handleFileSelect() {
  filesToUpload = []; filesWithUnicode = []; renamedFilesMap.clear();
  const allFiles = Array.from(fileInput.files);

  if (!allFiles.length) {
    showErrorMessage("No files selected.");
    selectedFiles.innerHTML = "";
    uploadBtn.disabled = true;
    return;
  }

  const validFiles = [], unicodeFiles = [];
  allFiles.forEach(file => {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!allowedExts.includes(ext)) return;
    containsUnicode(file.name) ? unicodeFiles.push(file) : validFiles.push(file);
  });

  if (!validFiles.length && !unicodeFiles.length) {
    showErrorMessage("No supported VPN files selected.");
    selectedFiles.innerHTML = "";
    uploadBtn.disabled = true;
    return;
  }

  filesToUpload    = validFiles;
  filesWithUnicode = unicodeFiles;

  // Build initial UI (unicode files shown inline as warnings)
  selectedFiles.innerHTML = "";
  const header = document.createElement("div");
  header.className = "selected-files-header";
  header.innerHTML = `<h4>Selected Files (${validFiles.length + unicodeFiles.length})</h4>
    <label class="select-all-wrap ${advModeActive ? 'visible' : ''}">
      <input type="checkbox" id="selectAllCheck"> Select All
    </label>`;
  selectedFiles.appendChild(header);

  const selectAll = header.querySelector("#selectAllCheck");
  selectAll.addEventListener("change", () => {
    document.querySelectorAll(".file-check").forEach(cb => {
      cb.checked = selectAll.checked;
      cb.closest(".file-item").classList.toggle("file-selected", selectAll.checked);
    });
  });

  validFiles.forEach(f => selectedFiles.appendChild(buildFileItem(f)));
  unicodeFiles.forEach(f => selectedFiles.appendChild(buildFileItem(f, { isUnicode: true })));

  if (advModeActive) selectedFiles.classList.add("adv-mode");

  uploadBtn.disabled = filesToUpload.length === 0;

  const vpnGoDetected = validFiles.filter(f => isVpnGoFile(f.name));
  if (vpnGoDetected.length)
    showWarningMessage(`🔒 ${vpnGoDetected.length} Let\'s VPN Go file(s) detected — PIN required.`);

  if (unicodeFiles.length) {
    showWarningMessage(`${unicodeFiles.length} file(s) have Unicode characters and need renaming.`);
    setTimeout(() => showRenameModal(unicodeFiles), 800);
  }
}

// ════════════════════════════════════════════════════════
// ── Native File Callback (Android → JS) ──
// ════════════════════════════════════════════════════════
window.onNativeFilesSelected = function(nativeFiles) {
  filesToUpload = []; filesWithUnicode = []; renamedFilesMap.clear();

  if (!nativeFiles || !nativeFiles.length) {
    showErrorMessage("No files selected.");
    selectedFiles.innerHTML = "";
    uploadBtn.disabled = true;
    return;
  }

  const validFiles = [], unicodeFiles = [];
  nativeFiles.forEach(nf => {
    const ext = nf.name.split('.').pop().toLowerCase();
    if (!allowedExts.includes(ext)) return;
    const fileObj = { name: nf.name, size: nf.size, nativeUri: nf.uri, isNative: true };
    containsUnicode(nf.name) ? unicodeFiles.push(fileObj) : validFiles.push(fileObj);
  });

  if (!validFiles.length && !unicodeFiles.length) {
    showErrorMessage("No supported VPN files found in your selection.");
    selectedFiles.innerHTML = "";
    uploadBtn.disabled = true;
    return;
  }

  filesToUpload    = validFiles;
  filesWithUnicode = unicodeFiles;

  selectedFiles.innerHTML = "";
  const header = document.createElement("div");
  header.className = "selected-files-header";
  header.innerHTML = `<h4>Selected Files (${validFiles.length + unicodeFiles.length})</h4>
    <label class="select-all-wrap ${advModeActive ? 'visible' : ''}">
      <input type="checkbox" id="selectAllCheck"> Select All
    </label>`;
  selectedFiles.appendChild(header);
  const selectAll = header.querySelector("#selectAllCheck");
  selectAll.addEventListener("change", () => {
    document.querySelectorAll(".file-check").forEach(cb => {
      cb.checked = selectAll.checked;
      cb.closest(".file-item").classList.toggle("file-selected", selectAll.checked);
    });
  });

  validFiles.forEach(f  => selectedFiles.appendChild(buildFileItem(f)));
  unicodeFiles.forEach(f => selectedFiles.appendChild(buildFileItem(f, { isUnicode: true })));

  if (advModeActive) selectedFiles.classList.add("adv-mode");

  uploadBtn.disabled = filesToUpload.length === 0;

  const vpnGoDetected = validFiles.filter(f => isVpnGoFile(f.name));
  if (vpnGoDetected.length)
    showWarningMessage(`🔒 ${vpnGoDetected.length} Let\'s VPN Go file(s) — PIN required on upload.`);

  if (unicodeFiles.length) {
    showWarningMessage(`${unicodeFiles.length} file(s) contain Unicode characters and need renaming.`);
    setTimeout(() => showRenameModal(unicodeFiles), 800);
  }
};

// ════════════════════════════════════════════════════════
// ── Rename Modal ──
// ════════════════════════════════════════════════════════
function showRenameModal(unicodeFiles) {
  renameList.innerHTML = "";
  unicodeFiles.forEach(file => {
    const safeName = generateSafeFilename(file.name);
    const item = document.createElement("div");
    item.className = "rename-item";
    item.innerHTML = `
      <div class="rename-item-info">
        <div class="rename-original">Original: <span>${file.name}</span></div>
      </div>
      <div class="rename-input-container">
        <input type="text" class="rename-input" value="${safeName}" data-original="${file.name}">
        <button class="rename-suggest" data-original="${file.name}">
          <i class="fas fa-robot"></i> AI Suggest
        </button>
      </div>`;
    renameList.appendChild(item);
  });

  // AI Suggest buttons → calls advanced-config.js AI suggest
  document.querySelectorAll(".rename-suggest").forEach(btn => {
    btn.addEventListener("click", async e => {
      const originalName = btn.getAttribute("data-original");
      const input = btn.parentElement.querySelector(".rename-input");

      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

      try {
        let suggested = generateSafeFilename(originalName);
        if (window.AdvConfig && window.AdvConfig.aiSuggestName) {
          suggested = await window.AdvConfig.aiSuggestName(originalName);
        }
        input.value = suggested;
        input.focus();
      } catch (err) {
        input.value = generateSafeFilename(originalName);
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-robot"></i> AI Suggest';
      }
    });
  });

  renameModal.classList.add("active");
}

function closeRenameModal() { renameModal.classList.remove("active"); }

function cancelRename() {
  closeRenameModal();
  filesToUpload = filesToUpload.filter(f => !containsUnicode(f.name));
  updateFileSelectionUI();
  if (!filesToUpload.length) {
    showErrorMessage("Upload cancelled — no valid files remaining.");
    uploadBtn.disabled = true;
  } else {
    showWarningMessage("Files with Unicode characters were removed.");
  }
}

function applyRenames() {
  const inputs = document.querySelectorAll(".rename-input");
  let allValid = true;
  renamedFilesMap.clear();

  inputs.forEach(input => {
    const originalName = input.getAttribute("data-original");
    const newName      = input.value.trim();
    const originalFile = filesWithUnicode.find(f => f.name === originalName);
    if (!originalFile) return;

    if (!newName) {
      showErrorMessage("File name cannot be empty!");
      allValid = false; input.focus(); return;
    }
    if (newName === originalName) {
      showErrorMessage(`"${originalName}" still contains invalid characters.`);
      allValid = false; input.focus(); return;
    }
    if (containsUnicode(newName)) {
      showErrorMessage(`"${newName}" still has Unicode — use keyboard characters only.`);
      allValid = false; input.focus(); return;
    }
    const ext = newName.split('.').pop().toLowerCase();
    if (!allowedExts.includes(ext)) {
      showErrorMessage(`"${newName}" has an unsupported extension.`);
      allValid = false; input.focus(); return;
    }
    renamedFilesMap.set(originalFile, newName);
  });

  if (!allValid) return;
  closeRenameModal();

  renamedFilesMap.forEach((newName, orig) => {
    if (orig.isNative) {
      filesToUpload.push({ name: newName, size: orig.size, nativeUri: orig.nativeUri, isNative: true });
    } else {
      filesToUpload.push(new File([orig], newName, { type: orig.type, lastModified: orig.lastModified }));
    }
  });

  updateFileSelectionUI();
  showSuccessMessage(`Renamed ${renamedFilesMap.size} file(s). Ready to upload!`);
}

// ════════════════════════════════════════════════════════
// ── PIN Modal Logic ──
// ════════════════════════════════════════════════════════
function openPinModal(vpnGoFiles) {
  pinVpngoCount.textContent = `${vpnGoFiles.length} Let\'s VPN Go file(s)`;
  pinVpngoFilesList.innerHTML = '<p><i class="fas fa-list" style="margin-right:4px;"></i>Files requiring PIN:</p>';
  vpnGoFiles.forEach(f => {
    const item = document.createElement("div");
    item.className = "pin-vpngo-file-item";
    item.innerHTML = `<i class="fas fa-dot-circle"></i><span>${f.name}</span>`;
    pinVpngoFilesList.appendChild(item);
  });

  pinInput.value = ""; pinConfirmInput.value = "";
  pinInput.classList.remove("error"); pinConfirmInput.classList.remove("error");
  pinErrorMsg.classList.remove("visible");

  pinModal.classList.add("active");
  setTimeout(() => pinInput.focus(), 300);
  return new Promise(resolve => { pinResolve = resolve; });
}

function closePinModal(result) {
  pinModal.classList.remove("active");
  if (pinResolve) { pinResolve(result); pinResolve = null; }
}

function setPinError(msg) {
  pinInput.classList.add("error"); pinConfirmInput.classList.add("error");
  pinErrorText.textContent = msg; pinErrorMsg.classList.add("visible");
}

function clearPinError() {
  pinInput.classList.remove("error"); pinConfirmInput.classList.remove("error");
  pinErrorMsg.classList.remove("visible");
}

pinToggleVis.addEventListener("click", () => {
  const show = pinInput.type === "password";
  pinInput.type = show ? "text" : "password";
  pinEyeIcon.className = show ? "fas fa-eye-slash" : "fas fa-eye";
});
pinConfirmToggleVis.addEventListener("click", () => {
  const show = pinConfirmInput.type === "password";
  pinConfirmInput.type = show ? "text" : "password";
  pinConfirmEyeIcon.className = show ? "fas fa-eye-slash" : "fas fa-eye";
});

[pinInput, pinConfirmInput].forEach(el => el.addEventListener("input", clearPinError));
[pinInput, pinConfirmInput].forEach(el =>
  el.addEventListener("keydown", e => { if (e.key === "Enter") pinNextBtn.click(); })
);

pinCancelBtn.addEventListener("click", () => closePinModal(false));

pinNextBtn.addEventListener("click", async () => {
  const pin     = pinInput.value;
  const confirm = pinConfirmInput.value;
  if (!pin) { setPinError("PIN cannot be empty."); pinInput.focus(); return; }
  if (pin !== confirm) { setPinError("PINs do not match. Please re-enter."); pinConfirmInput.focus(); return; }

  pinNextBtn.disabled = true;
  pinNextBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying…';

  const valid = await isPinValid(pin);

  pinNextBtn.disabled = false;
  pinNextBtn.innerHTML = '<i class="fas fa-arrow-right"></i> Next — Upload';

  if (!valid) {
    setPinError("Incorrect PIN. Please try again.");
    pinInput.value = ""; pinConfirmInput.value = "";
    pinInput.focus(); return;
  }
  closePinModal(true);
});

// ════════════════════════════════════════════════════════
// ── Progress Circle ──
// ════════════════════════════════════════════════════════
function updateProgress(percent) {
  const circumference = 2 * Math.PI * 45;
  progressFill.style.strokeDashoffset = circumference - (percent / 100) * circumference;
  progressText.textContent = `${Math.round(percent)}%`;
}

// ════════════════════════════════════════════════════════
// ── Read file as Base64 (browser + native) ──
// ════════════════════════════════════════════════════════
async function readFileAsBase64(file) {
  if (file.isNative) {
    const response = await fetch(file.nativeUri);
    if (!response.ok) throw new Error(`Failed to read native file: ${file.name}`);
    const buffer = await response.arrayBuffer();
    const bytes  = new Uint8Array(buffer);
    let binary   = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  } else {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result.split(',')[1]);
      reader.onerror = () => reject(new Error(`Failed to read: ${file.name}`));
      reader.readAsDataURL(file);
    });
  }
}

// ════════════════════════════════════════════════════════
// ── Retry helper for SHA-conflict-safe GitHub writes ──
// Retries up to `maxAttempts` times with exponential back-off.
// Passes the latest SHA back into the callback on each retry
// so the caller can re-fetch and re-PUT with fresh data.
// ════════════════════════════════════════════════════════
async function retryGitHubWrite(fn, maxAttempts = 4) {
  let delay = 1500;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isConflict =
        err.status === 409 ||
        (err.message && (
          err.message.includes("409") ||
          err.message.includes("conflict") ||
          err.message.includes("SHA")
        ));
      if (isConflict && attempt < maxAttempts) {
        console.warn(`[retryGitHubWrite] SHA conflict — retry ${attempt}/${maxAttempts - 1} in ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
        delay *= 2; // exponential back-off
      } else {
        throw err;
      }
    }
  }
}

// ════════════════════════════════════════════════════════
// ── Main Upload Orchestrator ──
// ════════════════════════════════════════════════════════
async function handleUpload() {
  if (!filesToUpload.length) return;

  // ── Step 1: VPNGo PIN gate ─────────────────────────────
  const vpnGoFiles = filesToUpload.filter(f => isVpnGoFile(f.name));
  if (vpnGoFiles.length) {
    showWarningMessage(`🔒 PIN required for ${vpnGoFiles.length} Let\'s VPN Go file(s).`);
    const pinApproved = await openPinModal(vpnGoFiles);
    if (!pinApproved) {
      const nonVpnGo = filesToUpload.filter(f => !isVpnGoFile(f.name));
      if (nonVpnGo.length) {
        filesToUpload = nonVpnGo;
        showWarningMessage(`PIN cancelled. Uploading ${nonVpnGo.length} non-VPN-Go file(s).`);
        updateFileSelectionUI();
      } else {
        showErrorMessage("Upload cancelled — no files to upload without PIN.");
        return;
      }
    } else {
      showSuccessMessage("PIN verified ✓ — uploading all files.");
    }
  }

  // ── Step 2: Collect advanced config ────────────────────
  const advConfigData = window.AdvConfig ? window.AdvConfig.getBatchConfig(filesToUpload) : {};

  // ── Step 3: Begin UI ────────────────────────────────────
  uploadBtn.disabled = true;
  uploadSection.classList.add("uploading");
  uploadArea.classList.add("active");
  uploadProgress.classList.add("active");

  const total         = filesToUpload.length;
  const uploadEntries = [];
  const metadataBatch = {};
  const errors        = [];
  let   uploadedCount = 0;

  // ── Phase 1: Upload files to GitHub (drives progress 0→100%) ──
  for (let i = 0; i < total; i++) {
    const file = filesToUpload[i];
    updateProgress((i / total) * 100);
    uploadStatus.textContent = `Uploading ${file.name}… (${i + 1}/${total})`;

    try {
      const savedName = await uploadFileToGitHub(file);
      uploadedCount++;
      updateProgress(((i + 1) / total) * 100);

      const ext      = savedName.split('.').pop().toLowerCase();
      const configId = getConfigIdByExtension(ext);

      // Accumulate metadata counts
      metadataBatch[configId] = (metadataBatch[configId] || 0) + 1;

      const fileConf  = advConfigData[file.name] || {};
      const expTs     = fileConf.expiration || null;
      const locations = fileConf.locations  || [];

      const uploadEntry = {
        name:      savedName.replace(/\.[^/.]+$/, "").replace(/_/g, " "),
        vpn:       getVpnAppByExtension(ext),
        filename:  savedName,
        date:      formatDate(new Date()),
        config_id: configId
      };
      if (expTs)            uploadEntry.expires_at = expTs;
      if (locations.length) uploadEntry.locations  = locations;

      uploadEntries.push(uploadEntry);
    } catch (err) {
      errors.push(`${file.name} — ${err.message}`);
    }
  }

  // ── Phase 2: Write uploads.json entries SEQUENTIALLY ──
  // Must be sequential — parallel writes race on the file SHA and
  // produce 409 Conflict errors.  Each write uses retryGitHubWrite
  // so a transient SHA mismatch is automatically re-tried.
  updateProgress(100);
  uploadStatus.textContent = `Saving file entries… (0/${uploadEntries.length})`;

  for (let i = 0; i < uploadEntries.length; i++) {
    const entry = uploadEntries[i];
    uploadStatus.textContent = `Saving file entries… (${i + 1}/${uploadEntries.length})`;
    try {
      await retryGitHubWrite(() => updateUploadsJSON(entry));
    } catch (e) {
      console.error(`[uploads.json] Failed to save entry for "${entry.filename}":`, e);
      errors.push(`Metadata entry for ${entry.filename} failed — ${e.message}`);
    }
    // Small pause between sequential writes to let GitHub index the new SHA
    if (i < uploadEntries.length - 1) {
      await new Promise(r => setTimeout(r, 800));
    }
  }

  // ── Phase 3: Write metadata.json AFTER all uploads.json writes settle ──
  // Wait for GitHub to fully commit the last uploads.json write before
  // touching metadata.json, otherwise we risk reading a stale SHA.
  if (Object.keys(metadataBatch).length) {
    uploadStatus.textContent = `Updating metadata…`;
    await new Promise(r => setTimeout(r, 2000));
    try {
      await retryGitHubWrite(() => updateMetadataJSON(metadataBatch));
    } catch (e) {
      console.error("[metadata.json] Failed to update metadata:", e);
      // Non-fatal — surface as warning, not blocking error
      showWarningMessage("Upload succeeded but metadata counts may be stale. They will sync on next upload.");
    }
  }

  // ── Phase 4: Clean up adv config ───────────────────────
  if (window.AdvConfig) window.AdvConfig.clearAll();

  // ── Phase 5: Done ───────────────────────────────────────
  if (errors.length) {
    uploadStatus.textContent = `⚠️ Uploaded ${uploadedCount} files, ${errors.length} error(s)`;
    showErrorMessage(`Upload completed with ${errors.length} error(s).`);
  } else {
    uploadStatus.textContent = `✅ All done — ${uploadedCount} file(s) uploaded`;
    showSuccessMessage(`Uploaded ${uploadedCount} file(s)!`);
  }

  const doneBadge = document.getElementById('uploadDoneBadge');
  if (doneBadge) doneBadge.classList.add('visible');
  if (progressFill) progressFill.classList.add('done');
  progressText.textContent = '✓';

  // Reset UI after 3.2s
  setTimeout(() => {
    uploadSection.classList.remove("uploading");
    uploadArea.classList.remove("active");
    uploadProgress.classList.remove("active");
    uploadBtn.disabled = false;
    if (doneBadge) doneBadge.classList.remove('visible');
    if (progressFill) progressFill.classList.remove('done');
    selectedFiles.innerHTML = `<div class="files-empty-state"><i class="fas fa-file-upload"></i><p>No files selected yet</p></div>`;
    filesToUpload = []; filesWithUnicode = []; renamedFilesMap.clear();
    fileInput.value = "";
    updateProgress(0);
  }, 3200);
}

// ════════════════════════════════════════════════════════
// ── Formatters ──
// ════════════════════════════════════════════════════════
function formatFileSize(bytes) {
  if (!bytes) return '0 Bytes';
  const k = 1024, sizes = ['Bytes','KB','MB','GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(date) {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

// ════════════════════════════════════════════════════════
// ── VPN Format Grid ──
// ════════════════════════════════════════════════════════
function initVpnFormats() {
  vpnGrid.innerHTML = "";
  for (const [configId, ext] of Object.entries(VPN_FORMATS)) {
    const item = document.createElement("div");
    item.className = "vpn-item";
    item.innerHTML = `
      <span class="vpn-name">${VPN_DISPLAY_NAMES[configId] || configId}</span>
      <span class="vpn-extension">.${ext}</span>`;
    vpnGrid.appendChild(item);
  }
}

initVpnFormats();
