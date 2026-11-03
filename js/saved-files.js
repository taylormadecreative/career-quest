// The Python and font files Career Quest keeps on each laptop, with their sizes and SHA-256 fingerprints.
// One list, read by the page (which downloads and saves them), the service worker (which serves them
// with no Wi-Fi) and the Python worker (which checks them before use). A file is saved only when its
// fingerprint matches, so a web filter's page, a cut-off download or a damaged file never becomes
// "the saved copy". tests/rules.test.mjs checks this list against the real files.
// If you ever replace Pyodide or the fonts in site/vendor, update this list and bump `cache`.
self.CQ_SAVED = {
  cache: "cq-vendor-2",
  files: {
    "vendor/fonts/nunito-latin.woff2": { bytes: 39152, sha256: "20fc9b6fc618e7c3c68d3ac750a2a5dfbceb8521675458d2cea580b5693e4798" },
    "vendor/fonts/jetbrains-mono-latin.woff2": { bytes: 31340, sha256: "2c32b9b3ee358c119e210f6f5195f9bd34894d78a785ff2e95d60e718e400af4" },
    "vendor/pyodide/pyodide.js": { bytes: 17331, sha256: "24a458425dcb4ea9836eb5ce26701d18cb769374e2b79247602ba605bf093278" },
    "vendor/pyodide/pyodide-lock.json": { bytes: 109732, sha256: "f6e6f42f451f42affbbcddb00e8c9a3278dcbf399f57aab9f3f568839a7ff4a6" },
    "vendor/pyodide/pyodide.asm.js": { bytes: 1073033, sha256: "b22e5831eade9ff10e6fe2c811c68688cd91f10154377b4f80debcf5bafa1e56" },
    "vendor/pyodide/python_stdlib.zip": { bytes: 2416866, sha256: "71fee17f88a6260ec8c9c7c063533ee59c021fdc88a1ce76247378d3c4a35f4c" },
    "vendor/pyodide/pyodide.asm.wasm": { bytes: 8645967, sha256: "5effb6a1a6cc4a1a85bec4622701aa797c031e1de923cbbaf2ad47abdc4ab325" },
  },
};
