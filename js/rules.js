// Pass/fail checks and beginner-friendly error messages. Pure functions (no page access),
// so tests/rules.test.mjs can run them with plain Node. Checks look at what the code DID, never its text.

export const ranked = (counts) => Object.entries(counts).filter(([, v]) => typeof v === "number")
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

// ctx: { role, mine (number of postings for the role), total (all postings),
//        expected (the true per-skill tallies for this career), counts (the student's verified level 2 result) }
// Level 1 proof: re-run as another career and it must keep exactly that career's postings, once each.
export function followsRole(rep, role, want) {
  const m = rep?.ok && rep.matched;
  return !!m && !m.bad_type && !m.dupes && m.n === want && Object.keys(m.roles).every((r) => r === role);
}
export function check(level, rep, ctx) {
  if (level === 1) {
    const m = rep.matched;
    if (!m || m.bad_type) return { pass: false, msg: "matched_jobs needs to stay a list of postings. Did part of the line get deleted? Click Reset line to start over." };
    const onlyMine = Object.keys(m.roles).every((r) => r === ctx.role);
    if (m.dupes) return { pass: false, msg: `Your list has ${m.dupes} posting${m.dupes === 1 ? "" : "s"} in it twice. A filter keeps each matching posting once. What should the filter compare each job's role to?` };
    if (m.n === ctx.mine && m.n > 0 && onlyMine)
      return { pass: true, result: { n: m.n, total: ctx.total, role: ctx.role, titles: [...new Set(m.titles)].slice(0, 6) } };
    if (m.n === 0) return { pass: false, msg: "Your filter kept 0 postings. Is it reading the career you picked, or a fixed piece of text? Look back at line 1." };
    if (m.n === ctx.total) return { pass: false, msg: "Your filter kept every posting, not just the ones for your career. What should the filter compare each job's role to?" };
    return { pass: false, msg: `Your filter kept ${m.n} posting${m.n === 1 ? "" : "s"}, but not the right set for ${ctx.role}. What should the filter compare each job's role to?` };
  }
  if (level === 2) {
    if (rep.counts_bad_type) return { pass: false, msg: "counts needs to stay a dictionary of skills and totals. Click Reset line to start over." };
    const c = rep.counts || {};
    const vals = Object.values(c);
    const sum = vals.reduce((a, v) => a + (v || 0), 0);
    const expected = rep.matched?.mentions ?? 0;
    if (vals.some((v) => v === null)) return { pass: false, msg: "Some totals aren't plain counting numbers. A tally only ever goes up by whole steps." };
    const want = ctx.expected || {};
    const exact = Object.keys(want).length > 0 && Object.keys(c).length === Object.keys(want).length && Object.entries(want).every(([k, v]) => c[k] === v);
    if (exact) return { pass: true, result: { n: rep.matched?.n ?? 0, mentions: expected, ranked: ranked(c) } };
    const keys = Object.keys(c);
    if (keys.length && keys.length < Object.keys(want).length && keys.every((k) => !(k in want)))
      return { pass: false, msg: `Your counts only have ${keys.length === 1 ? `one entry, "${keys[0]}"` : `${keys.length} entries`}, not one for every skill. Is the loop using the skill it is looking at, or a fixed piece of text?` };
    if (vals.length && vals.every((v) => v === 0)) return { pass: false, msg: "Your code found the skill names, but every total is still 0. Watch what happens to a count each time the loop sees that skill." };
    const extra = keys.filter((k) => !(k in want));
    if (extra.length && Object.keys(want).length && Object.entries(want).every(([k, v]) => c[k] === v))
      return { pass: false, msg: `Your tallies are right, but counts also has ${extra.length === 1 ? `an extra entry, "${extra[0]}",` : `${extra.length} extra entries`} that isn't a skill. Did part of the line add a fixed key?` };
    if (sum > expected) return { pass: false, msg: "The totals are bigger than the number of skill mentions in your postings. Trace one skill by hand: how much should one mention add?" };
    return { pass: false, msg: "The totals don't match the skill mentions in your postings yet. Trace one skill through the loop by hand." };
  }
  if (level === 3) {
    if (rep.top_bad_type || !Array.isArray(rep.top)) return { pass: false, msg: "top_skills should be a list of skill names. Click Reset line to start over." };
    const counts = ctx.counts || {};
    const k = Math.min(3, Object.keys(counts).length);
    if (ctx.expected && (Object.keys(counts).length !== Object.keys(ctx.expected).length || Object.keys(counts).some((k2) => !(k2 in ctx.expected))))
      return { pass: false, msg: "Your skill counts aren't right yet, so the ranking can't be checked. Raise your hand so a helper can look at Level 2 with you." };
    const top = rep.top;
    const cutoff = ranked(counts)[k - 1]?.[1];
    const right = top.length === k && new Set(top).size === k && top.every((s) => s in counts && counts[s] >= cutoff);
    const ordered = top.every((s, i) => i === 0 || counts[top[i - 1]] >= counts[s]);
    if (right && ordered) return { pass: true, result: { top, counts: top.map((s) => counts[s]) } };
    if (right) return { pass: false, msg: "You found the right three skills, but they're in the wrong order. Top means the biggest count comes first." };
    if (top.length !== k) return { pass: false, msg: `top_skills has ${top.length} skills. Keep exactly three, and make them the most common ones.` };
    return { pass: false, msg: "You're getting three skills, but they aren't the most common ones yet. Compare the counts under What happened, then check the sort direction." };
  }
}

// Plain-English messages for the mistakes beginners actually make. Python's own words go underneath.
export function friendlyError(rep, level, src = "") {
  const tech = rep.msg ? `Python's exact words: ${rep.name ? rep.name + ": " : ""}${rep.msg}` : "";
  if (rep.kind === "syntax") {
    const m = rep.msg || "";
    if (/U\+201[89CD]/.test(m)) return { title: "Your line has a curly quote mark.", detail: "Python only understands straight quotes, like \" and '. This often happens when text is pasted. Delete the curly quotes and type them again.", tech };
    if (/U\+00A0|U\+200B/.test(m)) return { title: "Your line has a hidden special space.", detail: "It usually comes from pasting. Delete the spaces in the yellow line and type them again.", tech };
    if (/never closed|unmatched|does not match/.test(m)) return { title: "A bracket doesn't have a partner.", detail: "Count the ( ) and [ ] in the yellow line. Every opening bracket needs a closing one.", tech };
    const single = level === 1 && rep.line === 3 && /(^|[^=!<>])=($|[^=])/.test(rep.text || "");
    // Levels 2 and 3 store a value: "cannot assign" there means the left side of = isn't a place Python can store into.
    if (level !== 1 && /cannot assign to/.test(m))
      return { title: "Python can't store a value there.", detail: level === 2 ? "The left side of = is where the new count goes. Round brackets and .get() can only look a count up, not store one. Click Reset line to see how the original line stores it." : "The left side of = must be the name that stores your answer. Click Reset line to see how the original line does it.", tech };
    if (single || /Maybe you meant '=='|cannot assign to/.test(m)) return { title: "To compare two things, use two equals signs.", detail: "One = stores a value in a name. Two == checks whether two things are equal. Which one does a filter need?", tech };
    if (/unterminated string|EOL/.test(m)) return { title: "A quote mark is missing its partner.", detail: "Text in quotes needs a quote mark at the start and one at the end.", tech };
    return { title: "Python couldn't read your line.", detail: "Look for a missing or extra quote, bracket or symbol in the yellow line. Reset line brings back the original.", tech };
  }
  if (rep.kind === "timeout") return { title: "Your code ran too long, so it was stopped.", detail: "Python is restarting. Undo your last change and run again." };
  if (rep.kind === "setup") return { title: "Python had a hiccup and restarted.", detail: "Press Run again. If it keeps happening, raise your hand." };
  const n = rep.name, msg = rep.msg || "";
  if (n === "NameError") {
    const nm = (msg.match(/'([^']+)'/) || [])[1];
    if (/^(true|false|none)$/.test(nm || "")) return { title: `${nm[0].toUpperCase() + nm.slice(1)} needs a capital letter.`, detail: `Python writes it as ${nm[0].toUpperCase() + nm.slice(1)}.`, tech };
    if (/^(role|skills|title)$/i.test(nm || ""))
      return { title: `Labels need quote marks around them.`, detail: `Inside the square brackets, ${nm} is a label, not a name you made. Look at how the other labels in your code are written.`, tech };
    return { title: `Python doesn't know a name called ${nm || "that"}.`, detail: "Check the spelling and the capital letters. Python needs every name written exactly the way it was first made.", tech };
  }
  if (n === "KeyError") {
    const key = msg.replace(/^['"]|['"]$/g, "");
    // counts[skill] == ... compares instead of storing, and looking up a skill that isn't counted yet fails first
    if (level === 2 && /\]\s*==/.test(src))
      return { title: "To store the new count, use one equals sign.", detail: "Two == only compares two things, so nothing gets stored. One = puts the new count into counts[skill].", tech };
    if (level === 2 && !/^(role|skills|title)$/i.test(key))
      return { title: `The skill "${key}" isn't in counts yet.`, detail: "The first time the loop sees a skill, it has no count. The original line had a safe way to look up a skill that isn't counted yet. Click Reset line to compare.", tech };
    return { title: `The postings don't have a label called "${key}".`, detail: "Labels must match exactly, capital letters too. Look at how the labels are written in the lines above.", tech };
  }
  if (n === "TypeError" && /NoneType/.test(msg) && level === 2)
    return { title: "Python tried to add a number to nothing.", detail: "counts.get(skill) gives back nothing (None) when a skill isn't counted yet. The original line gave .get a starting number. Click Reset line to compare.", tech };
  const plain = {
    TypeError: "Python tried to combine two things that don't fit together.",
    AttributeError: "Python couldn't find what comes after a dot. Check the spelling after each dot.",
    IndexError: "Python tried to reach a spot in a list that doesn't exist.",
    ValueError: "Python got a value it can't use there.",
    ZeroDivisionError: "Your line divides by zero.",
    SystemExit: "Your line told Python to stop early. Remove that part and run again.",
    MemoryError: "Your line asked Python to do far too much. Undo your last change, or click Reset line.",
    RecursionError: "Your line asked Python to do far too much. Undo your last change, or click Reset line.",
    OverflowError: "Your line made a number too big for Python to handle. Undo your last change.",
    ImportError: "This game only lets your code use plain Python. Remove the import and try again.",
    ModuleNotFoundError: "This game only lets your code use plain Python. Remove the import and try again.",
  }[n];
  return { title: plain || `Python stopped with an error called ${n}.`, detail: "Compare your line with the original (Reset line brings it back), then try one small change.", tech };
}

// Level 3 proof: the same skills with their counts turned upside down. A line that really sorts
// must now pick the skills that used to be at the bottom; a typed-in list of names can't follow.
export function flippedCounts(rankedPairs) {
  const keys = rankedPairs.map(([k]) => k);
  return Object.fromEntries(keys.map((k, i) => [k, 17 + i * 13 + (i % 3) * 5]));  // distinct, rising, and not 1..n
}
export function followsFlip(top, flipped) {
  const want = ranked(flipped).slice(0, Math.min(3, Object.keys(flipped).length)).map(([k]) => k);
  return Array.isArray(top) && top.length === want.length && top.every((s, i) => s === want[i]);
}
