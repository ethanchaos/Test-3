// ── uploader.js ──
// UI logic: file selection, validation, rename modal, progress, upload orchestration

// ── Allowed Extensions ──
const allowedExts = [
  "dark","hc","pcx","sip","agn","v2","hat","aro","stk","hex","ziv",
  "sbr","ssc","vhd","ssh","rez","tnl","ost","tls","sut","ehi",
  "npv4","npvt","ink","pin","roy","js","conf","jez"
];

// ── DOM References ──
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

// ── State ──
let filesToUpload    = [];
let filesWithUnicode = [];
let showFilesVisible = false;
let renamedFilesMap  = new Map();

// ── Android Bridge Detection ──
// Returns true when running inside the ConfigHub Android app
function isAndroidApp() {
  return typeof window.Android !== "undefined" && typeof window.Android.openFilePicker === "function";
}

// ── Nav Toggle ──
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

// ── Core Event Listeners ──
browseBtn.addEventListener("click", () => {
  if (isAndroidApp()) {
    // ✅ Use the native Android file picker when inside the app
    window.Android.openFilePicker();
  } else {
    // Browser fallback — standard <input type="file"> click
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

// ── Toggle Supported Formats Panel ──
function toggleShowFiles() {
  showFilesVisible = !showFilesVisible;
  vpnInfo.classList.toggle("active");
  showFilesBtn.innerHTML = showFilesVisible
    ? '<i class="fas fa-times"></i> Hide Supported Files'
    : '<i class="fas fa-list"></i> Show Supported Files';
}

// ── Unicode Detection & Safe Name ──
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

// ── Toast Notifications ──
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

// ── Native File Callback (Android → JS) ──
// Called by UploaderHandler.java after the user picks files in the native picker.
// Each item in the array is: { name: string, uri: string, size: number }
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
    if (!allowedExts.includes(ext)) return; // skip unsupported extensions

    // Wrap the native file info in a plain object that the rest of
    // the uploader can treat like a File (name + size are all we need
    // until the actual upload, where we fetch by URI).
    const fileObj = {
      name:       nf.name,
      size:       nf.size,
      nativeUri:  nf.uri,   // content:// URI — used in uploadFileToGitHub
      isNative:   true
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
    const item = document.createElement("div");
    item.className = "file-item";
    item.innerHTML = `
      <div class="file-name"><i class="fas fa-file" style="color:var(--success-green)"></i><span>${file.name}</span></div>
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

  if (unicodeFiles.length) {
    showWarningMessage(`${unicodeFiles.length} file(s) contain Unicode characters and need to be renamed.`);
    setTimeout(() => showRenameModal(unicodeFiles), 800);
  }
};

// ── File Selection Handler (browser <input> path) ──
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
    const item = document.createElement("div");
    item.className = "file-item";
    item.innerHTML = `
      <div class="file-name"><i class="fas fa-file" style="color:var(--success-green)"></i><span>${file.name}</span></div>
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

  if (unicodeFiles.length) {
    showWarningMessage(`${unicodeFiles.length} file(s) contain Unicode characters or emojis and need to be renamed.`);
    setTimeout(() => showRenameModal(unicodeFiles), 800);
  }
}

// ── Rename Modal ──
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
      // Native file object — clone with new name, keep URI
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
    const item = document.createElement("div");
    item.className = "file-item";
    item.innerHTML = `
      <div class="file-name">
        <i class="fas fa-file" style="color:${wasRenamed ? '#555' : 'var(--success-green)'}"></i>
        <span>${file.name} ${wasRenamed ? '<small style="color:#888">(renamed)</small>' : ''}</span>
      </div>
      <div class="file-size">${formatFileSize(file.size)}</div>`;
    selectedFiles.appendChild(item);
  });
  uploadBtn.disabled = filesToUpload.length === 0;
}

// ── Progress Circle ──
function updateProgress(percent) {
  const circumference = 2 * Math.PI * 45;
  progressFill.style.strokeDashoffset = circumference - (percent / 100) * circumference;
  progressText.textContent = `${Math.round(percent)}%`;
}

// ── Read file content (supports both browser File and native URI objects) ──
async function readFileAsBase64(file) {
  if (file.isNative) {
    // Native Android file — fetch via the content:// URI exposed by the WebView
    const response = await fetch(file.nativeUri);
    if (!response.ok) throw new Error(`Failed to read native file: ${file.name}`);
    const buffer = await response.arrayBuffer();
    const bytes  = new Uint8Array(buffer);
    let binary   = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  } else {
    // Standard browser File object
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result.split(',')[1]);
      reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
      reader.readAsDataURL(file);
    });
  }
}

// ── Main Upload Orchestrator ──
async function handleUpload() {
  if (!filesToUpload.length) return;

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
    uploadStatus.textContent = `Uploading ${file.name}...`;

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

// ── Formatters ──
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

// ── VPN Format Grid ──
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
