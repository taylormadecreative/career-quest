// Quest 1.1 checks what Python prints for two different inputs, never code text.
// JSON text is safe for Python string literals: ASCII escaping avoids lone surrogate
// characters and also represents quotes, backslashes, emoji and line breaks reliably.
export function pythonString(value) {
  return JSON.stringify(String(value)).replace(/[\u007f-\uffff]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`)
    // Python treats a surrogate pair as two code points; combine pairs for non-BMP characters.
    .replace(/\\u(d[89ab][0-9a-f]{2})\\u(d[cdef][0-9a-f]{2})/gi, (_, hi, lo) => `\\U${(0x10000 + ((parseInt(hi, 16) - 0xd800) << 10) + parseInt(lo, 16) - 0xdc00).toString(16).padStart(8, "0")}`);
}
export function probeName(name) {
  return name === "Morgan Sample" ? "Avery Sample" : "Morgan Sample";
}
export function firstRunSources(name, expression) {
  return [name, probeName(name)].map((value) => `PROFILE_NAME = ${pythonString(value)}\nprint(${expression})\n`);
}
export function firstRunError(report) {
  if (!report) return "Python did not return a result. Try running again.";
  if (report.kind === "syntax") {
    if (/string|quote/i.test(report.msg || "")) return "Python could not find both quotation marks around some text. Check that each opening quote has a matching closing quote.";
    return "Python could not read the instruction. Check the spelling, quotation marks, and parentheses, then try again.";
  }
  if (report.name === "NameError") return "Python does not recognize one of the names. Check its spelling and capital letters.";
  return "Python stopped while running this instruction. Check the expression in the blank and try again.";
}
export function checkFirstRun(runs, name) {
  if (!Array.isArray(runs) || runs.length < 2) return { pass: false, msg: "Python did not finish both checks. Try running again." };
  const [actual, proof] = runs;
  if (!actual?.ok) return { pass: false, msg: firstRunError(actual) };
  if (actual.stdout !== `${name}\n`) {
    if (!actual.stdout || actual.stdout === "\n") return { pass: false, msg: "Python showed an empty line. What should print show instead?" };
    return { pass: false, msg: "Python showed something different from your name. Look at what goes inside print." };
  }
  if (!proof?.ok) return { pass: false, msg: "Python could not finish the second check. Try again with an expression that works for another name too." };
  if (proof.stdout !== `${probeName(name)}\n`) return { pass: false, msg: "That showed your name this time. Now make the same instruction follow the name when it changes." };
  return { pass: true, result: { name: actual.stdout.slice(0, -1) } };
}
