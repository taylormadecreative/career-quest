import { CAREERS, SKILL_CHOICES, BUILDINGS, CHALLENGES, prettySkill, dataWords, cleanTitle } from "./content.js";
import { portfolioHtml, pythonFile, download, tiedOut, normalizeUrl, storyOf, chartOrder } from "./portfolio-export.js";
import { program } from "./program.js";
import { buildingSvg, sceneHtml } from "./buildings.js";
import { check, friendlyError, ranked, flippedCounts, followsFlip, followsRole } from "./rules.js";
import "./saved-files.js";   // sets self.CQ_SAVED: the Python and font files kept on this laptop

/* ---------- tiny helpers ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (s) => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>");
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const singleColumn = () => matchMedia("(max-width: 980px)").matches;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const EASE = "cubic-bezier(0.23, 1, 0.32, 1)";
const MAX_POINTS = CHALLENGES.reduce((a, c) => a + c.points, 0);
const PHASES = ["career", "data", "challenge", "unlocked", "finish", "showcase"];
const EXAMPLE_PROOF = "I organized our club's budget spreadsheet and explained it to the team.";
const EXAMPLE_HEADLINE = "Psychology major who turns survey data into stories";
const squash = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, "");
// The backup laptop serves the game over plain http on the room's network; a stuck student there gets help, not "the backup".
const ON_BACKUP = location.protocol === "http:" && !["localhost", "127.0.0.1"].includes(location.hostname);
const HELP_NEXT = ON_BACKUP ? "Raise your hand: a helper can unlock this step with you." : "Raise your hand: a helper can switch you to the backup.";
const SW_OK = "serviceWorker" in navigator && (location.protocol === "https:" || ["localhost", "127.0.0.1"].includes(location.hostname));

/* ---------- state (saved on this laptop) ---------- */
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
  remove(k) { try { localStorage.removeItem(k); } catch {} },
};
const STORE = "career-quest.v1";
const fresh = () => ({
  playerId: "", displayName: "", headline: "", role: "", skills: [], experience: "", linkedin: "", github: "",
  prediction: "", screen: "title", level: 1, phase: "career", returnPhase: "",
  lines: {}, solved: {}, helped: {}, results: {}, explains: {}, hintsUsed: { 1: 0, 2: 0, 3: 0 }, fails: { 1: 0, 2: 0, 3: 0 },
  nextStep: "", built: "", builtSaved: false, selected: "summary", dataMode: "",
});
function loadState() {
  let s = null;
  try { s = JSON.parse(store.get(STORE)); } catch {}
  const f = fresh();
  if (!s || typeof s !== "object" || Array.isArray(s)) return f;
  const out = { ...f, ...s };
  for (const k of ["lines", "solved", "helped", "results", "explains", "hintsUsed", "fails"])
    if (!out[k] || typeof out[k] !== "object" || Array.isArray(out[k])) out[k] = f[k];
  for (const k of ["playerId", "displayName", "headline", "role", "experience", "linkedin", "github", "prediction", "nextStep", "built", "dataMode", "returnPhase", "selected"])
    if (typeof out[k] !== "string") out[k] = f[k];
  out.skills = Array.isArray(out.skills) ? out.skills.filter((x) => typeof x === "string") : [];
  for (const k of ["hintsUsed", "fails"]) for (const [kk, v] of Object.entries(out[k])) if (!Number.isInteger(v) || v < 0) delete out[k][kk]; else if (k === "hintsUsed" && v > 3) out[k][kk] = 3;
  if (out.role && !CAREERS.some((c) => c.id === out.role)) Object.assign(out, { role: "", solved: {}, helped: {}, results: {}, phase: "career" });
  if (![1, 2, 3].includes(out.level)) out.level = 1;
  if (!PHASES.includes(out.phase)) out.phase = "career";
  const isStr = (x) => typeof x === "string", isNum = Number.isFinite;
  const okResult = {
    1: (r) => isNum(r?.n) && Array.isArray(r.titles) && r.titles.every(isStr),
    2: (r) => Array.isArray(r?.ranked) && r.ranked.length > 0 && isNum(r.n) && r.ranked.every((p) => Array.isArray(p) && isStr(p[0]) && isNum(p[1])),
    3: (r) => Array.isArray(r?.top) && Array.isArray(r.counts) && r.top.length === r.counts.length && r.top.every(isStr) && r.counts.every(isNum),
  };
  for (const l of [1, 2, 3]) if (out.results[l] && !okResult[l](out.results[l])) delete out.results[l];
  // A level whose saved result is unusable reopens, with the levels built on it; earlier levels stay solved.
  for (const l of [1, 2, 3]) if (out.solved[l] && !out.results[l]) { for (const k of [1, 2, 3]) if (k >= l) { delete out.solved[k]; delete out.results[k]; delete out.helped[k]; } break; }
  if (out.playerId && !/^(P(0[1-9]|[12]\d|30)|DEMO)$/.test(out.playerId)) return f;
  for (const k of ["lines", "explains"]) for (const [kk, v] of Object.entries(out[k])) if (typeof v !== "string") delete out[k][kk];
  // Solved steps must line up: each has its line (or was helped), and none skips the one before it.
  for (const l of [1, 2, 3]) if (out.solved[l] && !out.helped[l] && typeof out.lines[l] !== "string") { delete out.solved[l]; delete out.results[l]; }
  for (const l of [2, 3]) if (out.solved[l] && !out.solved[l - 1]) { delete out.solved[l]; delete out.results[l]; delete out.helped[l]; }
  const open = [1, 2, 3].find((l) => !out.solved[l]);
  if (!out.role && !["career"].includes(out.phase)) out.phase = "career";
  else if (open && (out.level > open || ["finish", "showcase"].includes(out.phase))) Object.assign(out, { level: open, phase: "challenge" });
  if (out.phase === "unlocked" && !out.results[out.level]) out.phase = "challenge";
  if (out.phase === "challenge" && out.solved[out.level]) out.phase = "unlocked"; // a solved level never reopens for points
  if (out.phase === "showcase" && !out.builtSaved) out.phase = "finish";
  if (!BUILDINGS.some((b) => b.key === out.selected)) out.selected = "summary";
  return out;
}
let state = loadState();
let saveWarned = false, paused = false;
function save() {
  if (paused) return;
  if (!store.set(STORE, JSON.stringify(state)) && !saveWarned) { saveWarned = true; const n = $("#save-note"); if (n) n.hidden = false; }
}
const points = () => CHALLENGES.reduce((a, c) => a + (state.solved[c.level] && !state.helped[c.level] ? c.points : 0), 0);

/* ---------- data ---------- */
let DATA = null;
const dataReady = (async () => {
  const once = async (url) => { const r = await fetch(url); if (!r.ok) throw new Error(r.status); return r.json(); };
  const get = async (url) => { for (let i = 0; ; i++) { try { return await once(url); } catch (e) { if (i >= 2) throw e; await wait(800 * (i + 1)); } } };
  const keepPractice = store.get("career-quest.data") === "practice";
  try { if (keepPractice) throw new Error("practice"); DATA = { ...(await get("data/jobs-2023.json")), mode: "real" }; }
  catch { try { DATA = { ...(await get("data/fictional-offline-demo.json")), mode: "fictional" }; } catch { DATA = null; } }
  if (DATA) { DATA.byRole = {}; for (const j of DATA.jobs) (DATA.byRole[j.role] ||= []).push(j); }
  return DATA;
})();
const words = () => dataWords(state.dataMode || DATA?.mode);
const altRoles = () => CAREERS.map((c) => c.id).filter((r) => r !== state.role && DATA.byRole[r]?.length);
const altRole = () => altRoles()[0];
// Saved results came from one data set, but this laptop loaded the other: never mix them.
const dataMismatch = () => !!(DATA && state.dataMode && state.dataMode !== DATA.mode && Object.keys(state.results).length);

/* ---------- Python (Pyodide in a worker: load timeout, retries, restarts after a crash) ---------- */
const py = {
  worker: null, status: "idle", seq: 0, pending: new Map(), listeners: new Set(), attempts: 0, timers: {},
  set(s) { this.status = s; this.listeners.forEach((f) => f(s)); },
  clear() { Object.values(this.timers).forEach(clearTimeout); this.timers = {}; },
  start() {
    this.clear();
    this.worker?.terminate();
    for (const cb of this.pending.values()) cb({ ok: false, kind: "setup" });
    this.pending.clear();
    this.set("loading");
    this.timers.slow = setTimeout(() => { if (this.status === "loading") this.set("slow"); }, 10000);
    // From the saved copy Python starts in a few seconds (40 s is plenty). A download straight from the network
    // can be slow but steady: it only counts as stuck after 90 seconds with no new bytes at all.
    const limit = () => {
      clearTimeout(this.timers.limit);
      this.timers.limit = setTimeout(() => { if (["loading", "slow"].includes(this.status)) { this.worker?.terminate(); this.fail(); } }, this.cached ? 40000 : 90000);
    };
    limit();
    this.worker = new Worker("js/python-worker.js");
    this.worker.onmessage = (e) => {
      const m = e.data;
      if (m.type === "bytes") { this.lastBytes = Date.now(); if (!this.cached) limit(); }
      else if (m.type === "ready") { this.clear(); this.attempts = 0; this.set("ready"); }
      else if (m.type === "result") { const p = this.pending.get(m.id); if (p && m.token === p.token) { p(m.data); this.pending.delete(m.id); } }
      else if (m.type === "fatal") {
        if (m.id != null && this.pending.has(m.id)) { this.pending.get(m.id)({ ok: false, kind: "setup" }); this.pending.delete(m.id); this.start(); return; }
        if (this.status === "ready") return;
        if (/no-wasm/.test(m.error || "")) { this.noWasm = true; this.attempts = 3; }
        const bad = (m.error || "").match(/bad-file(?::([\w.-]+))?/), offline = navigator.onLine === false;
        if (bad && !offline) { this.badFile = this.cached ? "saved" : "download"; forgetSavedPython(bad[1]); }
        if (/cut-off/.test(m.error || "") || (bad && offline)) this.cutOff = true;
        this.worker?.terminate(); this.fail();
      }
    };
    this.worker.onerror = (e) => { e.preventDefault?.(); this.fail(); };
    const jobs = DATA.jobs.map(({ id, role, title, schedule, skills }) => ({ id, role, title, schedule, skills }));
    const viaSW = (() => { try { return !!navigator.serviceWorker?.controller; } catch { return false; } })();
    this.worker.postMessage({ type: "init", jobsJson: JSON.stringify(jobs), verify: !!this.cached || viaSW });
  },
  fail() {
    if (this.status === "failed") return;
    this.clear();
    this.attempts++;
    this.set("failed");
    if (this.attempts <= 2) this.timers.retry = setTimeout(() => this.start(), [3000, 8000][this.attempts - 1]);   // quick retries; Try again re-runs the downloader
  },
  retryNow() { this.attempts = 0; this.blocked = false; this.badFile = false; this.cutOff = false; resumePython(); },
  get autoRetrying() { return this.status === "failed" && this.attempts <= 2; },
  run(src) {
    const id = ++this.seq;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        resolve({ ok: false, kind: "timeout" });
        this.start(); // a stuck loop gets a fresh Python
      }, 8000);
      const token = crypto.getRandomValues(new Uint32Array(4)).join("-");
      const done = (d) => { clearTimeout(timer); resolve(d); };
      done.token = token;
      this.pending.set(id, done);
      this.worker.postMessage({ type: "run", id, src, token });
    });
  },
};
// Python and the fonts are saved on this laptop the first time (list and fingerprints: js/saved-files.js).
const SAVED = self.CQ_SAVED;
const VENDOR_FILES = Object.keys(SAVED.files);
const SAVED_BYTES = Object.values(SAVED.files).reduce((a, f) => a + f.bytes, 0);
// A saved Python file that won't start is deleted, so the next try downloads a fresh copy.
async function forgetSavedPython(name) {
  const which = VENDOR_FILES.filter((f) => f.includes("pyodide") && (!name || f.endsWith("/" + name)));
  try { for (const k of await caches.keys()) if (k.startsWith("cq-vendor")) { const c = await caches.open(k); for (const u of which) await c.delete(u); } } catch {}
  py.cached = false; const n = $("#offline-note"); if (n) n.hidden = true;
}
const progressText = () => py.progress ? `Downloading Python: ${(py.progress.got / 1e6).toFixed(1)} of ${(py.progress.total / 1e6).toFixed(1)} MB.${py.progress.waiting ? " The Wi-Fi dropped; it picks up again on its own." : ""}` : "";
// Wait a while, or less if the laptop reconnects to the Wi-Fi first.
const napOrOnline = (ms) => new Promise((r) => { const done = () => { clearTimeout(t); removeEventListener("online", done); r(); }; const t = setTimeout(done, ms); addEventListener("online", done); });
async function allSaved() {
  try { return (await Promise.all(VENDOR_FILES.map((u) => caches.match(u)))).every(Boolean); } catch { return false; }
}
// Download one file and save it only if its fingerprint matches. Slow Wi-Fi is fine: the clock only runs out
// when no new bytes arrive for 45 seconds. Returns "ok", "cut" (worth another try) or "bad" (a filter or a wrong file).
async function saveFile(cache, u, onBytes, fresh = false, stallMs = 45000) {
  const stop = new AbortController();
  let timer = setTimeout(() => stop.abort(), stallMs), mine = 0;
  try {
    // ?cq-save: the service worker lets it through. The browser's own copy is used if it has one (the fonts the page
    // just loaded, say), so nothing downloads twice; a copy that fails its fingerprint is fetched fresh.
    const res = await fetch(`${u}?cq-save`, { cache: fresh ? "reload" : "default", signal: stop.signal });
    if (!res.ok || !res.body || /text\/html/i.test(res.headers.get("content-type") || "")) return "bad";
    const reader = res.body.getReader(), parts = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      clearTimeout(timer); timer = setTimeout(() => stop.abort(), stallMs);
      parts.push(value); mine += value.length; onBytes(value.length);
    }
    const blob = new Blob(parts);
    const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()))].map((b) => b.toString(16).padStart(2, "0")).join("");
    if (hash !== SAVED.files[u].sha256) { onBytes(-mine); return "bad"; }
    await cache.put(u, new Response(blob, { headers: { "content-type": res.headers.get("content-type") || "application/octet-stream" } }));
    return "ok";
  } catch { onBytes(-mine); return "cut"; }
  finally { clearTimeout(timer); }
}
// Two tabs: only one downloads (a Web Lock); the other shows the same progress while it waits its turn.
const progressChannel = "BroadcastChannel" in self ? new BroadcastChannel("career-quest-progress") : null;
if (progressChannel) progressChannel.onmessage = (e) => {
  if (py.status !== "saving" || py.savingHere) return;
  py.progress = { ...e.data, at: Date.now() };
  const el = $(".fb-progress"); if (el) el.textContent = progressText();
};
// First visit: the page downloads the 12 MB itself, one file at a time, with a live "4.1 of 12.3 MB" line.
// (The service worker can't: Chrome stops its install step after 5 minutes, and slow venue Wi-Fi can take longer.)
// A filter or a wrong file stops the saving at once, so the student hears about it in seconds, not minutes.
async function savePython() {
  py.savingHere = true;
  try { await saveMissing(); } finally { py.savingHere = false; }
}
async function saveMissing() {
  const cache = await caches.open(SAVED.cache);
  const missing = [];
  let got = 0, told = 0, lastByte = Date.now(), waiting = false;
  for (const u of VENDOR_FILES) if (await cache.match(u)) got += SAVED.files[u].bytes; else missing.push(u);
  const tell = (force) => {
    py.progress = { got: Math.min(got, SAVED_BYTES), total: SAVED_BYTES, at: lastByte, waiting };
    progressChannel?.postMessage(py.progress);
    if (!force && Date.now() - told < 700) return;
    told = Date.now(); const el = $(".fb-progress"); if (el) el.textContent = progressText();
  };
  if (missing.length) tell(true);
  try {
    for (const u of missing) {
      let how, tries = 0, best = 0, strikes = 0;
      for (;;) {
        let mine = 0;
        how = await saveFile(cache, u, (n) => { got += n; if (n > 0) { lastByte = Date.now(); mine += n; } tell(); }, tries > 0);
        if (how === "bad" && !tries++) continue;   // maybe just a stale browser copy: one fresh try before calling it a filter
        if (how !== "cut") break;
        // A Wi-Fi drop or stall: wait a little longer each time (or until the laptop reconnects), then pick up again.
        // It ends after 3 minutes with no new bytes at all, or when the file keeps breaking off no further than before
        // (a proxy or filter, not a passing drop). Then the student sees what happened and can get help.
        if (mine > best) { best = mine; strikes = 0; } else if (mine > 0 && ++strikes >= 3) break;
        if (Date.now() - lastByte > 180000) break;
        waiting = true; tell(true);
        await napOrOnline([2000, 5000, 15000, 30000][Math.min(tries++, 3)]);
        waiting = false; tell(true);
      }
      if (how !== "ok") return;
    }
  } finally { py.progress = null; py.savedAt = Date.now(); }
}
let swReg = null;
try { if (SW_OK) swReg = navigator.serviceWorker.register("sw.js"); } catch { swReg = null; }
async function pythonReachable() {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 15000);
  try { const r = await fetch("vendor/pyodide/pyodide.asm.wasm", { method: "HEAD", signal: ctl.signal }); r.body?.cancel?.(); return r.ok ? "ok" : "blocked"; }
  catch (e) { return e.name === "AbortError" ? "slow" : "unreachable"; }   // no connection: a Wi-Fi drop, not a filter
  finally { clearTimeout(t); }
}
async function startPython() {
  if (py.status !== "idle") return;
  py.startedAt = Date.now();
  // Slow Wi-Fi: after 3 minutes (or 90 s with no new bytes) a student can choose help instead of waiting.
  const helpCheck = setInterval(() => {
    if (py.status === "ready") return clearInterval(helpCheck);
    const quiet = Date.now() - Math.max(py.progress?.at || 0, py.lastBytes || 0, py.savedAt || 0, py.startedAt);
    if (!py.offerHelp && (Date.now() - py.startedAt > 180000 || quiet > 90000)) { py.offerHelp = true; py.listeners.forEach((f) => f(py.status)); }
  }, 5000);
  // A browser that can't run WebAssembly can't run Python: say so now, not after a 12 MB download.
  if (typeof WebAssembly !== "object") { py.noWasm = true; py.attempts = 3; py.set("failed"); return; }
  await resumePython();
}
// Load Python, first saving any missing files on this laptop. Also used by the automatic retries and Try again,
// so a laptop whose download broke off picks it up again instead of starting a second, unsaved one.
async function resumePython() {
  if (py.resuming) return;
  py.resuming = true;
  try {
    py.clear();
    await loadPython();
  } finally { py.resuming = false; }
}
// Back on the Wi-Fi after a drop broke the download: pick up again without waiting for a click.
addEventListener("online", () => { if (py.status === "failed" && py.cutOff) py.retryNow(); });
async function loadPython() {
  py.set("checking");
  const reg = swReg ? await swReg.catch(() => null) : null;   // no service worker (blocked, or plain http): Python loads straight from the network
  if (reg && !(await allSaved())) {
    py.set("saving");
    // One tab saves at a time; a second tab finds the files already saved when its turn comes.
    await (navigator.locks?.request ? navigator.locks.request("cq-save-python", savePython) : savePython()).catch(() => {});
  }
  // On a first visit, Python then loads through the service worker once it takes over this page, which it does
  // as soon as the small game files are saved (usually long before Python is).
  const sw = navigator.serviceWorker;
  if (reg && !sw.controller && (reg.installing || reg.waiting || reg.active?.state === "activating")) await new Promise((done) => {
    sw.addEventListener("controllerchange", done, { once: true });
    const w = reg.installing || reg.waiting || reg.active;
    w.addEventListener("statechange", () => w.state === "redundant" && done());
    setTimeout(done, 60000);
  });
  py.cached = !!sw?.controller && (await allSaved());
  // Only check the network when Python isn't already saved on this laptop: a saved laptop starts offline.
  if (!py.cached && (await pythonReachable()) === "blocked") { py.blocked = true; py.attempts = 3; py.set("failed"); return; }
  py.start();
}

/* ---------- the student's program ---------- */
const compose = (level, override, role, countsOverride, extraJobs) => program(state, DATA.jobs, level, { override, role, countsOverride, extraJobs });
// Made-up postings whose role only looks like the student's career. A correct filter keeps none of them.
const lookAlikes = (role) => [`${role} II`, `Senior ${role}`, `${role.slice(0, -1)}z`, role.split(" ").pop(), role.split(" ").reverse().join(" "), `X${role.slice(1)}`]
  .map((r, i) => ({ id: -1 - i, role: r, title: r, schedule: "Full-time", skills: [] }));
const EDIT_LINE = { 1: 3, 2: 4, 3: 2 };

/* ---------- checking behavior, not exact text (rules.js) ---------- */
const expectedCounts = () => {
  const c = {};
  for (const j of DATA.byRole[state.role] || []) for (const s of j.skills) c[s] = (c[s] || 0) + 1;
  return c;
};
const checkNow = (level, rep) => check(level, rep, {
  role: state.role, mine: (DATA.byRole[state.role] || []).length, total: DATA.jobs.length,
  expected: expectedCounts(), counts: Object.fromEntries(state.results[2]?.ranked || []),
});

/* ---------- syntax coloring for display-only lines ---------- */
const KW = /\b(for|in|if|else|import|print|sorted|True|False|None|key|reverse)\b/g;
function hl(code) {
  return code.split(/("(?:[^"\\]|\\.)*"|\b\d+\b|#.*$)/).map((part) => {
    if (!part) return "";
    if (part.startsWith('"')) return `<span class="t-str">${esc(part)}</span>`;
    if (/^\d+$/.test(part)) return `<span class="t-num">${part}</span>`;
    if (part.startsWith("#")) return `<span class="t-com">${esc(part)}</span>`;
    return esc(part).replace(KW, '<span class="t-kw">$1</span>');
  }).join("");
}

/* ---------- announcer + toasts ---------- */
function announce(msg) {
  const a = $("#announcer");
  a.textContent = "";
  setTimeout(() => (a.textContent = msg), 60);
}
function toast(msg) {
  const r = $("#toasts");
  const t = Object.assign(document.createElement("div"), { className: "toast", textContent: msg });
  r.append(t);
  setTimeout(() => { t.classList.add("is-out"); setTimeout(() => t.remove(), 200); }, 3600);
}

/* ---------- the island (portfolio city) ---------- */
function buildingState(key) {
  return {
    summary: state.role ? "open" : "locked",
    explorer: state.solved[1] ? "open" : "locked",
    chart: state.solved[2] ? "open" : "locked",
    strategy: state.solved[3] ? "open" : "locked",
    built: state.builtSaved ? "open" : "locked",
  }[key];
}
const bldgInner = (b, st) => `<span class="b-glow" aria-hidden="true"></span><span class="b-art">${buildingSvg(b.key, { locked: st === "locked" })}</span><span class="b-sign">${esc(b.short)}</span>`;
function renderIsland({ focus, hold } = {}) {
  const isl = $("#island");
  isl.innerHTML = BUILDINGS.map((b) => {
    const st = b.key === hold ? "locked" : buildingState(b.key);
    return `<button class="bldg b-${b.key}" type="button" data-key="${b.key}" data-state="${st}" aria-pressed="${state.selected === b.key}" aria-controls="detail"
      aria-label="${esc(b.short)}: ${esc(b.label)}${st === "locked" ? ", locked" : ""}">${bldgInner(b, st)}</button>`;
  }).join("");
  $$(".bldg", isl).forEach((el) => el.addEventListener("click", () => {
    state.selected = el.dataset.key; save(); renderIsland({ focus: el.dataset.key }); renderDetail();
    announce(`${$("#detail").innerText.replace(/\s+/g, " ").slice(0, 220)}`);
  }));
  if (focus) $(`.bldg[data-key="${focus}"]`)?.focus();
  $("#p-name").textContent = state.displayName?.trim() || (state.playerId ? `Player ${state.playerId}` : "Your portfolio");
  $("#p-role").textContent = state.role ? `Future ${state.role}` : "Pick a career to start your city";
}

// The info card under the city fades at the bottom only when there's more to scroll to.
function fadeDetail() {
  const el = $("#detail"); if (!el) return;
  el.classList.toggle("can-scroll", el.scrollHeight > el.clientHeight + 2);
  el.classList.toggle("at-end", el.scrollTop + el.clientHeight >= el.scrollHeight - 2);
}
function renderDetail() {
  const key = state.selected;
  const b = BUILDINGS.find((x) => x.key === key);
  const st = buildingState(key);
  const el = $("#detail");
  const lockedMsg = {
    summary: "Pick a career to raise your first building.",
    explorer: "Fix the Filter bug to raise this building.",
    chart: "Fix the Count bug to raise this building.",
    strategy: "Fix the Rank bug to raise this building.",
    built: "Tell your story at the end to raise this building.",
  }[key];
  const helpedNote = (lvl) => (state.helped[lvl] ? `<p class="d-muted">Completed with a helper.</p>` : "");
  let body = "";
  if (st === "locked") body = `<p class="d-locked"><span class="d-lock" aria-hidden="true"></span><span>${lockedMsg}</span></p>`;
  else if (key === "summary") {
    body = `${state.skills.length ? `<p class="chips">${state.skills.map((s) => `<span class="chip chip-static">${esc(s)}</span>`).join("")}</p>` : ""}
      ${state.experience.trim() ? `<p class="d-quote">${esc(state.experience.trim())}</p>` : `<p class="d-muted">Add one real thing you did. It becomes the proof on your portfolio.</p>`}
      ${!["career", "showcase"].includes(state.phase) ? `<button type="button" class="btn-text" id="edit-profile">Edit my profile</button>` : ""}`;
  } else if (key === "explorer") {
    const r = state.results[1];
    body = `<p class="d-big"><strong>${r.n}</strong> ${esc(state.role)} postings</p>
      <ul class="d-titles">${[...new Set(r.titles.map(cleanTitle))].slice(0, 3).map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
      ${helpedNote(1)}<p class="d-muted">${esc(words().source)}</p>`;
  } else if (key === "chart") body = chartHtml({ ...state.results[2], ranked: chartOrder(state) }, 5) + helpedNote(2);
  else if (key === "strategy") {
    const r = state.results[3];
    const ties = tiedOut(state);
    const who = state.helped[2] || state.helped[3] ? "The code" : "Your code";
    const tiedTop = r.top.filter((s, i) => r.counts[i] === r.counts[0]);
    const names = tiedTop.map(prettySkill);
    const found = tiedTop.length > 2 ? `a ${tiedTop.length}-way tie: ${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : tiedTop.length > 1 ? `a tie between ${names.join(" and ")}` : prettySkill(r.top[0]);
    const pred = state.prediction ? (tiedTop.length === 1 && r.top[0] === state.prediction ? `You predicted ${prettySkill(state.prediction)}. ${who} agrees.` : `You predicted ${prettySkill(state.prediction)}. ${who} found ${found}.`) : "";
    body = `<ol class="d-top">${r.top.map((s, i) => `<li><span class="rank">${i + 1}</span>${esc(prettySkill(s))}<span class="d-muted"> ${r.counts[i]} postings</span></li>`).join("")}</ol>
      ${ties.length ? `<p class="d-muted">Tied with number 3: ${ties.map((s) => esc(prettySkill(s))).join(", ")}.</p>` : ""}
      ${pred ? `<p class="d-muted">${esc(pred)}</p>` : ""}${helpedNote(3)}
      ${state.nextStep.trim() ? `<p><strong>My next step:</strong> ${esc(state.nextStep.trim())}</p>` : ""}`;
  } else if (key === "built") body = `<p class="d-quote">${esc(storyOf(state))}</p>`;
  el.innerHTML = `<h3 id="detail-h">${esc(b.label)}</h3>${body}`;
  el.scrollTop = 0; requestAnimationFrame(fadeDetail);
  $("#edit-profile")?.addEventListener("click", () => {
    state.returnPhase = state.phase; state.phase = "career"; save(); renderLeft(); $("#left h1")?.focus();
  });
}

function chartHtml(r, max) {
  const rows = r.ranked.slice(0, max);
  return `<table class="chart" aria-label="How many of your ${r.n} postings mention each skill"><tbody>
    ${rows.map(([s, c]) => `<tr><th scope="row">${esc(prettySkill(s))}</th><td><span class="cbar" style="--w:${(c / r.n) * 100}%"></span></td><td class="cnum">${c}</td></tr>`).join("")}
  </tbody></table><p class="d-muted">Out of ${r.n} ${esc(state.role)} postings, ${esc(words().sample)}. ${esc(words().source)}</p>`;
}

/* ---------- HUD ---------- */
const CHECK = `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const NOW = `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 4l9 6-9 6z" fill="currentColor"/></svg>`;
const HELPED = `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="3 3"/></svg>`;
function renderHud() {
  $("#hud").hidden = state.screen === "title";
  $("#hud-player").textContent = state.playerId || "";
  $("#hud-points").textContent = points();
  $("#btn-draft").textContent = state.builtSaved && state.phase === "showcase" ? "Download portfolio" : "Download draft";
  $("#hud-path").innerHTML = CHALLENGES.map((c) => {
    const s = state.solved[c.level] ? "done" : state.phase === "challenge" && state.level === c.level ? "current" : "todo";
    const sr = s === "done" ? (state.helped[c.level] ? ", done with a helper" : ", done") : s === "current" ? ", current level" : "";
    const helped = s === "done" && state.helped[c.level];
    return `<li data-s="${helped ? "helped" : s}">${helped ? HELPED : s === "done" ? CHECK : s === "current" ? NOW : ""}${c.step}${helped ? `<span class="path-tag" aria-hidden="true">help</span>` : ""}<span class="sr-only">${sr}</span></li>`;
  }).join("");
}
function tickPoints(from, to) {
  const el = $("#hud-points");
  if (reduceMotion() || from === to) { el.textContent = to; return; }
  const t0 = performance.now(), d = 700;
  const step = (t) => {
    const p = Math.min(1, (t - t0) / d), e = 1 - Math.pow(1 - p, 4);
    el.textContent = Math.round(from + (to - from) * e);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  $("#hud-score").animate([{ transform: "scale(1)" }, { transform: "scale(1.12)" }, { transform: "scale(1)" }], { duration: 500, easing: EASE });
}

/* ---------- screens ---------- */
// Scroll the panel so `el` sits fully below the pinned code area, or starts right under it if it's too tall.
// The pinned code area can grow a moment after a reveal (a help button arrives in it): reveal again then.
let lastReveal = null;
function reveal(el, again = false, until = null) {
  if (!again) lastReveal = { el, until, at: Date.now() };
  const left = $("#left"), w = $(".work"), smooth = reduceMotion() ? "auto" : "smooth";
  if (!w || getComputedStyle(w).position !== "sticky") return (until || el).scrollIntoView({ block: "nearest", behavior: smooth });
  const L = left.getBoundingClientRect(), a = el.getBoundingClientRect(), b = until?.getBoundingClientRect();
  const r = b && b.height ? { top: a.top, height: Math.max(a.bottom, b.bottom) - a.top } : a;
  // Where the pinned area ends, measured from the panel's top edge: sticky offsets count from inside the panel's padding.
  const pinned = left.clientTop + parseFloat(getComputedStyle(left).paddingTop) + parseFloat(getComputedStyle(w).top) + w.offsetHeight + 8;
  const room = left.clientHeight - pinned - 8;
  const y = r.top - L.top + left.scrollTop;                                    // el's top in panel content
  const showTop = y - pinned, showBottom = y + r.height - left.clientHeight + 8;
  const now = left.scrollTop;
  const target = r.height > room ? showTop : now < showBottom ? showBottom : now > showTop ? showTop : now;
  if (Math.abs(target - now) > 1) left.scrollTo({ top: target, behavior: smooth });
}
let workRO = null;
function watchWork() {
  workRO?.disconnect();
  const w = $(".work"), left = $("#left");
  if (!w || !("ResizeObserver" in window)) return;
  workRO = new ResizeObserver(() => {
    left.style.setProperty("--work-h", `${Math.ceil(w.getBoundingClientRect().height)}px`);
    if (lastReveal?.el.isConnected && Date.now() - lastReveal.at < 1500) reveal(lastReveal.el, true, lastReveal.until);
  });
  workRO.observe(w);
}
function show(screen) {
  state.screen = screen; save();
  document.body.dataset.screen = screen;
  if (screen === "title") document.title = "Career Quest: Code Your Next Move";
  $$(".screen").forEach((s) => (s.hidden = s.id !== `screen-${screen}`));
  renderHud();
}

function renderTitle() {
  const has = !!(state.playerId && state.role);
  $("#title-new").textContent = `Not ${state.playerId || "you"}? Use a different ID`;
  $(".title-form").hidden = has;
  $("#title-continue").hidden = !has;
  if (has) $("#title-continue-btn").textContent = `Continue as ${state.playerId}`;
  $("#start-btn").className = has ? "btn btn-ghost btn-big" : "btn btn-go btn-big";
  $("#player-id-lbl").textContent = has ? "Not you? Type your player ID" : "Your player ID";
  $("#player-id").value = has ? "" : state.playerId || "";
  $("#title-new").hidden = false;
  // DEMO is for trying the game (helpers, Jamal, visitors): it can start over. Real player IDs can't be erased from here.
  const restart = $("#title-restart"); restart.hidden = !(has && state.playerId === "DEMO"); disarm(restart);
  $("#player-id-err").hidden = true;
}
// Two-step confirm for anything that erases progress (no pop-up dialogs).
function arm(btn, label) {
  if (btn.dataset.armed === "1") return true;
  btn.dataset.armed = "1"; btn.dataset.label ||= btn.textContent; btn.textContent = label;
  announce(label);
  clearTimeout(btn._t); btn._t = setTimeout(() => disarm(btn), 9000);
  return false;
}
function disarm(btn) { if (!btn) return; clearTimeout(btn._t); if (btn.dataset.label) btn.textContent = btn.dataset.label; btn.dataset.armed = "0"; }

let pendingId = "";
async function startQuest() {
  freshState();
  const typed = $("#player-id").value.trim().toUpperCase();
  const m = typed.match(/^P?0*(\d{1,2})$/);
  const num = m ? +m[1] : 0;
  const raw = typed === "DEMO" ? "DEMO" : num >= 1 && num <= 30 ? `P${String(num).padStart(2, "0")}` : "";
  const err = $("#player-id-err");
  $("#player-id").setAttribute("aria-invalid", String(!raw));
  if (!raw) { err.textContent = "Use the ID your helper gave you, like P07."; err.hidden = false; $("#player-id").focus(); return; }
  const hasWork = state.role || state.experience.trim() || state.skills.length || state.displayName.trim();
  if (state.playerId && hasWork && raw !== state.playerId && pendingId !== raw) {
    pendingId = raw;
    err.textContent = `This laptop has saved progress for ${state.playerId}. Press Start again to erase it and play as ${raw}.`;
    err.hidden = false; return;
  }
  err.hidden = true; pendingId = "";
  await dataReady;
  if (!DATA) { err.textContent = "The game files didn't load. Check the Wi-Fi, then refresh the page."; err.hidden = false; return; }
  if (raw !== state.playerId) { state = { ...fresh(), playerId: raw }; store.remove("career-quest.data"); }
  enterGame();
}
function enterGame() {
  claimTab();
  show("game"); renderLeft(); renderIsland(); renderDetail();
  startPython();
  $("#left h1")?.focus({ preventScroll: true });
}

function renderLeft() {
  const left = $("#left");
  const phase = dataMismatch() ? "mismatch" : state.phase;
  left.dataset.phase = phase;
  $("#screen-game").dataset.phase = phase;
  left.innerHTML = { career: careerView, data: dataView, challenge: challengeView, unlocked: unlockedView, finish: finishView, showcase: showcaseView, mismatch: mismatchView }[phase]();
  bindLeft(phase);
  renderHud();
  const ch = CHALLENGES[state.level - 1];
  document.title = `${{ career: "Your career", data: "Meet your data", challenge: `Level ${state.level} of 3: ${ch.step}`, unlocked: `${ch.step} solved`, finish: "Your story", showcase: "Your portfolio", mismatch: "Your data changed" }[phase] || "Career Quest"} | Career Quest`;
  left.scrollTop = 0; left.scrollLeft = 0;
  watchWork();
}

function mismatchView() {
  const was = state.dataMode === "real" ? "the real 2023 job postings" : "the practice postings";
  const now = DATA.mode === "real" ? "the real job postings" : "only the practice postings";
  return `<p class="eyebrow">Hold on</p>
  <h1 class="h1" tabindex="-1">Your data changed</h1>
  <p class="lead">Your saved work used ${was}, but this laptop can load ${now} right now. Mixing them would put the wrong numbers on your portfolio.</p>
  ${state.dataMode === "fictional"
    ? `<div class="actions"><button class="btn btn-go" id="mm-keep">Keep my practice results</button><button class="btn btn-ghost" id="mm-restart">Start the levels over with real data</button></div>`
    : `<div class="actions"><button class="btn btn-go" id="mm-reload">Try loading the real data again</button><button class="btn btn-ghost" id="mm-restart">Start the levels over with practice data</button></div>`}
  <p class="help">Starting over keeps your profile and erases your level results. If you're not sure, raise your hand.</p>`;
}

const ICONS = {
  chart: `<svg viewBox="0 0 44 40"><rect x="3" y="22" width="9" height="16" rx="2" fill="var(--c-blue)"/><rect x="17" y="13" width="9" height="25" rx="2" fill="var(--c-green)"/><rect x="31" y="4" width="9" height="34" rx="2" fill="var(--c-orange)"/><path d="M5 18L19 9L33 2" fill="none" stroke="var(--ink)" stroke-width="2.4" stroke-linecap="round"/></svg>`,
  flask: `<svg viewBox="0 0 44 40"><path d="M17 3h10M19 3v11L8 33a3 3 0 0 0 2.6 4.5h22.8A3 3 0 0 0 36 33L25 14V3" fill="none" stroke="var(--ink)" stroke-width="2.6" stroke-linejoin="round"/><path d="M12.5 26h19l3.7 7a2 2 0 0 1-1.8 3H10.6a2 2 0 0 1-1.8-3Z" fill="var(--c-teal)"/><circle cx="18" cy="31" r="2" fill="var(--paper)"/><circle cx="25" cy="29" r="1.4" fill="var(--paper)"/></svg>`,
  lens: `<svg viewBox="0 0 44 40"><circle cx="18" cy="17" r="11" fill="oklch(0.9 0.05 230)" stroke="var(--c-blue)" stroke-width="4"/><path d="M26 25l11 11" stroke="var(--c-orange)" stroke-width="5.5" stroke-linecap="round"/><path d="M12 13a7 7 0 0 1 6-4" fill="none" stroke="var(--paper)" stroke-width="2.4" stroke-linecap="round"/></svg>`,
};
function careerView() {
  const locked = !!state.solved[1];
  return `<p class="eyebrow">${state.returnPhase ? "Your profile" : "Start here"}</p>
  <h1 class="h1" tabindex="-1">${state.returnPhase ? "Edit your profile" : "Choose your next move"}</h1>
  <fieldset class="careers" ${locked ? "disabled" : ""}><legend class="sr-only">Career</legend>
    ${CAREERS.map((c) => `<label class="career ${state.role === c.id ? "is-on" : ""}">
      <input type="radio" name="career" value="${esc(c.id)}" ${state.role === c.id ? "checked" : ""}>
      <span class="c-icon" aria-hidden="true">${ICONS[c.icon]}</span><span class="c-name">${esc(c.id)}</span><span class="c-blurb">${esc(c.blurb)}</span></label>`).join("")}
  </fieldset>
  ${locked ? `<p class="help">Your career is locked in because your code already used it.</p>` : ""}
  <div class="field"><span class="label" id="skills-lbl">Skills I already have <span class="opt">pick up to 4</span></span>
    <div class="chips" id="skill-chips" role="group" aria-labelledby="skills-lbl"></div>
    <div class="add-skill"><label class="sr-only" for="own-skill">Add your own skill</label><input id="own-skill" maxlength="40" placeholder="Add your own"><button type="button" class="btn-small" id="add-skill">Add</button></div>
  </div>
  <div class="field"><label class="label" for="experience">One thing I actually did</label>
    <textarea id="experience" rows="3" maxlength="320" aria-describedby="experience-help experience-err" placeholder="Example: ${esc(EXAMPLE_PROOF)}">${esc(state.experience)}</textarea>
    <span class="help" id="experience-help">What did you do, and what changed because of it? A real example from class, a job, a club or volunteering. Plain words are fine.</span>
    <span class="err" id="experience-err" hidden></span></div>
  <div class="field"><label class="label" for="display-name">Name on your portfolio <span class="opt">optional</span></label>
    <input id="display-name" maxlength="48" value="${esc(state.displayName)}" autocomplete="name" aria-describedby="name-help">
    <span class="help" id="name-help">Shows on your screen and on the page you download. Leave it blank and your page says "Career Quest Portfolio".</span></div>
  <div class="field"><label class="label" for="headline">Headline <span class="opt">optional</span></label>
    <input id="headline" maxlength="90" value="${esc(state.headline)}" aria-describedby="headline-help headline-err" placeholder="Example: ${esc(EXAMPLE_HEADLINE)}">
    <span class="help" id="headline-help">One line under your name on your portfolio.</span><span class="err" id="headline-err" hidden></span></div>
  <div class="actions actions-sticky">${state.returnPhase
    ? `<button class="btn btn-go" id="back-quest">Back to my quest</button>`
    : `<button class="btn btn-go" id="to-data" ${state.role ? "" : "disabled"} aria-describedby="to-data-why">Next: meet your data</button><span class="help" id="to-data-why" ${state.role ? "hidden" : ""}>Pick a career to continue.</span>`}</div>`;
}
function skillChipsHtml() {
  return [...new Set([...SKILL_CHOICES, ...state.skills])].map((s) => `<button type="button" class="chip" aria-pressed="${state.skills.includes(s)}" data-skill="${esc(s)}">${esc(s)}</button>`).join("");
}

function dataView() {
  const mine = DATA.byRole[state.role];
  const clean = (j) => cleanTitle(j.title).length < 40;
  const byCount = ranked(mine.reduce((acc, j) => (j.skills.forEach((s) => (acc[s] = (acc[s] || 0) + 1)), acc), {}));
  // The example posting should look typical for this career: every skill on it is one of the career's 12 most common.
  const common = new Set(byCount.slice(0, 12).map(([s]) => s));
  const fits = (j) => j.skills.length >= 3 && j.skills.length <= 5 && clean(j), coding = (j) => j.skills.some((s) => ["sql", "python"].includes(s));
  const sample = mine.find((j) => fits(j) && coding(j) && j.skills.every((s) => common.has(s))) || mine.find((j) => fits(j) && coding(j)) || mine.find(fits) || mine[0];
  const top6 = byCount.slice(0, 6).map(([s]) => s).sort();
  const rec = `{"role": ${JSON.stringify(sample.role)},\n "title": ${JSON.stringify(cleanTitle(sample.title))},\n "skills": [${sample.skills.map((s) => JSON.stringify(s)).join(", ")}]}`;
  const sel = top6.includes(state.prediction) ? state.prediction : "";
  return `<p class="eyebrow">Before you code</p>
  <h1 class="h1" tabindex="-1">Meet your data</h1>
  <p class="lead"><strong>JOBS</strong> is a list of <strong>${DATA.jobs.length}</strong> ${esc(words().postings)}. <strong>${mine.length}</strong> of them are ${esc(state.role)} jobs. Each posting looks like this:</p>
  <pre class="code code-static" role="figure" aria-label="One posting from JOBS">${hl(rec)}</pre>
  <p class="help">A <strong>list</strong> holds many items in order. Each posting is a <strong>dictionary</strong>: labels like "role" paired with values like "${esc(sample.role)}".
  ${DATA.mode === "real" ? " The sample mixes full-time and part-time jobs, up to 80 of each per career, so part-time jobs show up far more often here than in real listings." : " This practice set is made up, so the results won't reflect real jobs."}</p>
  <div class="field"><span class="label" id="pred-lbl">Your prediction: which skill shows up most in ${esc(state.role)} postings?</span>
    <div class="chips" role="radiogroup" aria-labelledby="pred-lbl" aria-describedby="pred-help" id="pred-group">
      ${top6.map((s, i) => `<button type="button" class="chip" role="radio" aria-checked="${sel === s}" tabindex="${sel ? (sel === s ? 0 : -1) : i === 0 ? 0 : -1}" data-pred="${esc(s)}">${esc(prettySkill(s))}</button>`).join("")}
    </div><span class="help" id="pred-help">No wrong answers. Your code will tell you at the end.</span></div>
  <div class="actions actions-sticky"><button class="btn btn-ghost" id="back-career">Back</button><button class="btn btn-go" id="to-l1" ${sel ? "" : "disabled"} aria-describedby="to-l1-why">${state.solved[1] ? "Back to my quest" : "Start Level 1"}</button><span class="help" id="to-l1-why" ${sel ? "hidden" : ""}>Pick a skill to start.</span></div>`;
}

// What a beginner reads before the code: the goal, the code line by line in plain English (the bug marked), and the move.
function briefHtml(ch) {
  const b = ch.brief({ role: state.role, mine: (DATA.byRole[state.role] || []).length, total: DATA.jobs.length });
  return `<div class="brief" id="level-intro">
    <p class="brief-goal"><span class="brief-k">Goal</span> ${fmt(b.goal)}</p>
    <p class="brief-k brief-k-block" id="brief-plain">What the code does, line by line <span class="brief-who">Python does these steps when you press Run</span></p>
    <ol class="brief-lines" aria-labelledby="brief-plain">${b.lines.map((l, i) => `<li${l.bug ? ' class="is-bug"' : ""}><span class="bl-n"><span class="sr-only">Line </span>${i + 1}</span><span${l.bug ? ' id="brief-bug"' : ""}>${fmt(l.text)}${l.bug ? ` <strong class="bl-bug">The bug:</strong> ${fmt(l.bug)}` : ""}</span></li>`).join("")}</ol>
    <p class="brief-move" id="brief-move"><span class="brief-k">Your move</span> ${fmt(b.move)}</p>
    ${b.example ? `<details class="brief-ex"><summary>See an example<span class="ex-sub">(same idea, different data)</span></summary>
      <p class="ex-intro">${fmt(b.example.intro)}</p>
      <div class="ex-code" role="group" aria-label="Example code">${b.example.rows.map((r) => `<div class="ex-row${r.kind ? ` is-${r.kind}` : ""}"><span class="ex-tag">${r.kind === "before" ? "Before" : r.kind === "after" ? "After" : ""}</span><code>${hl(r.code)}</code>${r.result ? `<span class="ex-result">Result: ${esc(r.result)}</span>` : ""}</div>`).join("")}</div>
      <p class="ex-note">${fmt(b.example.note)}</p>
    </details>` : ""}
  </div>`;
}
function codeLines(level) {
  const ch = CHALLENGES[level - 1];
  return ch.lines(state.role).map((ln, i) => {
    const n = i + 1;
    if (!ln.edit) return `<div class="ln"><span class="ln-n" aria-hidden="true">${n}</span><code>${hl(ln.code)}${ln.note ? ` <span class="t-com"># ${esc(ln.note)}</span>` : ""}</code></div>`;
    const val = state.lines[`draft${level}`] ?? ln.start;
    return `<div class="ln ln-edit"><span class="ln-n" aria-hidden="true">${n}</span>
      <span class="indent" style="--i:${ln.indent}"></span>
      <label class="sr-only" for="edit-line">Line ${n}, the line to fix</label>
      <input id="edit-line" class="edit" spellcheck="false" autocomplete="off" autocapitalize="off" autocorrect="off" value="${esc(val)}" aria-describedby="brief-bug brief-move"></div>`;
  }).join("");
}

function challengeView() {
  const ch = CHALLENGES[state.level - 1];
  const used = state.hintsUsed[ch.level] || 0;
  return `<p class="eyebrow">Level ${ch.level} of 3 · ${ch.step}</p>
  <h1 class="h1" tabindex="-1">${esc(ch.mission)}</h1>
  ${briefHtml(ch)}
  <div class="work">
  <div class="code-panel">
    <div class="code-head"><span>your_code.py <span class="fix-tip">· fix line ${EDIT_LINE[ch.level]}</span></span><span class="head-r"><span class="py-status" id="py-status"></span></span></div>
    <div class="code" id="code" tabindex="0" role="region" aria-label="your_code.py">${codeLines(ch.level)}</div>
    <button type="button" class="btn-text btn-reset" id="reset">Reset line</button>
  </div>
  <div class="actions">
    <button class="btn btn-go btn-run" id="run"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 4l10 6-10 6z" fill="currentColor"/></svg><span>Run</span></button>
    <span id="clue-slot">${clueControl(used)}</span>
    <span id="help-slot"></span>
  </div>
  </div>
  <div id="feedback" class="feedback" role="status" aria-live="polite"></div>
  <div id="stuck"></div>
  <div id="hints" class="hints">${hintNotes(ch)}</div>
  <p class="ask">Stuck? Ask a teammate or helper: <em>"I expected ___, but I saw ___."</em></p>`;
}
const clueControl = (used) => used >= 3
  ? `<span class="clues-done">All 3 clues are below</span>`
  : `<button class="btn btn-clue" id="clue"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.5a5.5 5.5 0 0 0-3.2 10V15h6.4v-2.5A5.5 5.5 0 0 0 10 2.5zM7.6 16.5h4.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span>${used === 0 ? "Need a clue?" : "Next clue"}</span></button>`;
const shortScreen = () => matchMedia("(min-width: 981px) and (max-height: 679px)").matches;
function hintNotes(ch) {
  const used = state.hintsUsed[ch.level] || 0, fold = shortScreen();
  return ch.hints.slice(0, used).map((h, i) => {
    const newest = i === used - 1;
    const back = newest && used >= 3 ? `<button type="button" class="btn-text hint-back" data-back>Back to line ${EDIT_LINE[ch.level]}</button>` : "";
    return `<details class="hint" data-i="${i}" ${newest || !fold ? "open" : ""}><summary class="hint-tier">Hint ${i + 1} of 3 · ${h.tier}</summary><p>${fmt(h.text)}</p>${newest ? `<p class="hint-free">Hints never cost points.</p>${back}` : ""}</details>`;
  }).join("");
}
const isStuck = (lvl) => (state.fails[lvl] || 0) >= 5 || ((state.hintsUsed[lvl] || 0) >= 3 && (state.fails[lvl] || 0) >= 2);
function renderStuck(ch, { noPython = false, slow = false } = {}) {
  const box = $("#stuck"), slot = $("#help-slot");
  if (!box || (!noPython && !isStuck(ch.level)) || state.solved[ch.level]) { if (box && box.dataset.noPython !== "1") { box.innerHTML = ""; if (slot) slot.innerHTML = ""; } return; }
  const variant = slow ? "slow" : noPython ? "noPython" : "stuck";
  if (box.dataset.shown === "1" && box.dataset.variant === variant) return false;
  box.dataset.shown = "1"; box.dataset.variant = variant;
  if (noPython) box.dataset.noPython = "1";
  box.innerHTML = slow
    ? `<div class="stuck-card" id="stuck-why"><p class="fb-title">Python is still downloading on this Wi-Fi.</p>
    <p>It switches on by itself when it's ready. Short on time? Use <strong>Unlock with help</strong> next to Run: 0 points for this level, and your portfolio will say a helper unlocked it.</p></div>`
    : noPython
    ? `<div class="stuck-card" id="stuck-why"><p>If a helper can't get Python going, use <strong>Unlock with help</strong> next to Run: 0 points for this level, and your portfolio will say a helper unlocked it.</p></div>`
    : `<div class="stuck-card" id="stuck-why"><p class="fb-title">Still stuck? That's normal.</p>
    <p>Raise your hand, or use <strong>Unlock with help</strong> next to Run: 0 points for this level, and your portfolio will say a helper unlocked it.</p></div>`;
  slot.innerHTML = `<button type="button" class="btn-small btn-help" id="help-unlock" aria-describedby="stuck-why">Unlock with help</button>`;
  $("#help-unlock").addEventListener("click", (e) => { if (arm(e.currentTarget, "Click again to unlock for 0 points")) helpUnlock(ch); });
  // The card explains the "Unlock with help" button that just appeared next to Run: bring the message and the card into view together.
  requestAnimationFrame(() => { const f = $("#feedback"); if (f && box.isConnected) reveal(f.innerHTML ? f : box, false, box); });
  announce(slow ? "Python is still downloading. You can keep waiting, or unlock this level with help for 0 points." : noPython ? "You can unlock this level with help for 0 points." : "Still stuck? That's normal. Raise your hand, or unlock this level with help for 0 points.");
  return true;
}

function unlockedView() {
  const ch = CHALLENGES[state.level - 1];
  const r = state.results[ch.level];
  const b = BUILDINGS.find((x) => x.key === ch.unlocks);
  const last = ch.level === 3;
  const helped = !!state.helped[ch.level];
  return `<p class="eyebrow">Level ${ch.level} ${helped ? "unlocked with a helper" : "solved"}</p>
  <div class="unlock-banner"><span class="badge b-${b.key}" data-state="open" aria-hidden="true">${buildingSvg(b.key)}</span>
    <div><h1 class="h1" tabindex="-1" id="unlock-h1">${esc(b.label)} unlocked!</h1><span class="plus" id="plus">${helped ? "Unlocked with help" : `+${ch.points} points`}</span></div></div>
  <div class="learn learn-what"><h2 class="h3">${helped ? "What the fixed code does" : "What your code did"}</h2><p>${esc(helped ? ch.helpedWhat(r) : ch.whatItDid(r))}</p>
    <p class="why why-up"><strong>Why it's on your portfolio:</strong> ${esc(helped ? ch.helpedPortfolioWhy : ch.portfolioWhy)}</p></div>
  <div class="explain">
    <label class="explain-label" for="explain"><span class="explain-k">Explain your unlock.</span> ${esc(helped ? ch.explain.helpedQuestion : ch.explain.question)} <span class="opt">Say it like you would in an interview.</span></label>
    <textarea id="explain" rows="3" maxlength="600" aria-describedby="explain-nudge">${esc(state.explains[ch.level] || "")}</textarea>
    <div class="starters" role="group" aria-label="Sentence starters">${(helped ? ch.explain.helpedStarters : ch.explain.starters).map((s) => `<button type="button" class="chip chip-small" data-starter="${esc(s)}">${esc(s)}</button>`).join("")}</div>
    <p class="help nudge" id="explain-nudge" hidden></p>
  </div>
  <div class="think think-after"><p class="why why-down"><strong>Why it's on your portfolio:</strong> ${esc(helped ? ch.helpedPortfolioWhy : ch.portfolioWhy)}</p><p><strong>Think about it:</strong> ${esc(ch.why)} ${esc(ch.transfer(r))}</p></div>
  <div class="actions actions-sticky"><button class="btn btn-go" id="keep-going">${last ? "Finish my portfolio" : "Save and keep going"}</button></div>`;
}

function finishView() {
  return `<p class="eyebrow">Last step</p>
  <h1 class="h1" tabindex="-1">Tell the story of your project</h1>
  <div class="field"><label class="h3" for="built">How I Built This</label>
    <p class="help" id="built-help">These are your own explanations from each level. Edit them into one short story: what you asked, what your code did, what you found, and one limit of the data.</p>
    <textarea id="built" rows="8" maxlength="1400" aria-describedby="built-help built-err">${esc(storyOf(state))}</textarea><span class="err" id="built-err" hidden></span></div>
  <div class="field"><label class="label" for="next-step-2">My next step</label>
    <input id="next-step-2" maxlength="160" value="${esc(state.nextStep)}" aria-describedby="next2-help next-step-err" placeholder="Example: Finish a beginner SQL exercise by December 1.">
    <span class="help" id="next2-help">One skill, one action, a date. It goes under Career Strategy.</span><span class="err" id="next-step-err" hidden></span></div>
  <div class="field"><label class="label" for="display-name-2">Name on your portfolio <span class="opt">optional</span></label>
    <input id="display-name-2" maxlength="48" value="${esc(state.displayName)}" autocomplete="name" aria-describedby="name2-help">
    <span class="help" id="name2-help">This is the first thing a recruiter sees. Leave it blank and your page says "Career Quest Portfolio".</span></div>
  <div class="field"><label class="label" for="linkedin">LinkedIn link <span class="opt">optional</span></label>
    <input id="linkedin" inputmode="url" maxlength="200" value="${esc(state.linkedin)}" placeholder="linkedin.com/in/your-name" aria-describedby="linkedin-err"><span class="err" id="linkedin-err" hidden></span></div>
  <div class="field"><label class="label" for="github">GitHub link <span class="opt">optional</span></label>
    <input id="github" inputmode="url" maxlength="200" value="${esc(state.github)}" placeholder="github.com/your-name" aria-describedby="github-err"><span class="err" id="github-err" hidden></span></div>
  <div class="actions actions-sticky"><button class="btn btn-go" id="save-built">${state.builtSaved ? "Save my story" : "Add my story and finish my city"}</button></div>`;
}

function showcaseView() {
  const helpedAny = [1, 2, 3].some((k) => state.helped[k]);
  return `<p class="eyebrow">Showcase</p>
  <h1 class="h1 h1-big" tabindex="-1">Your city is complete!</h1>
  <p class="score"><strong>${points()} / ${MAX_POINTS} Python points.</strong> Career and portfolio points come from your facilitator${helpedAny ? ". Levels unlocked with a helper count 0 Python points" : ""}.</p>
  <div class="actions"><button class="btn btn-go" id="preview">See my portfolio</button><button class="btn btn-ghost" id="save-pdf">Save as PDF</button></div>
  <div class="actions"><button class="btn-small" id="dl-portfolio">Download portfolio (.html)</button><button class="btn-small" id="dl-code">Download my code (.py)</button></div>
  <p class="done" id="done" role="status" hidden></p>
  <div class="share"><h2 class="h3">Share it</h2>
    <ul><li>Save as PDF, then attach it to an email or a job application.</li>
    <li>On LinkedIn, add the PDF to the Featured section of your profile.</li>
    <li>Show your facilitator your finished city before you leave.</li></ul></div>
  <div class="actions"><button type="button" class="btn-text" id="edit-story">Edit my story or links</button><button type="button" class="btn-text" id="erase-me">Erase my data from this laptop</button></div>
  <p class="help">On a shared laptop: download your files, move them to your own drive or email them to yourself, then erase. Downloaded files stay in this laptop's Downloads folder until you delete them.</p>`;
}

/* ---------- bindings ---------- */
function bindLeft(phase) {
  const left = $("#left");
  if (phase === "mismatch") {
    $("#mm-reload")?.addEventListener("click", () => location.reload());
    $("#mm-keep")?.addEventListener("click", () => { store.set("career-quest.data", "practice"); location.reload(); });
    $("#mm-restart").addEventListener("click", (e) => {
      if (!arm(e.currentTarget, "Click again to erase your level results")) return;
      Object.assign(state, { solved: {}, helped: {}, results: {}, lines: {}, explains: {}, hintsUsed: { 1: 0, 2: 0, 3: 0 }, fails: { 1: 0, 2: 0, 3: 0 }, built: "", builtSaved: false, dataMode: "", level: 1, phase: "data", selected: "summary" });
      save(); renderLeft(); renderIsland(); renderDetail(); $("#left h1").focus();
    });
  }
  if (phase === "career") {
    const chips = $("#skill-chips");
    const renderChips = () => {
      chips.innerHTML = skillChipsHtml();
      $$("[data-skill]", chips).forEach((b) => b.addEventListener("click", () => {
        const s = b.dataset.skill, on = state.skills.includes(s);
        if (!on && state.skills.length >= 4) { toast("Pick up to 4. Click one to remove it."); return; }
        state.skills = on ? state.skills.filter((x) => x !== s) : [...state.skills, s];
        b.setAttribute("aria-pressed", String(!on)); save(); renderDetail();
      }));
    };
    renderChips();
    $$('input[name="career"]', left).forEach((r) => r.addEventListener("change", () => {
      const changed = state.role !== r.value;
      if (changed && state.prediction) toast("Your skill prediction was cleared, since you picked a new career.");
      state.role = r.value; state.selected = "summary";
      if (changed) state.prediction = "";
      save();
      $$(".career", left).forEach((l) => l.classList.toggle("is-on", l.contains(r)));
      if ($("#to-data")) { $("#to-data").disabled = false; $("#to-data-why").hidden = true; }
      renderIsland({ hold: changed ? "summary" : undefined }); renderDetail(); if (changed) raise("summary");
    }));
    $("#add-skill").addEventListener("click", () => {
      const inp = $("#own-skill"), v = inp.value.trim();
      if (!v) { inp.focus(); return; }
      if (!state.skills.includes(v) && state.skills.length >= 4) { toast("Pick up to 4. Click one to remove it."); return; }
      if (!state.skills.includes(v)) state.skills.push(v);
      inp.value = ""; limitNote(inp); save(); renderChips(); renderDetail(); inp.focus();
      announce(`${v} added to your skills.`);
    });
    $("#own-skill").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); $("#add-skill").click(); } });
    $("#experience").addEventListener("input", (e) => {
      state.experience = e.target.value; save(); renderDetail();
      if (state.experience.trim()) { e.target.removeAttribute("aria-invalid"); $("#experience-err").hidden = true; }
    });
    $("#display-name").addEventListener("input", (e) => { state.displayName = e.target.value; save(); $("#p-name").textContent = state.displayName.trim() || `Player ${state.playerId}`; });
    $("#headline").addEventListener("input", (e) => { state.headline = e.target.value; save(); e.target.removeAttribute("aria-invalid"); $("#headline-err").hidden = true; });
    const needProof = () => {
      const v = state.experience.trim().replace(/^example:\s*/i, "");
      const msg = !v ? "Add one thing you actually did. It's the proof on your portfolio."
        : squash(v).startsWith(squash(EXAMPLE_PROOF).slice(0, 40)) ? "That's the example sentence. Write something you actually did, in your own words." : "";
      if (!msg) {
        if (squash(state.headline) && squash(state.headline) === squash(EXAMPLE_HEADLINE)) {
          const h = $("#headline"), he = $("#headline-err");
          h.setAttribute("aria-invalid", "true"); he.textContent = "That's the example headline. Write your own, or leave it blank."; he.hidden = false; h.focus();
          return false;
        }
        return true;
      }
      const ex = $("#experience"), err = $("#experience-err");
      ex.setAttribute("aria-invalid", "true"); err.textContent = msg; err.hidden = false; ex.focus();
      return false;
    };
    $("#to-data")?.addEventListener("click", () => { if (needProof()) { state.phase = "data"; save(); renderLeft(); $("#left h1").focus(); } });
    $("#back-quest")?.addEventListener("click", () => {
      if (!needProof()) return;
      state.phase = state.prediction ? state.returnPhase || "data" : "data"; // a new career needs a new prediction first
      state.returnPhase = ""; save(); renderLeft(); renderDetail(); $("#left h1").focus();
    });
  }
  if (phase === "data") {
    const radios = $$("[data-pred]", left);
    const pick = (b) => {
      state.prediction = b.dataset.pred; save();
      radios.forEach((x) => { x.setAttribute("aria-checked", String(x === b)); x.tabIndex = x === b ? 0 : -1; });
      $("#to-l1").disabled = false; $("#to-l1-why").hidden = true;
    };
    radios.forEach((b, i) => {
      b.addEventListener("click", () => pick(b));
      b.addEventListener("keydown", (e) => {
        const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (!d) return;
        e.preventDefault();
        const next = radios[(i + d + radios.length) % radios.length];
        pick(next); next.focus();
      });
    });
    $("#back-career").addEventListener("click", () => { state.phase = "career"; save(); renderLeft(); $("#left h1").focus(); });
    $("#to-l1").addEventListener("click", () => {
      state.phase = state.solved[state.level] ? "unlocked" : "challenge";
      if (state.phase === "challenge") state.selected = CHALLENGES[state.level - 1].unlocks;
      save(); renderLeft(); renderIsland(); renderDetail(); $("#left h1").focus();
    });
  }
  if (phase === "challenge") {
    const ch = CHALLENGES[state.level - 1];
    const input = $("#edit-line");
    const size = () => (input.style.width = `${Math.max(input.value.length + 1, 12)}ch`);
    size();
    requestAnimationFrame(() => { const code = $("#code"); if (code && code.scrollWidth > code.clientWidth + 1) code.scrollLeft = code.scrollWidth; });
    const syncPy = (s) => {
      const st = $("#py-status"), run = $("#run");
      if (!st || !run) return;
      if (s !== py.said && (s === "failed" || (s === "ready" && py.said && py.said !== "ready"))) announce(s === "ready" ? "Python is ready." : "Python couldn't load.");
      py.said = s;
      st.dataset.s = s;
      st.textContent = { ready: "Python ready", failed: "Python didn't load", slow: "Still loading Python…", saving: "Getting the game ready…" }[s] || "Warming up Python…";
      if (!running) {
        run.disabled = s !== "ready";
        run.querySelector("span").textContent = s === "ready" ? "Run" : s === "failed" ? "Python not ready" : "Loading…";
      }
      const fb = $("#feedback");
      if (s === "failed") {
        if (py.autoRetrying) showFeedback("err", "Python didn't load yet.", "Trying again on its own in a few seconds, or try now.", { retry: true });
        else {
          showFeedback("err", "Python couldn't load.", py.noWasm ? "This browser can't run Python: a feature it needs is turned off. Raise your hand: a helper can move you to another browser or laptop."
            : py.badFile === "saved" ? "This laptop's saved copy of Python was damaged, so it was cleared. Connect to Wi-Fi and Try again to download a fresh copy, or raise your hand."
            : py.badFile ? `The game's Python file arrived damaged, often because a web filter replaced it. ${HELP_NEXT}`
            : py.cutOff ? (navigator.onLine === false ? "This laptop lost the Wi-Fi before Python finished downloading. It picks up again by itself when the Wi-Fi is back, or press Try again." : "The Python download was cut off partway, usually by a Wi-Fi drop. Check the Wi-Fi and press Try again, or raise your hand.")
            : py.blocked ? `A web filter or the Wi-Fi is blocking Python. ${HELP_NEXT}`
            : "Python didn't start. Try again, and if it still fails, raise your hand.", { retry: !py.noWasm, tech: py.noWasm ? "For the helper: WebAssembly is turned off or missing in this browser." : "" });
          renderStuck(ch, { noPython: true });
        }
      } else if (s === "ready" && $("#stuck")?.dataset.noPython === "1") {
        const box = $("#stuck"); box.innerHTML = ""; delete box.dataset.noPython; delete box.dataset.shown; delete box.dataset.variant; $("#help-slot").innerHTML = ""; renderStuck(ch);
        if (fb) { fb.innerHTML = ""; delete fb.dataset.kind; }
      } else if (s === "slow" || s === "saving") {
        // Once the "still downloading" card shows, it carries the explanation, so the message above it gets shorter.
        const key = py.offerHelp ? `${s}+help` : s;
        if (fb?.dataset.kind !== "wait" || fb.dataset.s !== key) {
          showFeedback("wait", s === "saving" ? "Getting the game ready on this laptop." : "Python is still loading.", py.offerHelp ? "" : py.cached ? "Starting Python from this laptop's saved copy." : (s === "saving" || navigator.serviceWorker?.controller) ? "The first time can take a few minutes on busy Wi-Fi. After that it's instant, even offline." : "The first time can take a few minutes on busy Wi-Fi.", { retry: false });
          fb.dataset.s = key;
          fb.insertAdjacentHTML("beforeend", `<p class="fb-progress">${esc(progressText())}</p>`);
        }
        if (py.offerHelp) renderStuck(ch, { noPython: true, slow: true });
      } else if (fb?.dataset.kind === "wait" || (s === "ready" && fb?.dataset.kind === "err" && /load/i.test(fb.textContent))) { fb.innerHTML = ""; delete fb.dataset.kind; }
    };
    if (py.ui) py.listeners.delete(py.ui);   // replace this screen's listener, keep the others
    py.ui = syncPy; py.listeners.add(syncPy); syncPy(py.status);
    input.addEventListener("input", () => {
      // Curly quotes and pasted special spaces break Python: straighten them as the student types.
      const v = input.value, fixed = v.replace(/[“”„″]/g, '"').replace(/[‘’′]/g, "'").replace(/[   ​]/g, " ");
      if (fixed !== v) { const p = input.selectionStart; input.value = fixed; input.setSelectionRange(p, p); }
      state.lines[`draft${ch.level}`] = input.value; size(); save();
    });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); $("#run").click(); } });
    $("#run").addEventListener("click", () => runLevel(ch));
    const bindClue = () => $("#clue")?.addEventListener("click", () => {
      if ((state.hintsUsed[ch.level] || 0) >= 3) return;
      state.hintsUsed[ch.level] = (state.hintsUsed[ch.level] || 0) + 1; save();
      const used = state.hintsUsed[ch.level];
      $("#hints").innerHTML = hintNotes(ch);
      const note = $("#hints .hint:last-child");
      announce(`Hint ${used} of 3, ${ch.hints[used - 1].tier}. ${ch.hints[used - 1].text.replace(/`/g, "")}`);
      renderStuck(ch);
      if (used >= 3) { $("#clue-slot").innerHTML = clueControl(used); note?.querySelector("summary")?.focus({ preventScroll: true }); }
      else $("#clue span").textContent = "Next clue";
      if (note) requestAnimationFrame(() => reveal(note));   // after any stuck card's own scroll: the clue just asked for comes first
      if (note && !reduceMotion()) note.animate([{ opacity: 0, transform: "translateY(-6px) rotate(-1deg)" }, { opacity: 1, transform: "rotate(-0.5deg)" }], { duration: 220, easing: EASE });
    });
    bindClue();
    // "Back to line 3" in the last clue: keyboard users go straight to the line instead of tabbing through the city.
    $("#hints").addEventListener("click", (e) => { if (!e.target.closest("[data-back]")) return; const ed = $("#edit-line"); if (ed && !ed.readOnly) { ed.focus(); ed.setSelectionRange(ed.value.length, ed.value.length); } });
    $("#reset").addEventListener("click", () => {
      input.value = ch.lines(state.role).find((l) => l.edit).start;
      state.lines[`draft${ch.level}`] = input.value; size(); save(); input.focus();
      $("#output")?.remove(); const fb = $("#feedback"); fb.innerHTML = ""; delete fb.dataset.kind;
    });
    renderStuck(ch);
  }
  if (phase === "unlocked") {
    const ch = CHALLENGES[state.level - 1];
    const ta = $("#explain");
    ta.addEventListener("input", () => { state.explains[state.level] = ta.value; save(); });
    $$("[data-starter]", left).forEach((b) => b.addEventListener("click", () => {
      const s = b.dataset.starter.replace(/…$/, " ");
      ta.value = (ta.value.trim() ? ta.value.trimEnd() + " " : "") + s;
      state.explains[state.level] = ta.value; save(); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
    }));
    $("#next-step")?.addEventListener("input", (e) => { state.nextStep = e.target.value; save(); if (state.selected === "strategy") renderDetail(); });
    let emptyNudged = false, danglingSeen = "";
    $("#keep-going").addEventListener("click", () => {
      const v = ta.value.trim(), nudge = $("#explain-nudge");
      const dangling = [...ch.explain.starters, ...ch.explain.helpedStarters].map((s) => s.replace(/…$/, "")).find((s) => v.endsWith(s));
      if ((!v && !emptyNudged) || (dangling && danglingSeen !== v)) {
        if (!v) emptyNudged = true; else danglingSeen = v;
        nudge.hidden = false;
        nudge.textContent = !v ? "Even one sentence counts. You can edit it later." : `Finish your sentence that starts "${dangling}", or click again to keep it as it is.`;
        ta.focus(); return;
      }
      if (state.level < 3) { state.level++; state.phase = "challenge"; state.selected = CHALLENGES[state.level - 1].unlocks; } else state.phase = "finish";
      save(); renderLeft(); renderIsland(); renderDetail(); $("#left h1").focus();
    });
  }
  if (phase === "finish") {
    $("#built").addEventListener("input", (e) => { state.built = e.target.value; save(); if (state.builtSaved && state.selected === "built") renderDetail(); });
    $("#next-step-2").addEventListener("input", (e) => { state.nextStep = e.target.value; save(); });
    $("#display-name-2").addEventListener("input", (e) => { state.displayName = e.target.value; save(); $("#p-name").textContent = state.displayName.trim() || `Player ${state.playerId}`; });
    for (const k of ["linkedin", "github"]) {
      const inp = $(`#${k}`), err = $(`#${k}-err`);
      inp.addEventListener("input", () => { state[k] = inp.value; save(); err.hidden = true; inp.removeAttribute("aria-invalid"); });
      inp.addEventListener("blur", () => validateLink(k, { focus: false }));
    }
    $("#save-built").addEventListener("click", () => {
      state.built = $("#built").value;
      const story = state.built.trim(), b = $("#built"), why = $("#built-err");
      const starterStubs = CHALLENGES.flatMap((c) => [...c.explain.starters, ...c.explain.helpedStarters]).map((s) => s.replace(/…$/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      const unfinished = /(…|\.\.\.|\b(was|is|to|the|my|a|and|I will|I wanted to find))$/i.test(story) || /…/.test(story)
        || starterStubs.some((s) => new RegExp(`${s}\\s*(?:[.!?]|\\n|$)`, "i").test(story));
      if (!story || unfinished || (story.length < 40 && b.dataset.nudged !== story)) {
        b.dataset.nudged = story; b.setAttribute("aria-invalid", "true"); why.hidden = false;
        why.textContent = !story ? "Write at least a sentence in your own words first."
          : unfinished ? "Finish the sentences that start with a starter (or end in …) before your story goes on your portfolio."
          : "Your story is quite short. Add a little more, or click again to keep it as it is.";
        b.focus(); return;
      }
      b.removeAttribute("aria-invalid"); why.hidden = true;
      const ns = $("#next-step-2");
      const nsErr = $("#next-step-err");
      if (squash(state.nextStep) === squash("Finish a beginner SQL exercise by December 1.")) {
        ns.setAttribute("aria-invalid", "true"); nsErr.textContent = "That's the example next step. Write your own: one skill, one action, a date."; nsErr.hidden = false; ns.focus(); return;
      }
      if (!state.nextStep.trim() && ns.dataset.nudged !== "1") {
        ns.dataset.nudged = "1"; ns.setAttribute("aria-invalid", "true"); nsErr.textContent = "Add your next step for your portfolio, or click again to skip it."; nsErr.hidden = false; ns.focus(); return;
      }
      ns.removeAttribute("aria-invalid"); nsErr.hidden = true;
      if (!validateLink("linkedin") || !validateLink("github")) return;
      const first = !state.builtSaved;
      state.builtSaved = true; state.selected = "built"; state.phase = "showcase"; save();
      renderLeft(); renderDetail(); $("#left h1").focus();
      if (first) {
        renderIsland({ hold: "built" });
        if (singleColumn()) $(`.bldg[data-key="built"]`)?.scrollIntoView({ block: "center", behavior: reduceMotion() ? "auto" : "smooth" });
        raise("built", { celebrate: true, pop: "Story added" }); announce("How I Built This unlocked. Your city is complete.");
      }
      else renderIsland();
    });
  }
  if (phase === "showcase") {
    $("#preview").addEventListener("click", () => {
      const url = URL.createObjectURL(new Blob([page({ draft: false })], { type: "text/html" }));
      const w = window.open(url, "_blank");
      if (!w) { download(`career-portfolio-${state.playerId}.html`, page({ draft: false })); done(`Your browser blocked the preview, so the page was downloaded instead: career-portfolio-${state.playerId}.html.`); }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    });
    $("#save-pdf").addEventListener("click", () => printPortfolio());
    $("#dl-portfolio").addEventListener("click", () => {
      const name = `career-portfolio-${state.playerId}.html`;
      download(name, page({ draft: false }));
      done(`Saved to your Downloads folder as ${name}. It opens in any web browser.`);
    });
    $("#dl-code").addEventListener("click", () => {
      if (dataMismatch()) { toast("Your data changed. Reload the page before downloading your code."); return; }
      const name = `career-quest-${state.playerId}.py`;
      download(name, pythonFile(state, DATA), "text/x-python");
      done(`Saved to your Downloads folder as ${name}. It runs with Python on any computer.`);
    });
    $("#edit-story").addEventListener("click", () => { state.phase = "finish"; save(); renderLeft(); $("#left h1").focus(); });
    $("#erase-me").addEventListener("click", (e) => {
      if (!arm(e.currentTarget, "Click again to erase everything for this player")) return;
      $("#print-frame")?.remove();
      store.remove(STORE); store.remove("career-quest.data"); state = fresh(); show("title"); store.remove(STORE); renderTitle(); $("#player-id").focus(); toast("Your data was erased from this laptop.");
    });
  }
}
function validateLink(k, { focus = true } = {}) {
  const inp = $(`#${k}`), err = $(`#${k}-err`);
  if (!inp) return true;
  const v = inp.value.trim();
  if (!v) return true;
  const ok = normalizeUrl(v, k === "github" ? "github.com" : "linkedin.com");
  if (ok) { if (ok !== v) { inp.value = ok; state[k] = ok; save(); } return true; }
  err.textContent = k === "github" ? "That doesn't look like a GitHub link. Try something like github.com/your-name." : "That doesn't look like a LinkedIn link. Try something like linkedin.com/in/your-name.";
  err.hidden = false; inp.setAttribute("aria-invalid", "true"); if (focus) inp.focus();
  return false;
}
function done(msg) {
  const el = $("#done");
  el.hidden = false; el.textContent = msg;
  el.scrollIntoView({ block: "nearest", behavior: reduceMotion() ? "auto" : "smooth" });
}
// Save as PDF: print just the portfolio page (the print dialog offers "Save as PDF").
function printPortfolio() {
  $("#print-frame")?.remove();
  const f = Object.assign(document.createElement("iframe"), { id: "print-frame", title: "Portfolio for printing" });
  f.className = "print-frame";
  f.srcdoc = page({ draft: false });
  f.setAttribute("tabindex", "-1"); f.setAttribute("aria-hidden", "true"); f.inert = true;
  const back = document.activeElement;
  f.onload = async () => {
    f.contentWindow.addEventListener("afterprint", () => { f.remove(); back?.focus?.(); }, { once: true });
    try { await Promise.race([f.contentDocument.fonts.ready, wait(2000)]); f.contentWindow.focus(); f.contentWindow.print(); }
    catch { toast("Printing isn't available here. Use Download portfolio, then print it from your browser."); }
  };
  document.body.append(f);
  done("In the print window, choose Save as PDF as the destination.");
}

/* ---------- running a level ---------- */
let running = false;
async function runLevel(ch) {
  if (running || state.solved[ch.level] || py.status !== "ready" || paused) return;
  running = true;
  const input = $("#edit-line"), run = $("#run");
  const line = input.value;
  if (!line.trim()) { running = false; showFeedback("err", "Your yellow line is empty.", "Click Reset line to bring back the original, then change one small thing."); return; }
  const squashWs = (t) => t.replace(/\s+/g, " ").trim();
  const untouched = squashWs(line) === squashWs(ch.lines(state.role).find((l) => l.edit).start);
  run.disabled = true; run.classList.add("is-running"); run.querySelector("span").textContent = "Running…";
  input.readOnly = true;
  try {
    const rep = await py.run(compose(ch.level, line));
    showOutput(ch.level, rep);
    if (!rep.ok) {
      const f = friendlyError(rep, ch.level, line);
      showFeedback("err", f.title, f.detail, { tech: f.tech });
      if (!["setup", "timeout"].includes(rep.kind) && !untouched) failed(ch);
      return;
    }
    let res = checkNow(ch.level, rep);
    const rebinds = line.match(/(?:^|[;\s(])(sorted|counts|matched_jobs|JOBS|TARGET_ROLE|top_skills|len|print|str|int)\s*:?=(?!=)/);
    if (res.pass && /;/.test(line.replace(/(["'])(?:\\.|(?!\1).)*\1/g, "").replace(/#.*$/, ""))) res = { pass: false, msg: "Your line does the right thing, then adds another statement after a semicolon (;). Keep the fix to the one thing this line does." };
    if (res.pass && rebinds) res = { pass: false, msg: `Your line also changes ${rebinds[1]}, which the rest of the program needs. Keep the fix to the one thing this line does.` };
    if (res.pass && untouched) res = { pass: false, msg: "This is still the original line with the bug in it." };
    if (res.pass && ch.level === 1) {
      // Prove the line follows the variable: run it again as if a friend picked another career.
      for (const alt of altRoles()) {
        const rep2 = await py.run(compose(1, line, alt));
        const want = DATA.byRole[alt].length;
        if (!rep2.ok && ["setup", "timeout"].includes(rep2.kind)) { const e = friendlyError(rep2, 1); showFeedback("err", e.title, e.detail, { tech: e.tech }); return; }
        const follows = followsRole(rep2, alt, want);
        if (follows) { if (!res.result.alt) Object.assign(res.result, { alt, altN: want }); }
        else { res = { pass: false, msg: `It works for ${state.role}, but if a friend picked ${alt}, your line wouldn't find their postings. Instead of typing your career in quotes, use the name line 1 gave it, with no quotes, like FAVORITE in the example.` }; break; }
      }
      if (res.pass) {
        // ...and keep only exact matches: add a few look-alike roles and run it once more.
        const fakes = lookAlikes(state.role);
        const repD = await py.run(compose(1, line, undefined, undefined, fakes));
        if (!repD.ok && ["setup", "timeout"].includes(repD.kind)) { const e = friendlyError(repD, 1); showFeedback("err", e.title, e.detail, { tech: e.tech }); return; }
        if (!followsRole(repD, state.role, DATA.byRole[state.role].length)) {
          const kept = fakes.map((f) => f.role).filter((r) => repD.matched?.roles?.[r]).slice(0, 2).map((r) => `"${r}"`);
          res = { pass: false, msg: `Close. ${kept.length ? `Your line also keeps postings whose role only looks like yours: ${kept.join(" and ")}` : "Your line gives a different answer when a few look-alike postings are added"} (we tested it with a few made-up roles). The filter should keep a job only when its role is exactly your career.` };
        }
      }
    }
    if (res.pass && ch.level === 3) {
      // Prove the line really sorts: flip the counts upside down and run it again.
      const flipped = flippedCounts(state.results[2].ranked);
      const rep3 = await py.run(compose(3, line, undefined, flipped));
      if (!rep3.ok && ["setup", "timeout"].includes(rep3.kind)) { const e = friendlyError(rep3, 3); showFeedback("err", e.title, e.detail, { tech: e.tech }); return; }
      if (!rep3.ok || !followsFlip(rep3.top, flipped))
        res = { pass: false, msg: "Your line gives the right names, but it isn't ranking by the numbers in counts, your Level 2 tally: when those numbers change, your answer doesn't. Let sorted() rank the counts, then take the first three." };
    }
    // Level 1: a career typed in quotes (the most common beginner try). Say exactly what's off with that text,
    // then point at line 1, without writing the line for them.
    const typed = ch.level === 1 && !res.pass && !untouched ? (line.match(/==\s*(["'])(.*?)\1/) || [])[2] : undefined;
    if (typed != null && typed !== state.role) {   // their own career, typed exactly, already gets the "if a friend picked…" message
      const known = CAREERS.map((c) => c.id).find((r) => r.toLowerCase() === typed.trim().toLowerCase());
      const what = !known ? `No posting's role is exactly "${typed}", so your filter keeps nothing.`
        : known !== typed ? `Python is picky about capital letters: "${typed}" isn't the same as "${known}", so nothing matches.${known !== state.role ? ` It's also a different career: line 1 says yours is ${state.role}.` : ""}`
        : `"${typed}" is a different career: line 1 says yours is ${state.role}.`;
      res = { pass: false, msg: `${what} Instead of typing a career in quotes, use the name line 1 gave your career, with no quotes, like FAVORITE in the example.` };
    }
    if (!res.pass) {
      if (untouched) showFeedback("warn", "That's what the code does right now.", `${res.msg} Change the highlighted line (line ${EDIT_LINE[ch.level]}), then press Run again.`);
      else { showFeedback("warn", "Not quite yet.", ch.level === 3 && Array.isArray(rep.top) ? `${res.msg} Right now top_skills is: ${rep.top.slice(0, 6).join(", ") || "empty"}${rep.top.length > 6 ? ", and more" : ""}.` : res.msg); failed(ch); }
      return;
    }
    state.lines[ch.level] = line.replace(/^\s+/, "");
    await succeed(ch, res.result);
  } catch (err) {
    showFeedback("err", "Something went wrong checking that line.", "Click Reset line, make one small change, and run it again. If it keeps happening, raise your hand.", { tech: String(err?.message || err) });
  } finally {
    running = false;
    const ed = $("#edit-line"); if (ed && !state.solved[ch.level]) ed.readOnly = false;
    const r = $("#run");
    if (r && !state.solved[ch.level]) { r.classList.remove("is-running"); r.disabled = py.status !== "ready"; r.querySelector("span").textContent = py.status === "ready" ? "Run" : "Loading…"; }
  }
}
function failed(ch) {
  state.fails[ch.level] = (state.fails[ch.level] || 0) + 1; save();
  renderStuck(ch);   // the first time it appears, it scrolls the feedback and its explanation into view
}
async function succeed(ch, result, { helped = false } = {}) {
  const before = points();
  state.solved[ch.level] = true;
  if (helped) state.helped[ch.level] = true;
  state.results[ch.level] = result;
  state.dataMode ||= DATA.mode;
  state.selected = ch.unlocks;
  save();
  const input = $("#edit-line");
  if (input) { input.readOnly = true; input.closest(".ln-edit").classList.add("is-solved"); }
  const runBtn = $("#run");
  if (runBtn) { runBtn.classList.remove("is-running"); runBtn.disabled = true; runBtn.querySelector("svg")?.replaceWith(Object.assign(document.createElement("span"), { innerHTML: CHECK }).firstElementChild); runBtn.querySelector("span").textContent = helped ? "Unlocked" : "Fixed"; }
  ["#clue", "#reset", "#help-unlock"].forEach((sel) => { const x = $(sel); if (x) x.disabled = true; });
  runBtn?.classList.add("is-done"); $("#clue-slot")?.setAttribute("hidden", ""); $("#help-slot")?.setAttribute("hidden", "");
  $("#stuck") && ($("#stuck").innerHTML = "");
  showFeedback("ok", helped ? "Unlocked with help." : "It works!", "Watch your city.");
  renderIsland({ hold: ch.unlocks }); renderDetail(); renderHud(); tickPoints(before, points());
  const label = BUILDINGS.find((b) => b.key === ch.unlocks).label;
  if (singleColumn()) $(`.bldg[data-key="${ch.unlocks}"]`)?.scrollIntoView({ block: "center", behavior: reduceMotion() ? "auto" : "smooth" });
  const pop = { 1: `${result.n} postings`, 2: `${prettySkill(result.ranked?.[0]?.[0] || "")}: ${result.ranked?.[0]?.[1] ?? ""}`, 3: (() => { const t = (result.top || []).filter((s, i) => result.counts?.[i] === result.counts?.[0]).map(prettySkill); return t.length > 1 ? `Tie: ${t.slice(0, -1).join(", ")} and ${t.at(-1)}` : `Top: ${prettySkill(result.top?.[0] || "")}`; })() }[ch.level];
  await raise(ch.unlocks, { pop });
  await wait(reduceMotion() ? 150 : singleColumn() ? 900 : 650);
  state.phase = "unlocked"; save(); renderLeft();
  $("#unlock-h1")?.focus();
  announce(`${label} unlocked. ${helped ? "Unlocked with help." : `Plus ${ch.points} points.`}`);
  if (!reduceMotion()) $(".unlock-banner .badge")?.animate([{ transform: "scale(0.7) rotate(-6deg)", opacity: 0.4 }, { transform: "scale(1.08)", opacity: 1, offset: 0.6 }, { transform: "none" }], { duration: 560, easing: EASE });
  const pill = $("#plus");
  if (pill && !helped && !reduceMotion()) {
    const t0 = performance.now();
    const tick = (t) => { const p = Math.min(1, (t - t0) / 600); pill.textContent = `+${Math.round(ch.points * (1 - Math.pow(1 - p, 3)))} points`; if (p < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    pill.animate([{ transform: "scale(0.85)" }, { transform: "scale(1.08)", offset: 0.6 }, { transform: "scale(1)" }], { duration: 600, easing: EASE });
  }
}
// A stuck student can keep building: the result is computed here, not by revealing the fixed line.
function helpUnlock(ch) {
  if (state.solved[ch.level]) return;
  const mine = DATA.byRole[state.role] || [];
  let result;
  if (ch.level === 1) {
    const alt = altRole();
    result = { n: mine.length, total: DATA.jobs.length, role: state.role, titles: [...new Set(mine.map((j) => j.title))].slice(0, 6), alt, altN: alt ? DATA.byRole[alt].length : 0 };
  } else if (ch.level === 2) {
    const c = {};
    for (const j of mine) for (const s of j.skills) c[s] = (c[s] || 0) + 1;
    result = { n: mine.length, mentions: mine.reduce((a, j) => a + j.skills.length, 0), ranked: ranked(c) };
  } else {
    const top = state.results[2].ranked.slice(0, 3);
    result = { top: top.map(([s]) => s), counts: top.map(([, c]) => c) };
  }
  succeed(ch, result, { helped: true });
}

// What the code produced, in plain words (no unexplained >>> notation).
function showOutput(level, rep) {
  let out = "";
  if (rep.ok) {
    if (level === 1 && rep.matched) out = `Postings your filter kept: ${rep.matched.n ?? "?"} (goal: ${(DATA.byRole[state.role] || []).length})`;
    if (level === 2 && rep.counts) {
      const nums = ranked(rep.counts), odd = Object.values(rep.counts).some((v) => v === null);
      const top = nums.slice(0, 4).map(([k, v]) => `${k} ${v}`).join(", ");
      out = nums.length && nums.every(([, v]) => v === 0) ? `Skill counts: every count is still 0 (${nums.length} skills found).` : odd && !nums.length ? "Skill counts: the totals aren't plain numbers." : `Skill counts (biggest first): ${top}${nums.length > 4 ? ", …" : ""}${odd ? " (some totals aren't plain numbers)" : ""}`;
    }
    if (level === 3) {
      const t = Array.isArray(rep.top) ? rep.top : null, more = t && t.length > 6 ? `, … and ${t.length - 6} more` : "";
      out = t && t.length > 6 ? `print(top_skills) showed ${t.length} skills: ${t.slice(0, 6).join(", ")}${more}` : `print(top_skills) showed: ${rep.stdout.trim()}`;
      if (t && rep.counts) out += `\nTheir counts: ${t.slice(0, 6).map((s) => rep.counts[s] ?? "?").join(", ")}${more ? ", …" : ""}`;
    }
  } else if (rep.stdout) out = `Printed before the error: ${rep.stdout.trim()}`;
  let box = $("#output");
  if (!out) { box?.remove(); return; }
  if (out.length > 320) out = out.slice(0, 320) + " …";   // keep the pinned code area small
  if (!box) { box = Object.assign(document.createElement("div"), { id: "output", className: "output" }); $(".code-panel").append(box); }
  box.innerHTML = `<span class="out-lbl">What happened</span><pre>${esc(out)}</pre>`;
}
function showFeedback(kind, title, detail, { retry, tech } = {}) {
  const el = $("#feedback");
  if (!el) return;
  el.dataset.kind = kind;
  el.innerHTML = `<p class="fb-title">${esc(title)}</p>${detail ? `<p>${esc(detail)}</p>` : ""}${tech ? `<p class="fb-tech">${esc(tech)}</p>` : ""}${retry ? `<button type="button" class="btn-small fb-retry">Try again</button>` : ""}`;
  el.querySelector(".fb-retry")?.addEventListener("click", () => py.retryNow());
  if (kind !== "wait" && !(kind === "ok" && singleColumn())) requestAnimationFrame(() => {
    const w = $(".work");
    if (w) $("#left").style.setProperty("--work-h", `${Math.ceil(w.getBoundingClientRect().height)}px`);
    reveal(el);
  });
  if (!reduceMotion()) el.animate([{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }], { duration: 180, easing: EASE });
}

/* ---------- the unlock moment: the stone building sinks, the real one rises from the ground ---------- */
const ROOF_Y = { summary: 38, explorer: 52, chart: 40, strategy: 8, built: 30 }; // top of each drawing, in its 182-unit box
// The result bubble stays centered on its own building, just above the roof. When the scene has no room
// above the roof, it rises into the strip above the scene instead of sliding onto a neighbor.
function placePop(b, el, key) {
  const host = $("#scene").closest(".right") || $("#scene"), hr = host.getBoundingClientRect(), vr = el.querySelector(".b-art").getBoundingClientRect();
  const k = Math.min(vr.width / 130, vr.height / 182), roof = vr.bottom - k * (182 - ROOF_Y[key]);
  host.querySelectorAll(".b-pop").forEach((x) => x.remove());   // one result bubble at a time, so two never overlap
  host.append(b);
  const half = b.offsetWidth / 2, x = vr.left - hr.left + vr.width / 2;
  b.style.left = `${Math.min(Math.max(x, half + 4), hr.width - half - 4)}px`;
  const head = host.querySelector(".port-head"), floor = head ? head.getBoundingClientRect().bottom - hr.top + 4 : 4;
  b.style.top = `${Math.max(floor + b.offsetHeight, roof - hr.top - 8)}px`;   // never over the player's name and career line
}
async function raise(key, { celebrate, pop } = {}) {
  const el = $(`.bldg[data-key="${key}"]`);
  if (!el) return;
  const b = BUILDINGS.find((x) => x.key === key);
  const swap = () => {
    el.dataset.state = "open";
    el.setAttribute("aria-label", `${b.short}: ${b.label}`);
    el.innerHTML = bldgInner(b, "open");
  };
  if (reduceMotion()) {
    swap(); el.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 300 });
    if (pop) {
      const b = Object.assign(document.createElement("span"), { className: "b-pop", textContent: pop });
      b.setAttribute("aria-hidden", "true"); placePop(b, el, key);
      b.animate([{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.9 }, { opacity: 0 }], { duration: 2600, fill: "both" }).finished.then(() => b.remove());
    }
    return;
  }
  await el.querySelector(".b-art svg").animate([{ transform: "translateY(0)" }, { transform: "translateY(104%)" }], { duration: 240, easing: "cubic-bezier(0.5, 0, 0.75, 0)", fill: "forwards" }).finished;
  swap();
  const svg = el.querySelector(".b-art svg");
  const rise = svg.animate([
    { transform: "translateY(104%)" },
    { transform: "translateY(-5%)", offset: 0.72 },
    { transform: "translateY(0)" },
  ], { duration: 820, easing: EASE });
  el.querySelector(".b-glow").animate([{ opacity: 0, transform: "scale(0.6)" }, { opacity: 0.95, transform: "scale(1)", offset: 0.45 }, { opacity: 0, transform: "scale(1.15)" }], { duration: 1300, easing: "ease-out" });
  el.querySelector(".b-sign").animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 380, delay: 520, easing: EASE, fill: "backwards" });
  dust(el);
  setTimeout(() => confetti(el, 34), 420);
  if (pop) {
    const b = Object.assign(document.createElement("span"), { className: "b-pop", textContent: pop });
    b.setAttribute("aria-hidden", "true");
    placePop(b, el, key);
    b.animate([{ opacity: 0, transform: "translateY(10px) scale(0.92)" }, { opacity: 1, transform: "none", offset: 0.15 }, { opacity: 1, transform: "none", offset: 0.85 }, { opacity: 0, transform: "translateY(-6px)" }],
      { duration: 2600, delay: 600, easing: EASE, fill: "both" }).finished.then(() => b.remove());
  }
  await rise.finished;
  if (celebrate) celebrateCity();
}
function dust(el) {
  const scene = $("#scene"), a = el.querySelector(".b-art").getBoundingClientRect(), h = scene.getBoundingClientRect();
  for (let i = 0; i < 12; i++) {
    const p = Object.assign(document.createElement("span"), { className: "dust" });
    const size = 10 + Math.random() * 16;
    const x = a.left - h.left + a.width * (0.1 + 0.8 * Math.random()), y = a.bottom - h.top - 6 - Math.random() * 10;
    p.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size}px`;
    scene.append(p);
    const dx = (x - (a.left - h.left + a.width / 2)) * (0.5 + Math.random() * 0.6), dy = -(8 + Math.random() * 22);
    p.animate([{ transform: "translate(-50%,-50%) scale(0.5)", opacity: 0.9 }, { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1.4)`, opacity: 0 }],
      { duration: 650 + Math.random() * 400, easing: "cubic-bezier(0.2, 0.7, 0.4, 1)" }).finished.then(() => p.remove());
  }
}
function confetti(anchor, count = 20) {
  const scene = $("#scene");
  const a = anchor.querySelector(".b-art").getBoundingClientRect(), h = scene.getBoundingClientRect();
  const cx = a.left - h.left + a.width / 2, cy = a.top - h.top + a.height * 0.5;
  const colors = ["var(--c-yellow)", "var(--c-green)", "var(--c-blue)", "var(--c-orange)", "var(--c-teal)"];
  for (let i = 0; i < count; i++) {
    const p = document.createElement("span");
    p.className = "confetti";
    p.style.cssText = `left:${cx}px;top:${cy}px;background:${colors[i % colors.length]}`;
    scene.append(p);
    const ang = (-150 + Math.random() * 120) * (Math.PI / 180); // an upward pop, not a ring
    const v = (a.height * 0.45) + Math.random() * a.height * 0.5;
    const room = Math.max(24, cy - 18) * (0.55 + Math.random() * 0.45); // each piece peaks inside the scene, at its own height
    const dx = Math.cos(ang) * v, up = -Math.min(-Math.sin(ang) * v, room);
    const spin = (Math.random() - 0.5) * 720;
    p.animate([
      { transform: "translate(-50%,-50%) rotate(0deg)", opacity: 1 },
      { transform: `translate(calc(-50% + ${dx * 0.7}px), calc(-50% + ${up}px)) rotate(${spin / 2}deg)`, opacity: 1, offset: 0.45 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${up + 140}px)) rotate(${spin}deg)`, opacity: 0 },
    ], { duration: 1000 + Math.random() * 300, easing: "cubic-bezier(0.3, 0.6, 0.5, 1)" }).finished.then(() => p.remove());
  }
}
function celebrateCity() {
  if (reduceMotion()) return;
  $$(".bldg").forEach((el, i) => {
    el.querySelector(".b-art svg").animate([{ transform: "translateY(0)" }, { transform: "translateY(-7%)", offset: 0.4 }, { transform: "translateY(0)" }], { duration: 520, delay: i * 90, easing: EASE });
    setTimeout(() => confetti(el, 10), 200 + i * 90);
  });
}

/* ---------- the game font, embedded in downloaded portfolios ---------- */
let FONT = "";
fetch("vendor/fonts/nunito-latin.woff2").then((r) => r.blob()).then((b) => new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); })).then((d) => (FONT = d)).catch(() => {});
const page = (opts) => portfolioHtml(state, DATA, { ...opts, font: FONT });

/* ---------- length limits: said out loud near the end, never a silent stop ---------- */
function limitNote(f) {
  if (!(f instanceof HTMLInputElement || f instanceof HTMLTextAreaElement) || !(f.maxLength > 0) || ["player-id", "edit-line"].includes(f.id)) return;
  const anchor = f.closest(".add-skill") || f, left = f.maxLength - f.value.length, near = Math.max(8, Math.round(f.maxLength * 0.12));
  let n = anchor.nextElementSibling?.classList.contains("limit") ? anchor.nextElementSibling : null;
  if (left > near) { if (n) n.hidden = true; delete f.dataset.atMax; return; }
  if (!n) { n = Object.assign(document.createElement("span"), { className: "limit", id: `${f.id}-limit` }); anchor.after(n); }
  n.hidden = false; n.classList.toggle("at-max", left <= 0);
  n.textContent = left > 0 ? `${left} character${left === 1 ? "" : "s"} left` : `That's the limit: ${f.maxLength} characters.`;
  if (left <= 0 && !f.dataset.atMax) { f.dataset.atMax = "1"; announce(n.textContent); }
}
document.addEventListener("input", (e) => limitNote(e.target));

/* ---------- drafts ---------- */
function saveDraft() {
  if (!state.role || !DATA) { toast("Pick a career first."); return; }
  const full = state.builtSaved && state.phase === "showcase";
  download(`career-portfolio-${state.playerId}${full ? "" : "-draft"}.html`, page({ draft: !full }));
  toast(full ? "Portfolio saved to your Downloads folder." : "Draft saved to your Downloads folder.");
}

/* ---------- one tab at a time ---------- */
let otherTabOpen = false;
let updateDecided = Promise.resolve();
let claimTab = () => {};
// Another tab may have saved newer progress since this one opened: read it again before acting on it.
function freshState() {
  if (paused || store.get(STORE) == null) return;
  const screen = state.screen; state = loadState(); state.screen = screen;
}
function guardTabs() {
  // A tab waiting on the title keeps up with progress saved in another tab, so its Continue button is never stale.
  addEventListener("storage", (e) => {
    if ((e.key !== STORE && e.key !== null) || paused || state.screen !== "title") return;
    freshState();
    const busy = pendingId || document.activeElement === $("#player-id") || (!$(".title-form").hidden && !$("#title-continue").hidden);
    if (!busy) renderTitle();   // Start and Continue read the latest progress anyway; just don't redraw under someone typing
  });
  if (!("BroadcastChannel" in window)) return;
  const me = Math.random().toString(36).slice(2), ch = new BroadcastChannel("career-quest");
  const note = $("#tab-note");
  ch.onmessage = (e) => {
    const m = e.data || {};
    if (m.from === me) return;
    if (m.type === "hello") ch.postMessage({ type: "here", from: me });
    if (m.type === "hello" || m.type === "here") { note.hidden = false; otherTabOpen = true; }
    if (m.type === "bye" && !paused) note.hidden = true;
    if (m.type === "bye" && paused) note.querySelector("p").textContent = "The other Career Quest tab was closed. Press Play in this tab to keep going here with your latest progress.";
    if (m.type === "takeover") { paused = true; document.body.dataset.paused = "1"; $("main").inert = true; $("#hud").inert = true; note.hidden = false; note.querySelector("p").textContent = "Career Quest is now open in another tab, so this tab is paused to protect your progress."; }
  };
  ch.postMessage({ type: "hello", from: me });
  addEventListener("pagehide", () => ch.postMessage({ type: "bye", from: me }));
  // Whichever tab enters the game becomes the one that plays: any other open tab pauses and stops saving.
  claimTab = () => { ch.postMessage({ type: "takeover", from: me }); if (!paused) note.hidden = true; };
  $("#tab-here").addEventListener("click", () => {
    paused = false; delete document.body.dataset.paused; claimTab();
    $("main").inert = false; $("#hud").inert = false; note.hidden = true;
    state = loadState();
    if (state.playerId && state.role) enterGame(); else { show("title"); renderTitle(); }
  });
}

/* ---------- boot ---------- */
function boot() {
  // The top bar can wrap to two rows on mid-size screens; the game area sizes itself from its real height.
  if ("ResizeObserver" in window) new ResizeObserver(([e]) => document.documentElement.style.setProperty("--hud-real", `${Math.ceil(e.target.getBoundingClientRect().height)}px`)).observe($("#hud"));
  // Say so up front when this browser can't save, instead of promising it does.
  if (!store.set("career-quest.probe", "1")) $("#save-claim").textContent = "No account. No resume. Hints are free. This browser can't save progress, so keep this tab open.";
  else store.remove("career-quest.probe");
  $("#save-note-ok").addEventListener("click", () => { $("#save-note").hidden = true; });
  $("#detail").addEventListener("scroll", fadeDetail, { passive: true });
  addEventListener("resize", fadeDetail);
  // Decorative city on the title card, and the island scene in the game.
  $("#hero-scene").innerHTML = sceneHtml(BUILDINGS.map((b) => `<span class="bldg b-${b.key}" data-state="open"><span class="b-art">${buildingSvg(b.key)}</span></span>`).join(""));
  $("#scene").innerHTML = sceneHtml("", { id: "island", label: "Your portfolio city" });
  $("#start-btn").addEventListener("click", startQuest);
  $("#player-id").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); startQuest(); } });
  $("#title-continue-btn").addEventListener("click", async () => {
    // Another tab may have changed who is playing on this laptop since the title was drawn: show the latest instead.
    const was = state.playerId; freshState();
    if (!state.role || state.playerId !== was) { renderTitle(); (state.role ? $("#title-continue-btn") : $("#player-id")).focus(); return; }
    try { sessionStorage.setItem("cq-continue", "1"); } catch {}
    await dataReady; await Promise.race([updateDecided, wait(1500)]);
    updateDecided.then(() => { try { sessionStorage.removeItem("cq-continue"); } catch {} });  // settles only if no reload is coming
    if (DATA) enterGame();
  });
  $("#title-new").addEventListener("click", () => { $(".title-form").hidden = false; $("#title-new").hidden = true; $("#player-id").focus(); });
  $("#title-restart").addEventListener("click", async (e) => {
    if (!arm(e.currentTarget, "Click again to erase DEMO's progress")) return;
    disarm(e.currentTarget);
    freshState();
    if (state.playerId !== "DEMO") { renderTitle(); return; }   // another tab switched players: show that instead
    await dataReady; if (!DATA) return;
    state = { ...fresh(), playerId: "DEMO" }; store.remove("career-quest.data");
    enterGame();
    announce("Started over as DEMO.");
  });
  $("#player-id").addEventListener("input", () => { pendingId = ""; $("#player-id-err").hidden = true; });
  $("#btn-draft").addEventListener("click", saveDraft);
  const resume = !!(state.playerId && state.role);
  renderTitle();
  show("title");
  (resume ? $("#title-continue-btn") : $("#player-id")).focus();
  let pendingContinue = false;
  try { pendingContinue = sessionStorage.getItem("cq-continue") === "1"; sessionStorage.removeItem("cq-continue"); } catch {}
  if (pendingContinue && resume) dataReady.then(() => { if (DATA && state.screen === "title") enterGame(); });
  guardTabs();
  dataReady.then(() => {
    if (!DATA) {
      const msg = "The game files didn't load. Check the Wi-Fi, then refresh the page.";
      const err = $("#player-id-err"); err.textContent = msg; err.hidden = false;
      const c = $("#title-continue"); if (c && !c.hidden) { const p = c.querySelector(".err") || c.appendChild(Object.assign(document.createElement("p"), { className: "err" })); p.setAttribute("role", "alert"); p.textContent = msg; }
      return;
    }
    $("#data-badge").textContent = dataWords(DATA.mode).badge;
    startPython();
  });
  // Keep a copy on this laptop so the game survives bad Wi-Fi.
  if (swReg) {
    swReg.catch(() => {});
    // A newer version saved on a past visit takes over now, while the title is showing, then the page reloads once.
    updateDecided = swReg.then(async (reg) => {
      if (!reg.waiting || !navigator.serviceWorker.controller) return;
      await wait(500);                 // give the tab guard time to hear from any other open tab
      if (otherTabOpen) return;        // another tab is running this version: wait until it closes
      navigator.serviceWorker.addEventListener("controllerchange", () => location.reload(), { once: true });
      reg.waiting.postMessage("skip-waiting");
      await wait(4000);                // the page reloads before this ends
    }).catch(() => {});
    try {
      const check = async () => { $("#offline-note").hidden = !(await allSaved()); };
      py.listeners.add((s) => { if (s === "ready") check(); });   // files saved late (on first use) count too
      navigator.serviceWorker.ready.then(check).catch(() => {});
      navigator.serviceWorker.addEventListener("message", (e) => { if (e.data === "cached") check(); });
    } catch {}
  }
}
boot();
