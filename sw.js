// Keeps a full copy of Career Quest on each laptop after one visit, so bad venue Wi-Fi can't stop it.
// VERSION is the one place to bump when the game changes.
const VERSION = "cq-v48";
// Python and the fonts never change between game versions, so they live in their own cache:
// bumping VERSION re-downloads the small game files, not the 12 MB Python runtime.
importScripts("js/saved-files.js");   // the Python and font files, with their fingerprints (self.CQ_SAVED)
const VENDOR = self.CQ_SAVED.cache;
const VENDOR_FILES = Object.keys(self.CQ_SAVED.files);
const CORE = [
  "./", "index.html", "css/game.css", "js/game.js", "js/content.js", "js/portfolio-export.js", "js/program.js", "js/buildings.js", "js/rules.js",
  "js/python-worker.js", "js/saved-files.js", "data/jobs-2023.json", "data/fictional-offline-demo.json",
];

// Install saves only the small game files (about 250 KB). The 12 MB of Python is saved by the page itself
// (game.js savePython), because Chrome cuts a service worker step off after 5 minutes, and a first download
// on slow venue Wi-Fi can take longer than that.
self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const core = await caches.open(VERSION);
    for (let i = 0; i < 3; i++) { try { await core.addAll(CORE.map((u) => new Request(u, { cache: "reload" }))); break; } catch (err) { if (i === 2) throw err; } }
    // The first install takes over right away. An update waits until the game is next opened,
    // so a game that's already running never mixes old and new files.
    if (!self.registration.active) await self.skipWaiting();
  })());
});

self.addEventListener("message", (e) => { if (e.data === "skip-waiting") self.skipWaiting(); });

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    // Only this game's own old caches: other sites on the same github.io address keep theirs.
    for (const k of await caches.keys()) if (k.startsWith("cq-") && k !== VERSION && k !== VENDOR) await caches.delete(k);
    await self.clients.claim();
    for (const client of await self.clients.matchAll()) client.postMessage("cached");
  })());
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  // The page's own "save Python on this laptop" downloads go straight to the network, with no time limit.
  if (url.searchParams.has("cq-save")) return;
  const stable = /\/(vendor|data)\//.test(url.pathname);
  // "Is this file reachable?" checks are answered from the saved copy, so they work with no Wi-Fi.
  if (e.request.method === "HEAD" && stable) {
    e.respondWith(caches.match(e.request.url, { ignoreMethod: true, ignoreSearch: true }).then((hit) => hit ? new Response(null, { status: hit.status, headers: hit.headers }) : fetch(e.request)));
    return;
  }
  if (e.request.method !== "GET") return;
  e.respondWith(stable ? cacheFirst(e) : savedCopy(e.request));
});

// Big files that never change between versions: the saved copy first. A missing one is passed on as it
// downloads (a slow file isn't held back until the end) and saved in the background if it checks out.
async function cacheFirst(e) {
  const req = e.request;
  const hit = await caches.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) {
    const copy = res.clone();
    e.waitUntil((async () => {
      if (await realFile(req.url, copy.clone())) await (await caches.open(new URL(req.url).pathname.includes("/vendor/") ? VENDOR : VERSION)).put(req, copy);
    })().catch(() => {}));
  }
  return res;
}
// A web filter's "blocked" page must never be saved as a game file: no HTML where a Python, font or
// data file belongs, and the WebAssembly file must start with its signature bytes (00 61 73 6d).
async function realFile(url, res) {
  if (!res.ok || /text\/html/i.test(res.headers.get("content-type") || "")) return false;
  let key;
  try { const path = new URL(url, self.location.href).pathname; key = VENDOR_FILES.find((k) => path.endsWith("/" + k)); } catch { return false; }
  if (!key) return true;
  try {
    const hash = await crypto.subtle.digest("SHA-256", await res.arrayBuffer());
    return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("") === self.CQ_SAVED.files[key].sha256;
  } catch { return false; }
}
// The game's own code: always this version's saved copy, so a game that's running never mixes files
// from two versions. It's fetched only if it's missing. Bumping VERSION ships a full fresh copy.
async function savedCopy(req) {
  const cache = await caches.open(VERSION);
  const saved = (await cache.match(req)) || (await cache.match(req, { ignoreSearch: true })) || (req.mode === "navigate" ? await cache.match("index.html") : undefined);
  if (saved) return saved;
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return req.mode === "navigate" ? (await caches.match("index.html")) || Response.error() : Response.error();
  }
}
