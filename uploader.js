// ── uploader.js ──
// UI logic: file selection, validation, rename modal, PIN guard, progress, upload orchestration

// ════════════════════════════════════════════════════════
// ── Inject CSS (PIN modal styles only) ──
// ════════════════════════════════════════════════════════
(function injectStyles() {
  const css = `
/* ── file-vpngo border accent (extends existing .file-item rules in CSS) ── */
.file-item.file-vpngo { border-left-color: #6c63ff; }

/* ── PIN Modal ── */
.pin-modal {
  position: fixed; top: 0; left: 0;
  width: 100%; height: 100%;
  background: rgba(230,233,240,0.93);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: none; justify-content: center; align-items: center;
  z-index: 4000;
}
.pin-modal.active { display: flex; animation: fadeIn 0.3s ease; }

@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.pin-modal-content {
  background: var(--card-bg); border-radius: 22px;
  padding: 2rem 1.6rem 1.6rem;
  width: 90%; max-width: 400px;
  border: 1px solid var(--border-color);
  box-shadow: 0 16px 40px rgba(0,0,0,0.13);
  animation: modalSlideUp 0.4s ease;
  text-align: center;
}

.pin-modal-icon {
  width: 58px; height: 58px;
  background: linear-gradient(135deg, #1a1a1a 0%, #3a3a3a 100%);
  border-radius: 18px;
  display: inline-flex; align-items: center; justify-content: center;
  margin-bottom: 1rem;
  box-shadow: 0 6px 16px rgba(0,0,0,0.18);
}
.pin-modal-icon i { color: #fff; font-size: 1.5rem; }

.pin-modal-title {
  font-size: 1.2rem; font-weight: 700; color: var(--text-dark);
  margin-bottom: 0.4rem; letter-spacing: -0.2px;
}
.pin-modal-subtitle {
  font-size: 0.85rem; color: var(--accent-gray);
  margin-bottom: 1.5rem; line-height: 1.5;
}

.pin-modal-file-badge {
  display: inline-flex; align-items: center; gap: 6px;
  background: rgba(108,99,255,0.08); border: 1px solid rgba(108,99,255,0.2);
  border-radius: 20px; padding: 4px 12px;
  font-size: 0.78rem; color: #6c63ff; font-weight: 600;
  margin-bottom: 1.4rem;
}

.pin-field-group { margin-bottom: 1rem; text-align: left; }
.pin-field-label {
  display: block; font-size: 0.82rem; font-weight: 600;
  color: var(--text-medium); margin-bottom: 0.4rem;
}

.pin-input-wrap {
  position: relative;
}
.pin-input {
  width: 100%;
  background: #f4f6fa; border: 1.5px solid var(--border-color);
  border-radius: 10px; padding: 0.75rem 2.6rem 0.75rem 0.9rem;
  color: var(--text-dark); font-size: 1rem;
  font-weight: 600; letter-spacing: 0.05em;
  transition: var(--transition);
  outline: none;
}
.pin-input:focus {
  border-color: #1a1a1a;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(0,0,0,0.07);
}
.pin-input.error {
  border-color: var(--error-red);
  box-shadow: 0 0 0 3px rgba(255,71,87,0.1);
}
.pin-toggle-vis {
  position: absolute; right: 10px; top: 50%;
  transform: translateY(-50%);
  background: none; border: none; cursor: pointer;
  color: var(--accent-gray); font-size: 1rem;
  transition: color 0.15s;
}
.pin-toggle-vis:hover { color: var(--text-dark); }

.pin-error-msg {
  display: none; margin-top: 0.5rem;
  font-size: 0.8rem; color: var(--error-red);
  font-weight: 500;
}
.pin-error-msg.visible { display: block; animation: shakeX 0.35s ease; }

@keyframes shakeX {
  0%,100% { transform: translateX(0); }
  20%      { transform: translateX(-5px); }
  40%      { transform: translateX(5px); }
  60%      { transform: translateX(-4px); }
  80%      { transform: translateX(4px); }
}

.pin-vpngo-files-list {
  background: #f6f8fa; border: 1px solid var(--border-light);
  border-radius: 10px; padding: 0.7rem 0.9rem;
  margin-bottom: 1.2rem; text-align: left;
  max-height: 120px; overflow-y: auto;
}
.pin-vpngo-files-list p {
  font-size: 0.78rem; color: var(--accent-gray);
  margin-bottom: 0.4rem; font-weight: 600;
}
.pin-vpngo-file-item {
  display: flex; align-items: center; gap: 6px;
  font-size: 0.82rem; color: var(--text-medium);
  padding: 2px 0;
}
.pin-vpngo-file-item i { color: #6c63ff; font-size: 0.75rem; }

.pin-modal-footer {
  display: flex; gap: 10px; margin-top: 1.4rem;
  justify-content: stretch;
}
.pin-cancel-btn {
  flex: 1; padding: 0.7rem 1rem;
  background: transparent; color: var(--text-medium);
  border: 1.5px solid var(--border-color);
  border-radius: 25px; font-weight: 600; font-size: 0.9rem;
  cursor: pointer; transition: var(--transition);
}
.pin-cancel-btn:hover {
  background: #f0f0f0; border-color: #999;
}
.pin-next-btn {
  flex: 2; padding: 0.7rem 1rem;
  background: #1a1a1a; color: #fff;
  border: none; border-radius: 25px;
  font-weight: 700; font-size: 0.9rem;
  cursor: pointer; transition: var(--transition);
  display: flex; align-items: center; justify-content: center; gap: 6px;
  position: relative; overflow: hidden;
}
.pin-next-btn::before {
  content: '';
  position: absolute; top: 0; left: -100%;
  width: 100%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent);
  transition: left 0.5s ease;
}
.pin-next-btn:hover::before { left: 100%; }
.pin-next-btn:hover {
  background: #000;
  transform: translateY(-2px);
  box-shadow: 0 4px 14px rgba(0,0,0,0.2);
}
.pin-next-btn:disabled {
  background: #c4c8d0; color: #888;
  cursor: not-allowed; transform: none; box-shadow: none;
}

/* ── PIN modal responsive ── */
@media (max-width: 480px) {
  .pin-modal-footer { flex-direction: column; }
}
  `;
  const style = document.createElement("style");
  style.id = "uploader-injected-css";
  style.textContent = css;
  document.head.appendChild(style);
})();

// ════════════════════════════════════════════════════════
// ── Inject PIN Modal HTML into the DOM ──
// ════════════════════════════════════════════════════════
(function injectPinModal() {
  const modalHTML = `
  <div id="pinModal" class="pin-modal" role="dialog" aria-modal="true" aria-labelledby="pinModalTitle">
    <div class="pin-modal-content">
      <div class="pin-modal-icon"><i class="fas fa-shield-alt"></i></div>
      <div class="pin-modal-title" id="pinModalTitle">PIN Required</div>
      <div class="pin-modal-subtitle">
        Let's VPN Go files detected.<br>
        Please enter the upload PIN to continue.
      </div>
      <div class="pin-modal-file-badge">
        <i class="fas fa-lock"></i>
        <span id="pinVpngoCount">0 Let's VPN Go file(s)</span>
      </div>
      <div class="pin-vpngo-files-list" id="pinVpngoFilesList">
        <p><i class="fas fa-list" style="margin-right:4px"></i>Files requiring PIN:</p>
      </div>

      <div class="pin-field-group">
        <label class="pin-field-label" for="pinInput">Enter PIN</label>
        <div class="pin-input-wrap">
          <input
            type="password"
            id="pinInput"
            class="pin-input"
            placeholder="Enter your PIN"
            autocomplete="new-password"
            spellcheck="false"
          />
          <button class="pin-toggle-vis" id="pinToggleVis" type="button" aria-label="Show/hide PIN">
            <i class="fas fa-eye" id="pinEyeIcon"></i>
          </button>
        </div>
      </div>

      <div class="pin-field-group">
        <label class="pin-field-label" for="pinConfirmInput">Confirm PIN</label>
        <div class="pin-input-wrap">
          <input
            type="password"
            id="pinConfirmInput"
            class="pin-input"
            placeholder="Re-enter your PIN"
            autocomplete="new-password"
            spellcheck="false"
          />
          <button class="pin-toggle-vis" id="pinConfirmToggleVis" type="button" aria-label="Show/hide confirm PIN">
            <i class="fas fa-eye" id="pinConfirmEyeIcon"></i>
          </button>
        </div>
        <div class="pin-error-msg" id="pinErrorMsg">
          <i class="fas fa-exclamation-circle"></i> <span id="pinErrorText">PINs do not match.</span>
        </div>
      </div>

      <div class="pin-modal-footer">
        <button class="pin-cancel-btn" id="pinCancelBtn" type="button">
          <i class="fas fa-times"></i> Cancel
        </button>
        <button class="pin-next-btn" id="pinNextBtn" type="button">
          <i class="fas fa-arrow-right"></i> Next — Upload
        </button>
      </div>
    </div>
  </div>`;

  document.body.insertAdjacentHTML("beforeend", modalHTML);
})();

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
//
//  A file is flagged as a LetsVPNGo file when:
//    1.  Its extension is "js"  — the primary LetsVPN Go format, OR
//    2.  Its name (lowercased) contains any of the keyword fragments below
//        (covers filenames like "letsvpngo_server.conf", "lvgo.ehi", etc.)
// ════════════════════════════════════════════════════════
const VPNGO_KEYWORDS = [
  "letsvpngo", "letsvpn", "lvpngo", "lvgo",
  "lets_vpn", "lets-vpn", "letsgo", "vpngo"
];

function isVpnGoFile(filename) {
  const lower = filename.toLowerCase();
  const ext   = lower.split('.').pop();
  if (ext === "js") return true;
  return VPNGO_KEYWORDS.some(kw => lower.includes(kw));
}

// ════════════════════════════════════════════════════════
// ── Authorised PINs (hashed at runtime for security) ──
// ════════════════════════════════════════════════════════
const ALLOWED_PINS = [
  "Let'svpngo#/1",
  "Go@Techmaster",
  "User1-@chaosdevs",
  "De-@#489hjhkk",
  "368$789@378",
  "letsvpn@go-2"
];

// Simple runtime hash — avoids plaintext comparison in a single pass
async function hashPin(raw) {
  const encoded = new TextEncoder().encode(raw);
  const buf     = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

let _allowedHashes = null;
async function getAllowedHashes() {
  if (!_allowedHashes) {
    _allowedHashes = await Promise.all(ALLOWED_PINS.map(hashPin));
  }
  return _allowedHashes;
}

async function isPinValid(pin) {
  const [inputHash, allowed] = await Promise.all([hashPin(pin), getAllowedHashes()]);
  return allowed.includes(inputHash);
}

// ════════════════════════════════════════════════════════
// ── DOM References ──
// ════════════════════════════════════════════════════════
const fileInput       = document.getElementById("fileInput");
const browseBtn       = document.getElementById("browseBtn");
const uploadArea      = document.getElementById("uploadArea");
const uploadBtn       = document.getElementById("uploadBtn");
const uploadProgress  = document.getElementById("uploadProgress");
const uploadSection   = document.getElementById("uploadSection");
const progressFill    = document.querySelector(".progress-circle-fill");
const progressText    = document.querySelector(".progress-text");
const uploadStatus    = document.getElementById("uploadStatus");
const selectedFiles   = document.getElementById("selectedFiles");
const vpnGrid         = document.getElementById("vpnGrid");
const vpnInfo         = document.getElementById("vpnInfo");
const showFilesBtn    = document.getElementById("showFilesBtn");
const navToggle       = document.getElementById("navToggle");
const dropdownMenu    = document.getElementById("dropdownMenu");
const renameModal     = document.getElementById("renameModal");
const renameClose     = document.getElementById("renameClose");
const renameCancelBtn = document.getElementById("renameCancelBtn");
const renameApplyBtn  = document.getElementById("renameApplyBtn");
const renameList      = document.getElementById("renameList");

// PIN modal refs (injected above — safe to grab now)
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

// PIN gate state
let pendingVpnGoFiles  = [];   // VPNGo files waiting for PIN
let pinResolve         = null; // resolve fn for the PIN promise

// ════════════════════════════════════════════════════════
// ── Android Bridge Detection ──
// ════════════════════════════════════════════════════════
function isAndroidApp() {
  return typeof window.Android !== "undefined" && typeof window.Android.openFilePicker === "function";
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
  if (!event.target.closest(".nav-container") && !event.target.closest(".dropdown-menu")) {
    navToggle.classList.remove("active");
    dropdownMenu.classList.remove("active");
  }
});
dropdownMenu.addEventListener("click", () => {
  navToggle.classList.remove("active");
  dropdownMenu.classList.remove("active");
});

// ════════════════════════════════════════════════════════
// ── Core Event Listeners ──
// ════════════════════════════════════════════════════════
browseBtn.addEventListener("click", () => {
  if (isAndroidApp()) {
    window.Android.openFilePicker();
  } else {
    fileInput.click();
  }
});

fileInput.addEventListener("change", handleFileSelect);
uploadBtn.addEventListener("click", handleUpload);
showFilesBtn.addEventListener("click", toggleShowFiles);
renameClose.addEventListener("click", closeRenameModal);
renameCancelBtn.addEventListener("click", cancelRename);
renameApplyBtn.addEventListener("click", applyRenames);

// ── Drag & Drop ──
uploadArea.addEventListener("dragover", e => { e.preventDefault(); uploadArea.classList.add("active"); });
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
  vpnInfo.classList.toggle("active");
  showFilesBtn.innerHTML = showFilesVisible
    ? '<i class="fas fa-times"></i> Hide Supported Files'
    : '<i class="fas fa-list"></i> Show Supported Files';
}

// ════════════════════════════════════════════════════════
// ── Unicode Detection & Safe Name ──
// ════════════════════════════════════════════════════════
function containsUnicode(filename) {
  for (const char of filename) {
    if (char.codePointAt(0) > 255) return true;
  }
  return false;
}

function generateSafeFilename(filename) {
  let result = '';
  for (const char of filename) {
    result += char.codePointAt(0) <= 255 ? char : '_';
  }
  return result;
}

// ════════════════════════════════════════════════════════
// ── Toast Notifications ──
// ════════════════════════════════════════════════════════
function showToast(type, message) {
  document.querySelector(`.${type}-message`)?.remove();
  const icons = { error: "exclamation-triangle", success: "check-circle", warning: "exclamation-circle" };
  const div = document.createElement("div");
  div.className = `${type}-message`;
  div.innerHTML = `
    <div class="toast-content">
      <i class="fas fa-${icons[type]}"></i>
      <span>${message}</span>
      <button class="toast-close"><i class="fas fa-times"></i></button>
    </div>`;
  const close = () => {
    div.style.animation = "slideOutRight 0.3s ease";
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
// ── PIN Modal Logic ──
// ════════════════════════════════════════════════════════

/** Populate and show the PIN modal. Returns a Promise that resolves to
 *  true  → PIN verified, proceed with upload
 *  false → user cancelled
 */
function openPinModal(vpnGoFiles) {
  // Populate file list
  pinVpngoCount.textContent = `${vpnGoFiles.length} Let's VPN Go file(s)`;
  // Reset list (keep the heading)
  pinVpngoFilesList.innerHTML = '<p><i class="fas fa-list" style="margin-right:4px"></i>Files requiring PIN:</p>';
  vpnGoFiles.forEach(f => {
    const item = document.createElement("div");
    item.className = "pin-vpngo-file-item";
    item.innerHTML = `<i class="fas fa-dot-circle"></i><span>${f.name}</span>`;
    pinVpngoFilesList.appendChild(item);
  });

  // Reset inputs
  pinInput.value         = "";
  pinConfirmInput.value  = "";
  pinInput.classList.remove("error");
  pinConfirmInput.classList.remove("error");
  pinErrorMsg.classList.remove("visible");
  pinErrorText.textContent = "";

  pinModal.classList.add("active");
  setTimeout(() => pinInput.focus(), 300);

  return new Promise(resolve => { pinResolve = resolve; });
}

function closePinModal(result) {
  pinModal.classList.remove("active");
  if (pinResolve) { pinResolve(result); pinResolve = null; }
}

function setPinError(msg) {
  pinInput.classList.add("error");
  pinConfirmInput.classList.add("error");
  pinErrorText.textContent = msg;
  pinErrorMsg.classList.add("visible");
  // shake the inputs
  pinInput.style.animation = "none"; pinConfirmInput.style.animation = "none";
  requestAnimationFrame(() => {
    pinInput.style.animation = "";
    pinConfirmInput.style.animation = "";
  });
}

function clearPinError() {
  pinInput.classList.remove("error");
  pinConfirmInput.classList.remove("error");
  pinErrorMsg.classList.remove("visible");
}

// Toggle visibility for first PIN field
pinToggleVis.addEventListener("click", () => {
  const show = pinInput.type === "password";
  pinInput.type = show ? "text" : "password";
  pinEyeIcon.className = show ? "fas fa-eye-slash" : "fas fa-eye";
});

// Toggle visibility for confirm PIN field
pinConfirmToggleVis.addEventListener("click", () => {
  const show = pinConfirmInput.type === "password";
  pinConfirmInput.type = show ? "text" : "password";
  pinConfirmEyeIcon.className = show ? "fas fa-eye-slash" : "fas fa-eye";
});

// Clear errors while typing
[pinInput, pinConfirmInput].forEach(el => el.addEventListener("input", clearPinError));

// Allow Enter key to submit
[pinInput, pinConfirmInput].forEach(el =>
  el.addEventListener("keydown", e => { if (e.key === "Enter") pinNextBtn.click(); })
);

// Cancel
pinCancelBtn.addEventListener("click", () => {
  closePinModal(false);
});

// Next — validate & proceed
pinNextBtn.addEventListener("click", async () => {
  const pin     = pinInput.value;
  const confirm = pinConfirmInput.value;

  if (!pin) {
    setPinError("PIN cannot be empty.");
    pinInput.focus();
    return;
  }
  if (pin !== confirm) {
    setPinError("PINs do not match. Please re-enter.");
    pinConfirmInput.focus();
    return;
  }

  // Disable button while checking
  pinNextBtn.disabled = true;
  pinNextBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying…';

  const valid = await isPinValid(pin);

  pinNextBtn.disabled = false;
  pinNextBtn.innerHTML = '<i class="fas fa-arrow-right"></i> Next — Upload';

  if (!valid) {
    setPinError("Incorrect PIN. Please try again.");
    pinInput.value = "";
    pinConfirmInput.value = "";
    pinInput.focus();
    return;
  }

  closePinModal(true);
});

// ════════════════════════════════════════════════════════
// ── Native File Callback (Android → JS) ──
// ════════════════════════════════════════════════════════
window.onNativeFilesSelected = function(nativeFiles) {
  filesToUpload = [];
  filesWithUnicode = [];
  renamedFilesMap.clear();

  if (!nativeFiles || nativeFiles.length === 0) {
    showErrorMessage("No files selected.");
    selectedFiles.innerHTML = "";
    uploadBtn.disabled = true;
    return;
  }

  const validFiles   = [];
  const unicodeFiles = [];

  nativeFiles.forEach(nf => {
    const ext = nf.name.split('.').pop().toLowerCase();
    if (!allowedExts.includes(ext)) return;

    const fileObj = {
      name:      nf.name,
      size:      nf.size,
      nativeUri: nf.uri,
      isNative:  true
    };

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

  selectedFiles.innerHTML = `<h4>Selected Files (${validFiles.length + unicodeFiles.length})</h4>`;

  validFiles.forEach(file => {
    const isVpnGo = isVpnGoFile(file.name);
    const item = document.createElement("div");
    item.className = `file-item${isVpnGo ? " file-vpngo" : ""}`;
    item.innerHTML = `
      <div class="file-name">
        <i class="fas fa-${isVpnGo ? "shield-alt" : "file"}" style="color:${isVpnGo ? "#6c63ff" : "var(--success-green)"}"></i>
        <span>${file.name}${isVpnGo ? ' <small style="color:#6c63ff">(PIN required)</small>' : ''}</span>
      </div>
      <div class="file-size">${formatFileSize(file.size)}</div>`;
    selectedFiles.appendChild(item);
  });

  unicodeFiles.forEach(file => {
    const item = document.createElement("div");
    item.className = "file-item file-unicode";
    item.innerHTML = `
      <div class="file-name">
        <i class="fas fa-exclamation-triangle" style="color:var(--warning-orange)"></i>
        <span>${file.name} <small style="color:var(--warning-orange)">(needs rename)</small></span>
      </div>
      <div class="file-size">${formatFileSize(file.size)}</div>`;
    selectedFiles.appendChild(item);
  });

  uploadBtn.disabled = filesToUpload.length === 0;

  // Show VPNGo PIN notice if any detected
  const vpnGoDetected = validFiles.filter(f => isVpnGoFile(f.name));
  if (vpnGoDetected.length) {
    showWarningMessage(`🔒 ${vpnGoDetected.length} Let's VPN Go file(s) detected — a PIN will be required to upload.`);
  }

  if (unicodeFiles.length) {
    showWarningMessage(`${unicodeFiles.length} file(s) contain Unicode characters and need to be renamed.`);
    setTimeout(() => showRenameModal(unicodeFiles), 800);
  }
};

// ════════════════════════════════════════════════════════
// ── File Selection Handler (browser <input> path) ──
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

  filesToUpload = validFiles;
  filesWithUnicode = unicodeFiles;
  selectedFiles.innerHTML = `<h4>Selected Files (${validFiles.length + unicodeFiles.length})</h4>`;

  validFiles.forEach(file => {
    const isVpnGo = isVpnGoFile(file.name);
    const item = document.createElement("div");
    item.className = `file-item${isVpnGo ? " file-vpngo" : ""}`;
    item.innerHTML = `
      <div class="file-name">
        <i class="fas fa-${isVpnGo ? "shield-alt" : "file"}" style="color:${isVpnGo ? "#6c63ff" : "var(--success-green)"}"></i>
        <span>${file.name}${isVpnGo ? ' <small style="color:#6c63ff">(PIN required)</small>' : ''}</span>
      </div>
      <div class="file-size">${formatFileSize(file.size)}</div>`;
    selectedFiles.appendChild(item);
  });

  unicodeFiles.forEach(file => {
    const item = document.createElement("div");
    item.className = "file-item file-unicode";
    item.innerHTML = `
      <div class="file-name">
        <i class="fas fa-exclamation-triangle" style="color:var(--warning-orange)"></i>
        <span>${file.name} <small style="color:var(--warning-orange)">(needs rename)</small></span>
      </div>
      <div class="file-size">${formatFileSize(file.size)}</div>`;
    selectedFiles.appendChild(item);
  });

  uploadBtn.disabled = filesToUpload.length === 0;

  // Notify about VPNGo files
  const vpnGoDetected = validFiles.filter(f => isVpnGoFile(f.name));
  if (vpnGoDetected.length) {
    showWarningMessage(`🔒 ${vpnGoDetected.length} Let's VPN Go file(s) detected — a PIN will be required to upload.`);
  }

  if (unicodeFiles.length) {
    showWarningMessage(`${unicodeFiles.length} file(s) contain Unicode characters or emojis and need to be renamed.`);
    setTimeout(() => showRenameModal(unicodeFiles), 800);
  }
}

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
        <button class="rename-suggest" data-original="${file.name}">Suggest</button>
      </div>`;
    renameList.appendChild(item);
  });

  document.querySelectorAll(".rename-suggest").forEach(btn => {
    btn.addEventListener("click", e => {
      const input = e.target.parentElement.querySelector(".rename-input");
      input.value = generateSafeFilename(e.target.getAttribute("data-original"));
      input.focus();
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
    showErrorMessage("Upload cancelled. No valid files remaining.");
    uploadBtn.disabled = true;
  } else {
    showWarningMessage("Files with Unicode characters or emojis were removed.");
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
      showErrorMessage(`"${newName}" still contains Unicode. Use only keyboard characters.`);
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

function updateFileSelectionUI() {
  selectedFiles.innerHTML = `<h4>Selected Files (${filesToUpload.length})</h4>`;
  filesToUpload.forEach(file => {
    const wasRenamed = Array.from(renamedFilesMap.values()).includes(file.name);
    const isVpnGo   = isVpnGoFile(file.name);
    const item = document.createElement("div");
    item.className = `file-item${wasRenamed ? " file-renamed" : ""}${isVpnGo ? " file-vpngo" : ""}`;
    item.innerHTML = `
      <div class="file-name">
        <i class="fas fa-${isVpnGo ? "shield-alt" : "file"}" style="color:${isVpnGo ? "#6c63ff" : wasRenamed ? "#555" : "var(--success-green)"}"></i>
        <span>${file.name}
          ${wasRenamed ? '<small style="color:#888">(renamed)</small>' : ''}
          ${isVpnGo    ? '<small style="color:#6c63ff">(PIN required)</small>' : ''}
        </span>
      </div>
      <div class="file-size">${formatFileSize(file.size)}</div>`;
    selectedFiles.appendChild(item);
  });
  uploadBtn.disabled = filesToUpload.length === 0;
}

// ════════════════════════════════════════════════════════
// ── Progress Circle ──
// ════════════════════════════════════════════════════════
function updateProgress(percent) {
  const circumference = 2 * Math.PI * 45;
  progressFill.style.strokeDashoffset = circumference - (percent / 100) * circumference;
  progressText.textContent = `${Math.round(percent)}%`;
}

// ════════════════════════════════════════════════════════
// ── Read file content (supports browser File and native URI) ──
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
      reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
      reader.readAsDataURL(file);
    });
  }
}

// ════════════════════════════════════════════════════════
// ── Main Upload Orchestrator ──
// ════════════════════════════════════════════════════════
async function handleUpload() {
  if (!filesToUpload.length) return;

  // ── Step 1: Check for LetsVPNGo files and gate with PIN ──
  const vpnGoFiles = filesToUpload.filter(f => isVpnGoFile(f.name));

  if (vpnGoFiles.length) {
    showWarningMessage(`🔒 PIN required for ${vpnGoFiles.length} Let's VPN Go file(s).`);
    const pinApproved = await openPinModal(vpnGoFiles);

    if (!pinApproved) {
      // User cancelled — keep regular files, remove VPNGo ones
      const nonVpnGo = filesToUpload.filter(f => !isVpnGoFile(f.name));
      if (nonVpnGo.length) {
        filesToUpload = nonVpnGo;
        showWarningMessage(`PIN cancelled. Uploading ${nonVpnGo.length} non-VPN-Go file(s) only.`);
        updateFileSelectionUI();
        // continue to upload the rest below
      } else {
        showErrorMessage("Upload cancelled — no files to upload without PIN.");
        return;
      }
    } else {
      showSuccessMessage("PIN verified ✓ — uploading all files.");
    }
  }

  // ── Step 2: Begin upload ──
  uploadBtn.disabled = true;
  uploadSection.classList.add("uploading");
  uploadArea.classList.add("active");
  uploadProgress.classList.add("active");

  let uploadedCount = 0;
  const errors = [];
  const metadataBatch = {};

  for (let i = 0; i < filesToUpload.length; i++) {
    const file = filesToUpload[i];
    updateProgress(((i + 1) / filesToUpload.length) * 100);
    uploadStatus.textContent = `Uploading ${file.name}…`;

    try {
      const savedName = await uploadFileToGitHub(file);
      uploadedCount++;

      const ext      = savedName.split('.').pop().toLowerCase();
      const configId = getConfigIdByExtension(ext);
      metadataBatch[configId] = (metadataBatch[configId] || 0) + 1;

      await updateUploadsJSON({
        name:      savedName.replace(/\.[^/.]+$/, "").replace(/_/g, " "),
        vpn:       getVpnAppByExtension(ext),
        filename:  savedName,
        date:      formatDate(new Date()),
        config_id: configId
      });
    } catch (err) {
      errors.push(`Error: ${file.name} — ${err.message}`);
    }
  }

  if (Object.keys(metadataBatch).length) await updateMetadataJSON(metadataBatch);

  if (errors.length) {
    uploadStatus.textContent = `⚠️ Uploaded ${uploadedCount} files, ${errors.length} errors`;
    showErrorMessage(`Upload completed with ${errors.length} errors.`);
  } else {
    uploadStatus.textContent = `✅ Successfully uploaded ${uploadedCount} files`;
    showSuccessMessage(`Successfully uploaded ${uploadedCount} files!`);
  }

  setTimeout(() => {
    uploadSection.classList.remove("uploading");
    uploadArea.classList.remove("active");
    uploadProgress.classList.remove("active");
    uploadBtn.disabled = false;
    selectedFiles.innerHTML = "";
    filesToUpload = []; filesWithUnicode = []; renamedFilesMap.clear();
    fileInput.value = "";
  }, 3000);
}

// ════════════════════════════════════════════════════════
// ── Formatters ──
// ════════════════════════════════════════════════════════
function formatFileSize(bytes) {
  if (!bytes) return '0 Bytes';
  const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(date) {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function formatFullDateTime(date) {
  const p = n => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth()+1)}-${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
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

// ── Init ──
initVpnFormats();
