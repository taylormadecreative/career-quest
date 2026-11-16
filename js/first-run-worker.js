// Runs First Run programs in a worker using the same local Pyodide as the original game.
// The page owns the startup/run timeout and terminates this worker if execution hangs.
const PYODIDE = new URL("../vendor/pyodide/", self.location).href;
importScripts("saved-files.js");
const files = Object.fromEntries(Object.entries(self.CQ_SAVED.files)
  .filter(([name]) => name.startsWith("vendor/pyodide/"))
  .map(([name, meta]) => [name.slice("vendor/pyodide/".length), meta.sha256]));
const hex = (buffer) => [...new Uint8Array(buffer)].map((n) => n.toString(16).padStart(2, "0")).join("");

const RUNNER = String.raw`
import json, io, traceback, contextlib, builtins, sys, types

_cq_builtins = dict(builtins.__dict__)
_cq_import_real = builtins.__import__
_cq_allowed = {"math", "collections", "statistics", "itertools", "functools", "operator", "string", "re", "random", "html", "json", "dataclasses", "datetime", "zipfile", "io"}
_cq_bridge = ("js", "pyodide", "pyodide_js", "_pyodide", "pyodide.ffi", "pyodide.code", "micropip")
# The interpreter lives across runs. Save each allowed module's own bindings so
# an accidental assignment in one exercise cannot change future checks.
_cq_modules = [(_cq_import_real(name), None) for name in sorted(_cq_allowed)]
_cq_modules = [(module, dict(module.__dict__)) for module, _ in _cq_modules]

def _cq_restore_modules():
    for module, original in _cq_modules:
        namespace = module.__dict__
        for key in [key for key in namespace if key not in original]:
            del namespace[key]
        for key, value in original.items():
            if namespace.get(key) is not value:
                namespace[key] = value

def _cq_import(name, *args, **kwargs):
    if name.split(".")[0] not in _cq_allowed:
        raise ImportError("The game doesn't allow importing " + name + " here.")
    return _cq_import_real(name, *args, **kwargs)

def _cq_stop(*args):
    raise SystemExit(*args)

class _CqOutput(io.StringIO):
    def write(self, text):
        if self.tell() + len(text) > 20000:
            raise RuntimeError("Output is too long. Check for a repeating loop.")
        return super().write(text)

def _cq_run(src):
    safe = dict(_cq_builtins)
    safe.update({"__import__": _cq_import, "exit": _cq_stop, "quit": _cq_stop})
    module = types.ModuleType("__student__")
    namespace = module.__dict__
    namespace["__builtins__"] = safe
    try:
        code = compile(src, "<your code>", "exec")
    except SyntaxError as e:
        return {"ok": False, "kind": "syntax", "name": type(e).__name__, "msg": e.msg,
                "line": e.lineno, "text": (e.text or "").strip(), "stdout": ""}
    out = _CqOutput()
    hidden = {m: sys.modules.get(m) for m in _cq_bridge}
    previous_student = sys.modules.get("__student__")
    try:
        sys.modules["__student__"] = module
        for m in _cq_bridge:
            sys.modules[m] = None
        with contextlib.redirect_stdout(out):
            exec(code, namespace)
    except BaseException as e:
        frames = traceback.extract_tb(e.__traceback__)
        line = next((f.lineno for f in reversed(frames) if f.filename == "<your code>"), None)
        return {"ok": False, "kind": "runtime", "name": type(e).__name__, "msg": str(e),
                "line": line, "stdout": out.getvalue()[:2000]}
    finally:
        if previous_student is None:
            sys.modules.pop("__student__", None)
        else:
            sys.modules["__student__"] = previous_student
        for m, mod in hidden.items():
            if mod is None:
                sys.modules.pop(m, None)
            else:
                sys.modules[m] = mod
        for k in [k for k in builtins.__dict__ if k not in _cq_builtins]:
            del builtins.__dict__[k]
        for k, v in _cq_builtins.items():
            builtins.__dict__[k] = v
        _cq_restore_modules()
    return {"ok": True, "stdout": out.getvalue()[:2000]}

def _cq_runs(sources_json):
    return json.dumps({"runs": [_cq_run(src) for src in json.loads(sources_json)]})
`;

let py = null;
let ready = null;
const fail = (error) => self.postMessage({ type: "fatal", error: String(error) });
self.addEventListener("unhandledrejection", (event) => fail(event.reason?.message || event.reason));
self.addEventListener("error", (event) => fail(event.message));

async function start(verify) {
  if (typeof WebAssembly !== "object") throw new Error("no-wasm");
  if (verify) {
    for (const [name, want] of Object.entries(files)) {
      const response = await fetch(PYODIDE + name);
      if (!response.ok || hex(await crypto.subtle.digest("SHA-256", await response.arrayBuffer())) !== want)
        throw new Error(`bad-file:${name}`);
    }
  } else {
    const response = await fetch(PYODIDE + "pyodide.asm.wasm");
    if (!response.ok || !response.body) throw new Error("bad-file:pyodide.asm.wasm");
    const reader = response.body.getReader();
    const first = (await reader.read()).value;
    reader.cancel().catch(() => {});
    if (!first || first.length < 4 || first[0] !== 0 || first[1] !== 97 || first[2] !== 115 || first[3] !== 109)
      throw new Error("bad-file:pyodide.asm.wasm");
  }
  try { importScripts(PYODIDE + "pyodide.js"); } catch { throw new Error("bad-file:pyodide.js"); }
  py = await loadPyodide({ indexURL: PYODIDE });
  py.runPython(RUNNER);
}

self.onmessage = async ({ data: message }) => {
  try {
    if (message.type === "init") ready ||= start(!!message.verify);
    if (!ready) throw new Error("not started");
    await ready;
    if (message.type === "init") {
      self.postMessage({ type: "ready" });
    } else if (message.type === "run") {
      if (!Array.isArray(message.sources) || !message.sources.length || message.sources.length > 8 ||
          message.sources.some((s) => typeof s !== "string" || s.length > 20000)) throw new Error("invalid programs");
      const result = py.globals.get("_cq_runs")(JSON.stringify(message.sources));
      self.postMessage({ type: "result", id: message.id, token: message.token, data: JSON.parse(result) });
    }
  } catch (error) {
    self.postMessage({ type: "fatal", id: message.id, error: String(error?.message || error) });
  }
};
