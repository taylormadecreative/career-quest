import { starterPortfolioHtml } from "./portfolio-export.js";

// Structured Portfolio extends the existing standalone page. Its content comes
// only from passed quests and student input; example records never become claims.
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const text = (v) => typeof v === "string" ? v.trim() : "";
const result = (state, id) => state.completed?.[id]?.result?.value;
const countInput = (s) => text(s).split(",").map((x) => x.trim()).filter(Boolean).reduce((out, value) => {
  out[value] = (out[value] || 0) + 1;
  return out;
}, Object.create(null));
const countEntries = (value) => value && typeof value === "object" && !Array.isArray(value)
  ? Object.entries(value).filter(([k, v]) => text(k) && Number.isSafeInteger(v) && v > 0)
  : [];
const stringList = (value) => Array.isArray(value) ? value.map(text).filter(Boolean) : [];
const validDate = (value) => {
  const date = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : "";
};
const selfRatings = (value) => {
  const result = new Map();
  for (const piece of text(value).split(",")) {
    const match = piece.match(/^\s*(.+?)\s*:\s*([1-5])\s*$/);
    if (match && text(match[1])) result.set(text(match[1]), Number(match[2]));
  }
  return [...result];
};
const wait = (section) => `<p class="locked">${esc(section)} appears here when its quest is completed.</p>`;

export function structuredPortfolioHtml(state = {}, { draft = true } = {}) {
  const done = state.completed && typeof state.completed === "object" ? state.completed : {};
  const timeline = text(result(state, "2.2"));
  const timelineDate = validDate(state.profile?.experienceDate);
  const ratings = done["2.6"] ? selfRatings(state.profile?.skillLevels) : [];
  // 2.6 may be run with a later edit to the student's skill list. Build the chart
  // from the exact personal input used in that run, rather than earlier counts.
  const chartRanks = stringList(result(state, "2.6"));
  const chartCounts = countInput(done["2.6"]?.personal);
  const chart = chartRanks.filter((skill, index) => chartRanks.indexOf(skill) === index && Number.isSafeInteger(chartCounts[skill]) && chartCounts[skill] > 0);
  const inventory = countEntries(result(state, "2.5"));
  const matches = stringList(result(state, "2.7"));
  const table = (rows, caption, bars = false) => {
    const max = Math.max(1, ...rows.map(([, count]) => count));
    return `<table class="cq-table"><caption>${esc(caption)}</caption><thead><tr><th scope="col">Skill</th><th scope="col">Times listed</th></tr></thead><tbody>${rows.map(([skill, count]) => `<tr><th scope="row">${esc(skill)}</th><td>${bars ? `<span class="cq-bar" aria-hidden="true" style="width:${Math.round(count / max * 100)}%"></span>` : ""}<span>${count}</span></td></tr>`).join("")}</tbody></table>`;
  };
  const timelineHtml = !done["2.2"] ? wait("Experience timeline") : timeline
    ? `<ol class="cq-timeline"><li>${esc(timeline)}${timelineDate ? ` <time datetime="${esc(timelineDate)}">${esc(timelineDate)}</time>` : ""}</li></ol>${timelineDate ? "" : `<p class="cq-note">No date was provided for this entry.</p>`}`
    : `<p class="empty">No experience entry added yet.</p>`;
  const inventoryHtml = !done["2.5"] ? wait("Skill inventory") : inventory.length
    ? `${table(inventory, "Counts of the skill words entered in the inventory quest")}<p class="cq-note">These are counts of entries, not ratings of skill level.</p>`
    : `<p class="empty">No skills were listed in this exercise.</p>`;
  const chartHtml = !done["2.6"] ? wait("Skill chart") : chart.length
    ? `${table(chart.map((key) => [key, chartCounts[key]]), "Highest counts in the skill list used for the chart quest", true)}<p class="cq-note">The table ranks how often each skill was typed in that exercise. It does not measure expertise.</p>`
    : `<p class="empty">No skill counts were available for this chart.</p>`;
  const selfRatingHtml = ratings.length ? `<h3>Self-assessed skill levels</h3><p class="cq-note">These ratings were provided by the student and are not independently verified.</p><table class="cq-table"><caption>Student self-assessment, from 1 to 5</caption><thead><tr><th scope="col">Skill</th><th scope="col">Self-rating</th></tr></thead><tbody>${ratings.map(([skill, rating]) => `<tr><th scope="row">${esc(skill)}</th><td><meter min="1" max="5" value="${rating}" aria-label="${esc(skill)} self-rating">${rating} out of 5</meter> ${rating} / 5</td></tr>`).join("")}</tbody></table>` : "";
  let postingSkills = "";
  try {
    const raw = JSON.parse(done["2.7"]?.personal || "");
    if (typeof raw?.skills === "string" && text(raw.postingSkills)) postingSkills = text(raw.postingSkills);
  } catch { /* Old saves used a practice posting. */ }
  const matchLabel = postingSkills ? `Compared with skills entered from a job posting: ${esc(postingSkills)}.` : "Compared with a practice posting listing Python, Research and Design. This is not a real job posting.";
  const matchHtml = !done["2.7"] ? wait("Posting match") : `<p class="cq-note">${matchLabel}</p>${matches.length ? `<ul>${matches.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>` : `<p>No shared skills were found in this comparison.</p>`}`;
  const extension = `<section aria-labelledby="structured-heading"><h2 id="structured-heading">Structured portfolio</h2><p class="cq-note">These sections grow from completed Level 2 quests and your own entries.</p>
  <h3>Experience timeline</h3>${timelineHtml}
  <h3>Skill inventory</h3>${inventoryHtml}
  <h3>Skill chart</h3>${chartHtml}
  ${selfRatingHtml}
  <h3>Posting match</h3>${matchHtml}</section>`;
  const css = `.cq-table{border-collapse:collapse;width:100%;max-width:36rem}.cq-table caption{text-align:left;font-weight:700;margin-bottom:.4rem}.cq-table th,.cq-table td{text-align:left;border-bottom:1px solid var(--line);padding:.45rem .6rem}.cq-bar{display:inline-block;vertical-align:middle;max-width:70%;height:.8rem;border-radius:999px;background:var(--blue);margin-right:.5rem}.cq-note{color:var(--muted);font-size:.92rem}.cq-timeline{padding-left:1.5rem}`;
  const base = starterPortfolioHtml(state, { draft });
  return base.replace("</style>", `${css}</style>`).replace("<footer>Made in Career Quest.</footer>", `${extension}<footer>Made in Career Quest.</footer>`);
}
