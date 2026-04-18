/**
 * onNativeFilesSelected — Site-side JS bridge for Android native file picker
 *
 * Add this snippet to your uploader page (uploader.html) BEFORE uploader.js loads.
 *
 * When a user on the Android app taps the upload/browse button, the app opens
 * the native file picker instead of the browser's <input type="file">.
 * Once files are selected, the app calls window.onNativeFilesSelected(filesArray)
 * with an array of { name, uri, size } objects.
 *
 * This function converts that array into a synthetic FileList-like structure
 * and triggers the same handleFileSelect() flow that uploader.js already uses.
 *
 * Usage: <script src="onNativeFilesSelected.js"></script>  ← before uploader.js
 */

window.onNativeFilesSelected = function (nativeFiles) {
  if (!nativeFiles || nativeFiles.length === 0) {
    // User cancelled the native picker — do nothing
    return;
  }

  // Build synthetic File objects from the native file metadata.
  // We can't reconstruct actual File blobs from URIs in the WebView
  // without a backend round-trip, so we hand the metadata to the uploader
  // and let uploaderapi.js fetch the actual bytes via the Android bridge.
  const syntheticFiles = nativeFiles.map(function (f) {
    return {
      name:         f.name,
      size:         f.size,
      nativeUri:    f.uri,    // Android content:// URI — used by uploaderapi.js
      isNative:     true      // flag so uploaderapi.js knows to use the bridge
    };
  });

  // Inject the synthetic files into the uploader's state
  // uploader.js exposes handleNativeFiles() for exactly this purpose.
  // If your uploader.js does not yet have that function, add the following
  // to the bottom of uploader.js:
  //
  //   window.handleNativeFiles = function(files) {
  //     filesToUpload = files;
  //     // ... render them in selectedFiles UI as normal
  //   };
  //
  if (typeof window.handleNativeFiles === 'function') {
    window.handleNativeFiles(syntheticFiles);
  } else {
    console.warn('[ConfigHub Android] onNativeFilesSelected: ' +
      'window.handleNativeFiles is not defined in uploader.js. ' +
      'Add it to receive native file selections.');
  }
};
