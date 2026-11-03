// Builds the files a student downloads: a standalone portfolio page (no external fonts, images or
// scripts; every student-typed string escaped; links validated) and a .py file that runs on its own.
import { prettySkill, dataWords, CHALLENGES, cleanTitle } from "./content.js";
import { programLines, program } from "./program.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// Accepts "www.linkedin.com/in/name" too, by adding https:// in front.
// Upgrades to https and, when a site is given, only accepts that site (linkedin.com, github.com).
export const normalizeUrl = (u, site) => {
  let v = String(u ?? "").trim();
  if (!v) return "";
  if (!/^[a-z][a-z0-9+.-]*:/i.test(v) && /^[^\s/]+\.[^\s]+/.test(v)) v = "https://" + v;
  try {
    const x = new URL(v);
    if (!/^https?:$/.test(x.protocol) || !x.hostname.includes(".")) return "";
    if (site && !(x.hostname === site || x.hostname.endsWith("." + site))) return "";
    x.protocol = "https:";
    return x.href;
  } catch { return ""; }
};

// Skills tied with the 3rd-place count but left out of the top three.
export function tiedOut(state) {
  const r2 = state.results[2], r3 = state.results[3];
  if (!r2 || !r3) return [];
  const third = r3.counts[r3.counts.length - 1];
  return r2.ranked.filter(([s, c]) => c === third && !r3.top.includes(s)).map(([s]) => s);
}

// Skills in chart order: biggest count first, and tied skills in the same order as the student's top three.
export function chartOrder(state) {
  const r2 = state.results[2], top = state.results[3]?.top || [];
  if (!r2) return [];
  const at = (s) => (top.includes(s) ? top.indexOf(s) : 99);
  return [...r2.ranked].sort((a, b) => b[1] - a[1] || at(a[0]) - at(b[0]) || a[0].localeCompare(b[0]));
}

// The student's own story: the edited version if they wrote one, otherwise their per-level explanations.
const STARTER_STUBS = CHALLENGES.flatMap((c) => [...c.explain.starters, ...(c.explain.helpedStarters || [])]).map((t) => t.replace(/…$/, "").trim().toLowerCase());
const tidy = (t) => {
  let v = (t || "").trim().replace(/…$/, "").trim();
  for (const stub of STARTER_STUBS) if (v.toLowerCase().endsWith(stub)) v = v.slice(0, -stub.length).trim();
  return v;
};
export const storyOf = (state) => state.built?.trim() || [1, 2, 3].map((k) => tidy(state.explains[k])).filter(Boolean).join("\n\n");

// What the student earned themselves, so the page never claims work a helper did or that isn't done.
export function earned(state) {
  const own = (k) => state.solved[k] && !state.helped?.[k];
  const steps = [["filter", 1], ["count", 2], ["rank", 3]];
  const tools = [...(own(1) ? ["variables", "filtering"] : []), ...(own(2) ? ["loops", "counting"] : []), ...(own(3) ? ["sorting"] : [])];
  return { mine: steps.filter(([, k]) => own(k)).map(([n]) => n), helped: steps.filter(([, k]) => state.helped?.[k]).map(([n]) => n), tools, complete: [1, 2, 3].every((k) => state.solved[k]) };
}
const listWords = (a) => (a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`);
const shortUrl = (u) => u.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

export function portfolioHtml(state, data, { draft, font = "" }) {
  const mode = state.dataMode || data.mode;
  const words = dataWords(mode);
  const name = state.displayName?.trim() || state.playerId;
  const role = state.role;
  const when = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const r1 = state.results[1], r2 = state.results[2], r3 = state.results[3];
  const e = earned(state);
  // A finished portfolio never says "not yet"; only drafts show what's still missing.
  const notYet = (what) => (draft ? `<p class="todo">Not yet completed: ${esc(what)}.</p>` : "");
  const chartRows = r2 ? chartOrder(state).slice(0, 6).map(([s, c]) => {
    const pct = Math.round((c / r2.n) * 100);
    return `<tr><th scope="row">${esc(prettySkill(s))}</th><td><span class="bar" style="width:${Math.max(4, pct)}%"></span></td><td class="num">${c} of ${r2.n} (${pct}%)</td></tr>`;
  }).join("") : "";
  const ties = tiedOut(state);
  const linkedin = normalizeUrl(state.linkedin, "linkedin.com"), github = normalizeUrl(state.github, "github.com");
  const links = [linkedin && `<a href="${esc(linkedin)}" rel="noopener noreferrer">${esc(shortUrl(linkedin))}</a>`,
                 github && `<a href="${esc(github)}" rel="noopener noreferrer">${esc(shortUrl(github))}</a>`].filter(Boolean).join('<span class="dot" aria-hidden="true"> · </span>');
  const story = storyOf(state);
  const codeLines = e.complete ? programLines(state, data.jobs, 4).map((l) => {
    let t = l.text;
    const tag = "  # completed with a helper";
    if (t.endsWith(tag)) t = /^matched_jobs/.test(t) ? "# Filter step: completed with a helper (it makes matched_jobs)" : /^counts/.test(t) ? "# Count step: completed with a helper (it makes counts)" : "# Rank step: completed with a helper (it makes top_skills)";
    return l.fixed ? `<mark>${esc(t)}</mark>` : esc(t);
  }).join("\n") : "";
  const top = r2 ? chartOrder(state)[0] : null;
  const tiedNames = r2 ? chartOrder(state).filter(([, c]) => c === top[1]).map(([k]) => k) : [];
  const plural = (a) => (a.length === 1 ? "step" : "steps");
  const doneLine = !e.complete
    ? `Guided project in progress: a three-step Python analysis (filter, count, rank) on ${words.project}.`
    : !e.helped.length
      ? `Guided project: debugged a three-step Python analysis (filter, count, rank) on ${words.project}.`
      : !e.mine.length
        ? `Guided project: a three-step Python analysis (filter, count, rank) on ${words.project}. A helper unlocked all three steps with me.`
        : `Guided project: a three-step Python analysis (filter, count, rank) on ${words.project}. I fixed the ${listWords(e.mine)} ${plural(e.mine)} myself; a helper unlocked the ${listWords(e.helped)} ${plural(e.helped)}.`;
  // "my code" only when the student fixed the steps behind the finding themselves (count and rank)
  const rankCode = state.helped?.[2] || state.helped?.[3] ? "the code" : "my code";
  const limitation = mode === "real"
    ? "This is a 2023 sample of U.S. postings, capped at 80 per career and schedule, so it shows patterns in this sample, not today's openings, and part-time jobs appear far more often than in real listings. Skills were picked out of each posting automatically, so a skill can be missed."
    : "These are made-up practice postings, so the pattern is for learning only, not about real jobs.";
  const source = mode === "real"
    ? `Data: Luke Barousse, data_jobs (2023), Hugging Face, ${esc(data.source_url || "https://huggingface.co/datasets/lukebarousse/data_jobs")}. U.S. postings labeled exactly Full-time or Part-time.`
    : `Data: FICTIONAL practice postings made up for the workshop. Not real job-market data.`;
  const face = font ? `@font-face{font-family:"Nunito";font-weight:600 900;src:url(${font}) format("woff2")}` : "";

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:">
<title>${state.displayName?.trim() ? `${esc(state.displayName.trim())} | ${esc(role)} portfolio` : `${esc(role)} portfolio | Career Quest`}${draft ? " (draft)" : ""}</title>
<style>
${face}
:root{--ink:#1d2246;--muted:#535a73;--line:#e4e0d4;--paper:#fbfaf6;--accent:#1f55c8;--band:#1747b0;--sun:#f6cf47}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:17px/1.6 "Nunito",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
.band{background:var(--band);color:#fdfbf4;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.band-in,main{max-width:880px;margin:0 auto;padding:0 28px}
.band-in{padding-top:44px;padding-bottom:36px}
h1{font-size:44px;line-height:1.05;margin:0 0 8px;font-weight:900;letter-spacing:-.01em}
h1,.headline,.links,p,li,td{overflow-wrap:anywhere}
.role{display:inline-block;margin:0;padding:4px 14px;border-radius:999px;background:var(--sun);color:var(--ink);font-weight:800;font-size:17px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.headline{margin:12px 0 0;font-size:19px;opacity:.95}.links{margin:12px 0 0;font-size:15px}.links a{color:#fdfbf4}
.draft{display:inline-block;margin:0 0 12px;padding:3px 10px;border:2px solid var(--sun);border-radius:6px;font-weight:800;font-size:13px;letter-spacing:.06em;text-transform:uppercase}
main{padding-top:30px;padding-bottom:56px}
.ptitle{margin:0 0 14px;font-size:28px;line-height:1.2;font-weight:900}
.fict{margin:-6px 0 14px;display:inline-block;padding:3px 10px;border-radius:8px;background:#fff1c9;border:1.5px solid #c9971a;font-size:14px;font-weight:800;color:#5b4300}
.glance{display:grid;grid-template-columns:1fr 1fr;gap:4px 28px;margin:0 0 32px;padding:20px 24px;border:2px solid var(--line);border-radius:16px;background:#fffdf8}
.glance h2{grid-column:1/-1;margin:0 0 6px}.glance p{margin:0}.k{display:block;font-size:13px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--muted)}
section{margin:0 0 32px;break-inside:avoid}h2{font-size:22px;margin:0 0 10px;font-weight:900}
.chips span{display:inline-block;margin:0 8px 8px 0;padding:4px 12px;border:1.5px solid var(--line);border-radius:999px;font-size:15px;background:#fffdf8}
table{width:100%;border-collapse:collapse}th{text-align:left;font-weight:800;padding:6px 12px 6px 0;width:26%;font-size:15px}
td{padding:6px 0}.bar{display:block;height:14px;border-radius:7px;background:var(--accent);-webkit-print-color-adjust:exact;print-color-adjust:exact}
td.num{width:30%;text-align:right;font-variant-numeric:tabular-nums;color:var(--muted);font-size:15px;padding-left:12px}
ol.top{margin:0;padding-left:22px;font-size:19px;font-weight:800}.note{font-size:14px;color:var(--muted)}
.findings{display:grid;grid-template-columns:1fr 1fr;gap:16px}.findings div{padding:14px 18px;border-radius:14px;background:#fffdf8;border:2px solid var(--line)}
.findings p{margin:4px 0 0}.todo{color:#8a3f12;font-style:italic}.quote{white-space:pre-wrap}
pre{margin:0;padding:16px 18px;border-radius:12px;background:#f1efe7;border:1px solid var(--line);font:14px/1.7 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere;font-variant-ligatures:none}
mark{background:#fde68a;color:inherit;border-radius:3px;padding:1px 2px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
footer{border-top:1px solid var(--line);padding-top:16px;font-size:13px;color:var(--muted)}
@media (max-width:640px){h1{font-size:34px}.glance,.findings{grid-template-columns:1fr}}
@page{margin:12mm}
@media print{body{background:#fffdf8;font-size:13.5px;line-height:1.45}.band-in,main{padding-left:18px;padding-right:18px}.band-in{padding-top:20px;padding-bottom:16px}main{padding-top:14px;padding-bottom:0}h1{font-size:32px}.ptitle{font-size:22px}h2{font-size:18px;margin-bottom:6px}section{margin-bottom:18px}.glance{margin-bottom:18px;padding:12px 16px}td,th{padding-top:3px;padding-bottom:3px}pre{font-size:12px;line-height:1.5;padding:10px 12px}footer{break-inside:avoid;break-before:avoid;padding-top:8px}.findings{display:block}.findings div{margin-bottom:12px;break-inside:avoid}section{break-inside:auto}h2{break-after:avoid}.glance,table,pre,figure{break-inside:avoid}section:last-of-type{margin-bottom:10px}.links a{text-decoration:none}}
</style></head><body>
<header class="band"><div class="band-in">
${draft ? `<p class="draft">Draft portfolio</p>` : ""}
<h1>${esc(state.displayName?.trim() || "Career Quest Portfolio")}</h1>
<p class="role">Aspiring ${esc(role)}</p>
${state.headline?.trim() ? `<p class="headline">${esc(state.headline.trim())}</p>` : ""}
${links ? `<p class="links">${links}</p>` : ""}
</div></header>
<main>
<p class="ptitle">Exploring Skills in ${mode === "real" ? "2023" : "Practice"} ${esc(role)} Postings</p>
${mode === "real" ? "" : `<p class="fict">Practice data: these postings are FICTIONAL, made up for learning.</p>`}
<section class="glance"><h2>Project at a glance</h2>
<p><span class="k">Question</span>Which skills show up most in ${esc(role)} job postings?</p>
<p><span class="k">Answer</span>${r3 ? `${r3.top.map((s, i) => `${esc(prettySkill(s))} (${r3.counts[i]})`).join(", ")}, out of ${r2.n} postings` : r2 ? (tiedNames.length > 1 ? `${esc(tiedNames.length > 2 ? `${tiedNames.slice(0, -1).map(prettySkill).join(", ")} and ${prettySkill(tiedNames.at(-1))}` : tiedNames.map(prettySkill).join(" and "))} tied for most (${top[1]} of ${r2.n} postings each)` : `${esc(prettySkill(top[0]))} came up most (${top[1]} of ${r2.n} postings)`) : "Still in progress"}</p>
</section>

<section><h2>Skills and experience</h2>
${state.skills.length ? `<p class="chips">${state.skills.map((s) => `<span>${esc(s)}</span>`).join("")}</p>` : ""}
${state.experience?.trim() ? `<p class="quote">${esc(state.experience.trim())}</p>` : notYet("an example of something I actually did")}
</section>

<section><h2>The project</h2>
<p>${esc(doneLine)}</p>
${r1 ? `<p><strong>${r1.n} ${esc(role)} postings</strong> in the sample, for example: ${[...new Set(r1.titles.map(cleanTitle))].slice(0, 3).map(esc).join("; ")}.</p>` : notYet("filtering the postings to my career")}
</section>

<section><h2>Skills demand</h2>
${r2 ? `<table aria-label="How many of the ${r2.n} ${esc(role)} postings mention each skill"><tbody>${chartRows}</tbody></table>
<p class="note">Counted once per posting, out of ${r2.n} ${esc(role)} postings (${esc(words.sample)}). ${mode === "real" ? "Source: Luke Barousse, data_jobs (2023). A historical sample, not current openings." : "FICTIONAL practice postings, for learning only."}</p>` : notYet("counting skills across the postings")}
</section>

${r2 ? `<section class="findings">
<div><span class="k">What I found</span><p>${esc(tiedNames.length > 1 ? `${tiedNames.length > 2 ? `${tiedNames.slice(0, -1).map(prettySkill).join(", ")} and ${prettySkill(tiedNames.at(-1))}` : tiedNames.map(prettySkill).join(" and ")} tied: each` : prettySkill(top[0]))} appeared in ${top[1]} of ${r2.n} postings (${Math.round((top[1] / r2.n) * 100)}%).${state.prediction ? ` Before coding, I predicted ${esc(prettySkill(state.prediction))} would come up most; ${tiedNames.length > 1 ? `${rankCode} found ${tiedNames.length > 2 ? `a ${tiedNames.length}-way tie: ${esc(tiedNames.slice(0, -1).map(prettySkill).join(", "))} and ${esc(prettySkill(tiedNames.at(-1)))}` : `a tie between ${esc(tiedNames.map(prettySkill).join(" and "))}`}` : top[0] === state.prediction ? `${rankCode} confirmed it` : `${rankCode} found ${esc(prettySkill(top[0]))}`}.` : ""}</p></div>
<div><span class="k">One limitation</span><p>${esc(limitation)}</p></div>
</section>` : ""}

<section><h2>Career strategy</h2>
${r3 ? `<ol class="top">${r3.top.map((s) => `<li>${esc(prettySkill(s))}</li>`).join("")}</ol>
${ties.length ? `<p class="note">Tied with number 3 at ${r3.counts[r3.counts.length - 1]} postings: ${ties.map((s) => esc(prettySkill(s))).join(", ")}.</p>` : ""}
${state.nextStep?.trim() ? `<p><strong>My next step:</strong> ${esc(state.nextStep.trim())}</p>` : notYet("my next step")}` : notYet("ranking the top skills")}
</section>

<section><h2>How I built this</h2>
${story ? `<p class="quote">${esc(story)}</p>` : notYet("my explanation in my own words")}
${e.helped.length ? `<p class="note">Completed with a helper: the ${esc(listWords(e.helped))} ${plural(e.helped)}.</p>` : ""}
</section>

${codeLines ? `<section><h2>${e.mine.length ? "My code" : "The code"}</h2>
<pre aria-label="My Python program">${codeLines}</pre>
<p class="note">${!e.helped.length ? "The three lines I fixed are highlighted." : e.mine.length ? `${e.mine.length === 1 ? "The line I fixed is" : "The lines I fixed are"} highlighted. ${e.helped.length === 1 ? "A step completed with a helper shows its result" : "Steps completed with a helper show their result"} instead of code.` : "Steps completed with a helper show their result instead of code."} I can share the full Python file; it runs on its own.</p>
</section>` : ""}

${e.tools.length ? `<p class="note">Python skills practiced: ${esc(listWords(e.tools))}. Built in a guided workshop with the AUC Data Science Initiative, ${esc(when)}.</p>` : `<p class="note">Built in a guided workshop with the AUC Data Science Initiative, ${esc(when)}.</p>`}
<footer>${source}<br>Made in Career Quest.</footer>
</main></body></html>`;
}

// A .py file that runs on its own: the same postings the student used are embedded as JOBS.
export function pythonFile(state, data) {
  const mode = state.dataMode || data.mode;
  const rows = data.jobs.map(({ role, title, skills }) => "    " + JSON.stringify({ role, title, skills }) + ",").join("\n");
  const label = mode === "real"
    ? "2023 U.S. job postings sample (Luke Barousse, data_jobs, Hugging Face). Historical, not current openings."
    : "FICTIONAL practice postings made up for the workshop. Not real job-market data.";
  return `# Career Quest: Code Your Next Move
# Player ${state.playerId} | Career: ${state.role}
# Data: ${label}
# ${(() => { const e = earned(state); return [e.mine.length && `Steps I fixed: ${listWords(e.mine)}.`, e.helped.length && `Unlocked with a helper: ${listWords(e.helped)}.`].filter(Boolean).join(" "); })()}
# Run it with:  python3 career-quest-${state.playerId}.py

JOBS = [
${rows}
]

${program(state, data.jobs, 4)}`;
}

export function download(filename, text, type = "text/html") {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
