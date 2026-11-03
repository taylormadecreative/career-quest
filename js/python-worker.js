// Runs student Python in Pyodide (CPython compiled to WebAssembly) inside a Web Worker,
// so a mistake can never freeze the page. The page kills and restarts this worker on a timeout or crash.
// Pyodide 0.28.3 is hosted with the game (vendor/pyodide) so school web filters and bad Wi-Fi
// can't block it; the service worker keeps a copy on each laptop after the first visit.
const PYODIDE = new URL("../vendor/pyodide/", self.location).href;
// When the page says Python is saved on this laptop (verify: true in the init message), every file is checked against its
// SHA-256 fingerprint before use, so a damaged saved copy is caught in a second instead of hanging.
// The fingerprints come from js/saved-files.js, the one list the page and the service worker use too.
importScripts("saved-files.js");
const PYODIDE_SHA256 = Object.fromEntries(Object.entries(self.CQ_SAVED.files)
  .filter(([k]) => k.startsWith("vendor/pyodide/")).map(([k, f]) => [k.slice("vendor/pyodide/".length), f.sha256]));
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

const RUNNER = String.raw`
import json, copy, io, traceback, contextlib, builtins, math, sys
from collections import Counter

__cq_jobs = None
__cq_builtins = dict(builtins.__dict__)
__cq_isfinite = math.isfinite
# The runner's own tools are pinned here, and the modules students may import are put back after each run,
# so a line like math.isfinite = ... can't change how the next run is checked.
__cq_mods = {m: dict(m.__dict__) for m in [__import__(n) for n in ("math", "collections", "statistics", "itertools", "functools", "operator", "string", "re", "random")]}

def __cq_load(jobs_json):
    global __cq_jobs
    __cq_jobs = json.loads(jobs_json)

def __cq_restore():
    # Undo anything a student's line changed about Python's built-in functions and the shared modules.
    for d, saved in [(builtins.__dict__, __cq_builtins)] + [(m.__dict__, snap) for m, snap in __cq_mods.items()]:
        for k in [k for k in d if k not in saved]:
            del d[k]
        for k, v in saved.items():
            if d.get(k) is not v:
                d[k] = v

def __cq_run(src):
    try:
        return __cq_exec(src)
    finally:
        __cq_restore()

def __cq_stop(*a):
    raise SystemExit(*a)

def __cq_num(v):
    # counts must be plain finite numbers; NaN, infinity and booleans are reported as None
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        return None
    return v if __cq_isfinite(v) else None

__cq_allowed = {"math", "collections", "statistics", "itertools", "functools", "operator", "string", "re", "random"}
__cq_real_import = builtins.__import__

# A guard rail, NOT a security boundary. Python can't be sandboxed inside its own interpreter: even the
# allowed modules lead back to sys and this runner (for example collections._sys). It exists to stop
# honest mistakes and casual tinkering. Points live on the student's own laptop anyway, so never rely on
# this to protect anything.
__cq_bridge = ("js", "pyodide", "pyodide_js", "_pyodide", "pyodide.ffi", "pyodide.code", "micropip")

def __cq_import(name, *a, **k):
    # Student code may import plain helper modules, but not the parts of Python that reach the game itself.
    if name.split(".")[0] not in __cq_allowed:
        raise ImportError(f"The game doesn't allow importing {name} here.")
    return __cq_real_import(name, *a, **k)

def __cq_exec(src):
    # Student code gets its own copy of Python's built-in functions: exit() and quit() only stop the
    # student's code, and imports are limited to plain helper modules.
    safe = dict(__cq_builtins)
    safe.update({"__import__": __cq_import, "exit": __cq_stop, "quit": __cq_stop})
    given = copy.deepcopy(__cq_jobs)
    # Each posting the student keeps is matched back to the untouched data by identity, so editing a
    # posting's role or title inside the line can't change what gets checked or shown on the portfolio.
    keep = list(given)
    where = {id(j): i for i, j in enumerate(keep)}
    ns = {"JOBS": given, "__name__": "__student__", "__builtins__": safe}
    try:
        code = compile(src, "<your code>", "exec")
    except SyntaxError as e:
        return json.dumps({"ok": False, "kind": "syntax", "msg": e.msg, "line": e.lineno, "text": (e.text or "").strip()})
    out = io.StringIO()
    hidden = {m: sys.modules.get(m) for m in __cq_bridge}
    try:
        for m in __cq_bridge:
            sys.modules[m] = None  # while student code runs, these can't be imported by any route
        with contextlib.redirect_stdout(out):
            exec(code, ns)
    except BaseException as e:
        tb = traceback.extract_tb(e.__traceback__)
        line = next((f.lineno for f in reversed(tb) if f.filename == "<your code>"), None)
        return json.dumps({"ok": False, "kind": "runtime", "name": type(e).__name__, "msg": str(e), "line": line, "stdout": out.getvalue()[:2000]})
    finally:
        for m, mod in hidden.items():
            if mod is None:
                sys.modules.pop(m, None)
            else:
                sys.modules[m] = mod
    rep = {"ok": True, "stdout": out.getvalue()[:2000]}
    mj = ns.get("matched_jobs")
    if mj is not None:
        if isinstance(mj, list):
            real = [__cq_jobs[where[id(j)]] if id(j) in where else None for j in mj]
            # a made-up look-alike posting (Level 1's extra check) is named by its own role, so feedback can quote it
            roles = dict(Counter(j["role"] if j else (lambda r: r[:60] if type(r) is str else "?")(dict.get(o, "role") if isinstance(o, dict) else None) for o, j in zip(mj, real)))
            seen = [id(j) for j in mj if id(j) in where]
            rep["matched"] = {"n": len(mj), "roles": roles, "dupes": len(seen) - len(set(seen)),
                              "titles": [j["title"] for j in real if j][:40],
                              "mentions": sum(len(j["skills"]) for j in real if j)}
        else:
            rep["matched"] = {"bad_type": type(mj).__name__}
    sc = ns.get("counts")
    if sc is not None:
        if isinstance(sc, dict) and len(sc) > 5000:
            rep["counts_bad_type"] = "a dictionary with too many keys"
        elif isinstance(sc, dict):
            rep["counts"] = {str(k): __cq_num(v) for k, v in sc.items()}
        else:
            rep["counts_bad_type"] = type(sc).__name__
    ts = ns.get("top_skills")
    if ts is not None:
        rep["top"] = [str(x) for x in ts] if isinstance(ts, (list, tuple)) else None
        if not isinstance(ts, (list, tuple)):
            rep["top_bad_type"] = type(ts).__name__
    return json.dumps(rep, allow_nan=False, default=str)
`;

let py = null;
// Anything that goes wrong while Python starts is reported at once, so the page never waits on a hang.
const report = (error) => self.postMessage({ type: "fatal", error: String(error) });
self.addEventListener("unhandledrejection", (e) => report((e.reason && e.reason.message) || e.reason));
self.addEventListener("error", (e) => report(e.message));
// If the engine file is damaged, or its download breaks off, WebAssembly refuses it, but Pyodide then
// waits forever. Catch that and report it straight away: "bad-file" for a damaged file, "cut-off"
// for a download that stopped partway (a Wi-Fi drop).
for (const k of ["instantiate", "instantiateStreaming", "compile", "compileStreaming"]) {
  const orig = typeof WebAssembly === "object" && WebAssembly[k];
  if (orig) WebAssembly[k] = function (...a) {
    return orig.apply(this, a).catch((e) => {
      if (e instanceof WebAssembly.CompileError || e instanceof WebAssembly.LinkError) report("bad-file:pyodide.asm.wasm");
      else if (/network|abort|fetch|load/i.test(String(e && e.message))) report("cut-off");
      throw e;
    });
  };
}
// The flag comes in the first message, not the worker's address: a worker served from the
// service worker's saved copy takes that copy's address, which has no query string.
let ready = null;
const start = async (VERIFY) => {
  if (typeof WebAssembly !== "object") throw new Error("no-wasm");
  if (VERIFY) {
    for (const [name, want] of Object.entries(PYODIDE_SHA256)) {
      let bytes, ok;
      try { const r = await fetch(PYODIDE + name); ok = r.ok; bytes = await r.arrayBuffer(); } catch { throw new Error("cut-off"); }
      if (!ok || hex(await crypto.subtle.digest("SHA-256", bytes)) !== want) throw new Error(`bad-file:${name}`);
    }
  } else {
    // A first download isn't hashed twice; just make sure the engine really is WebAssembly
    // (it starts with the bytes 00 61 73 6d), not a web filter's "blocked" page.
    const r = await fetch(PYODIDE + "pyodide.asm.wasm");
    const reader = r.body && r.body.getReader();
    const first = reader ? (await reader.read()).value : null;
    reader?.cancel().catch(() => {});
    if (!r.ok || !first || first.length < 4 || first[0] !== 0x00 || first[1] !== 0x61 || first[2] !== 0x73 || first[3] !== 0x6d) throw new Error("bad-file");
  }
  try { importScripts(PYODIDE + "pyodide.js"); } catch { throw new Error("bad-file:pyodide.js"); }
  const load = loadPyodide({ indexURL: PYODIDE });
  // From a checked saved copy Python starts in seconds; if it doesn't, say so rather than wait.
  py = await (VERIFY ? Promise.race([load, new Promise((_, no) => setTimeout(() => no(new Error("load-timeout")), 30000))]) : load);
  py.runPython(RUNNER);
};

self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.type === "init") ready ||= start(!!m.verify);
    if (!ready) throw new Error("not started");
    await ready;
    if (m.type === "init") {
      py.globals.get("__cq_load")(m.jobsJson);
      self.postMessage({ type: "ready" });
    } else if (m.type === "run") {
      const res = py.globals.get("__cq_run")(m.src);
      // The page's token stays in this JS closure and is never handed to Python, so a stray message can't pass as a result.
      self.postMessage({ type: "result", id: m.id, token: m.token, data: JSON.parse(res) });
    }
  } catch (err) {
    self.postMessage({ type: "fatal", id: m.id, error: String((err && err.message) || err) });
  }
};
