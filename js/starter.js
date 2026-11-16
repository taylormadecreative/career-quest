import { STARTER_BUILDINGS, buildingSvg, sceneHtml } from "./buildings.js";
import { starterPortfolioHtml, download, normalizeUrl } from "./portfolio-export.js";
import { structuredPortfolioHtml } from "./structured-portfolio.js";

// Separate from the original game's save: old challenge completion cannot unlock these sections.
const player = new URLSearchParams(location.search).get("player")?.toUpperCase() || "";
const validPlayer = /^(?:P(?:0[1-9]|[12][0-9]|30)|DEMO)$/.test(player);
const STORE = validPlayer ? `career-quest.starter.v1.${player}` : "career-quest.starter.v1";
if (validPlayer) document.querySelector("#quests-link").href = `quests.html?player=${encodeURIComponent(player)}`;
function loadStarter() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || "{}");
    return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
  } catch { return {}; }
}
let state = loadStarter();
let selected = "header";
const desc = {
  header: "Your name and an introduction can appear at the top of your portfolio.",
  skills: "Your skills can become badges on your portfolio.",
  stats: "Numbers from your work can become stat cards.",
  experience: "Your own experience can become cards on your portfolio.",
  nextStep: "A next step and its date can show what you plan to do next.",
};
const scene = document.querySelector("#starter-scene");
scene.innerHTML = sceneHtml("", { id: "starter-island", label: "Starter Portfolio city" });
const island = document.querySelector("#starter-island");
const detail = document.querySelector("#starter-detail");
const status = document.querySelector("#city-status");
const isOpen = (key) => state.starterUnlocked?.[key] === true;
const SEEN = `${STORE}.citySeen`;
function readSeen() {
  try {
    const value = JSON.parse(localStorage.getItem(SEEN) || "[]");
    return new Set(Array.isArray(value) ? value.filter((key) => typeof key === "string") : []);
  } catch { return new Set(); }
}
let seen = readSeen();
function markSeen() {
  seen = new Set(STARTER_BUILDINGS.filter((b) => isOpen(b.key)).map((b) => b.key));
  try { localStorage.setItem(SEEN, JSON.stringify([...seen])); } catch { /* Continue without storage. */ }
}
const clean = (value) => typeof value === "string" ? value.trim() : "";
function addText(parent, tag, value, className = "") {
  const el = document.createElement(tag);
  if (className) el.className = className;
  el.textContent = value;
  parent.append(el);
  return el;
}
function renderContent(key) {
  const portfolio = state.starterPortfolio || {};
  const empty = (message) => addText(detail, "p", message, "starter-empty");
  if (key === "header") {
    const header = portfolio.header || {};
    const name = clean(header.name), headline = clean(header.headline);
    if (name) addText(detail, "p", name, "starter-person-name");
    if (headline) addText(detail, "p", headline, "starter-person-headline");
    if (!name && !headline) empty("No name or introduction has been added yet.");
  } else if (key === "skills") {
    const skills = Array.isArray(portfolio.skills) ? portfolio.skills.map(clean).filter(Boolean) : [];
    if (!skills.length) return empty("No skills have been added yet.");
    const list = document.createElement("ul"); list.className = "starter-badges";
    for (const skill of skills) addText(list, "li", skill);
    detail.append(list);
  } else if (key === "stats") {
    const stats = (Array.isArray(portfolio.stats) ? portfolio.stats : []).filter((stat) =>
      stat && clean(stat.label) && (typeof stat.value === "number" && Number.isFinite(stat.value) || clean(stat.value)));
    if (!stats.length) return empty("No numbers have been added yet.");
    const list = document.createElement("dl"); list.className = "starter-stats";
    for (const stat of stats) {
      const card = document.createElement("div"); card.className = "starter-stat";
      addText(card, "dt", clean(stat.label));
      addText(card, "dd", typeof stat.value === "number" ? String(stat.value) : clean(stat.value));
      list.append(card);
    }
    detail.append(list);
  } else if (key === "experience") {
    const entries = (Array.isArray(portfolio.experience) ? portfolio.experience : []).filter((entry) =>
      entry && [entry.title, entry.organization, entry.description].some(clean));
    const education = (Array.isArray(portfolio.education) ? portfolio.education : []).filter((entry) =>
      entry && [entry.school, entry.qualification, entry.detail].some(clean));
    const projects = (Array.isArray(portfolio.projects) ? portfolio.projects : []).filter((entry) =>
      entry && ([entry.title, entry.description].some(clean) || normalizeUrl(entry.link)));
    if (!entries.length && !education.length && !projects.length) return empty("No experience, education, or projects have been added yet.");
    if (entries.length) addText(detail, "h3", "Experience");
    for (const entry of entries) {
      const card = document.createElement("div"); card.className = "starter-record";
      if (clean(entry.title)) addText(card, "p", clean(entry.title), "starter-record-title");
      if (clean(entry.organization)) addText(card, "p", clean(entry.organization));
      if (clean(entry.description)) addText(card, "p", clean(entry.description), "starter-record-description");
      detail.append(card);
    }
    if (education.length) addText(detail, "h3", "Education");
    for (const entry of education) {
      const card = document.createElement("div"); card.className = "starter-record";
      if (clean(entry.school)) addText(card, "p", clean(entry.school), "starter-record-title");
      if (clean(entry.qualification)) addText(card, "p", clean(entry.qualification));
      if (clean(entry.detail)) addText(card, "p", clean(entry.detail), "starter-record-description");
      detail.append(card);
    }
    if (projects.length) addText(detail, "h3", "Projects");
    for (const entry of projects) {
      const card = document.createElement("div"); card.className = "starter-record";
      if (clean(entry.title)) addText(card, "p", clean(entry.title), "starter-record-title");
      if (clean(entry.description)) addText(card, "p", clean(entry.description), "starter-record-description");
      const url = normalizeUrl(entry.link);
      if (url) { const link = addText(card, "a", "View project"); link.href = url; link.rel = "noopener noreferrer"; }
      detail.append(card);
    }
  } else if (key === "nextStep") {
    const next = portfolio.nextStep || {};
    const note = clean(next.text), date = clean(next.date);
    if (!note && !date) return empty("No next step or date has been added yet.");
    if (note) addText(detail, "p", note, "starter-record-description");
    if (date) {
      const label = document.createElement("p");
      addText(label, "span", "Date: ");
      const time = addText(label, "time", date);
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) time.dateTime = date;
      detail.append(label);
    }
  }
}
// Create buttons once: subsequent state updates preserve keyboard focus and selection.
const buttons = new Map();
for (const b of STARTER_BUILDINGS) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `bldg b-${b.key}`;
  button.setAttribute("aria-controls", "starter-detail");
  button.innerHTML = `<span class="b-art"></span><span class="b-sign"></span>`;
  button.querySelector(".b-sign").textContent = b.short;
  button.addEventListener("click", () => { selected = b.key; render(); });
  island.append(button);
  buttons.set(b.key, button);
}
function render() {
  for (const b of STARTER_BUILDINGS) {
    const button = buttons.get(b.key), open = isOpen(b.key);
    const nextState = open ? "open" : "locked";
    if (button.dataset.state !== nextState) {
      button.dataset.state = nextState;
      button.querySelector(".b-art").innerHTML = buildingSvg(b.key, { locked: !open });
      if (open && !seen.has(b.key)) {
        button.classList.remove("just-unlocked");
        // New elements or changes enter the DOM with the rise class only once.
        button.classList.add("just-unlocked");
      } else if (!open) button.classList.remove("just-unlocked");
    }
    button.setAttribute("aria-label", `${b.label}: ${open ? "unlocked" : "locked"}`);
    button.setAttribute("aria-pressed", String(selected === b.key));
  }
  status.textContent = `${STARTER_BUILDINGS.filter((b) => isOpen(b.key)).length} of ${STARTER_BUILDINGS.length} sections unlocked`;
  const b = STARTER_BUILDINGS.find((item) => item.key === selected);
  detail.replaceChildren();
  addText(detail, "h2", b.label);
  addText(detail, "span", isOpen(selected) ? "Unlocked" : "Locked", "status-pill");
  if (isOpen(selected)) renderContent(selected);
  else { addText(detail, "p", desc[selected]); addText(detail, "p", "Complete its quest to unlock this section."); }
  markSeen();
}
for (const button of buttons.values()) button.addEventListener("animationend", () => button.classList.remove("just-unlocked"));
document.querySelector("#download-draft").addEventListener("click", () => {
  download("career-starter-portfolio-draft.html", state.completed?.["2.1"] ? structuredPortfolioHtml(state, { draft: !state.completed?.["2.7"] }) : starterPortfolioHtml(state, { draft: !state.completed?.["1.8"] }));
});
window.addEventListener("storage", (event) => { if (event.key === STORE) { state = loadStarter(); render(); } });
render();

// Cache the preview as well when opened directly on a supported local or HTTPS origin.
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
