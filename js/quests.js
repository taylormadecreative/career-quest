import { FIRST_RUN, predictionFeedback } from "./first-run-content.js";
import { firstRunSources, checkFirstRun } from "./first-run-rules.js";
import { LEVEL1_QUESTS } from "./level1-quests.js";
import { LEVEL2_QUESTS } from "./level2-quests.js";
import { LEVEL3_QUESTS } from "./level3-quests.js";
import { starterPortfolioHtml, download, normalizeUrl } from "./portfolio-export.js";
import { buildPortfolioPython } from "./portfolio-program.js";
import { buildStarterPython } from "./starter-program.js";
import { structuredPortfolioHtml } from "./structured-portfolio.js";
import { buildPortfolioBundle } from "./portfolio-bundle.js";
import { invalidateChangedInputs, migrateLegacyProgress } from "./quest-progress.js";
import { STARTER_BUILDINGS, buildingSvg, sceneHtml } from "./buildings.js";

const first = {
  id: FIRST_RUN.id, title: FIRST_RUN.title, concept: "print, text and reading errors",
  displayCode:FIRST_RUN.displayCode, explain: FIRST_RUN.explain, example: 'print("Hello!")',
  predict: { question: FIRST_RUN.prediction.prompt, choices: FIRST_RUN.prediction.choices.map((c) => ({ text:c.label, feedback:c.feedback, correct:predictionFeedback(c.id).correct })) },
  prompt: FIRST_RUN.move.instructions, personalKey:"name", personalLabel:"Your name", personalPlaceholder:"Type your name",
  pick: { before:"print(", after:")", choices:FIRST_RUN.move.choices.map((c) => ({ label:c.code, code:c.code, why:c.feedback })) },
  hints:FIRST_RUN.hints.map((h) => h.text), why:FIRST_RUN.why, interview:FIRST_RUN.interview,
  sources:(expression, personal) => firstRunSources(personal, expression),
  check:(runs, personal) => checkFirstRun(runs, personal),
};
const quests = [first, ...LEVEL1_QUESTS, ...LEVEL2_QUESTS, ...LEVEL3_QUESTS];
const optional = new Set(["1.5","1.7","2.3","2.8","3.4","3.7"]);
const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const validPlayer = (s) => /^(?:P(?:0[1-9]|[12][0-9]|30)|DEMO)$/.test(s);
let player = "", state = {}, current = 0, worker, ready = false, timer, runId = 0, running = false, recentUnlocks = [], conflict = false, savedSnapshot = null, snapshotKnown = false, editorDraft = null, editorDirty = new Set(), migratedQuests = [], offlineCached = false;
const storeKey = () => `career-quest.starter.v1.${player}`;
const blank = () => ({ starterPortfolio:{header:{},skills:[],stats:[],experience:[],nextStep:{}}, starterUnlocked:{}, profile:{},completed:{},skipped:{}, answers:{} });
function load() {
  try {
    const raw=localStorage.getItem(storeKey()); savedSnapshot=raw; snapshotKnown=true;
    const saved=JSON.parse(raw || "{}");
    const result={ ...blank(), ...saved, starterPortfolio:{...blank().starterPortfolio,...saved.starterPortfolio}, starterUnlocked:saved.starterUnlocked || {}, profile:saved.profile || {}, completed:saved.completed || {}, skipped:saved.skipped || {}, answers:saved.answers || {} };
    migratedQuests=migrateLegacyProgress(result); return result;
  } catch { savedSnapshot=null; snapshotKnown=false; return blank(); }
}
function save() {
  if (conflict) { $("#announcer").textContent="Load the latest saved progress before saving."; return false; }
  try {
    if (snapshotKnown && localStorage.getItem(storeKey()) !== savedSnapshot) { markConflict(); return false; }
    const next=JSON.stringify(state); localStorage.setItem(storeKey(),next); savedSnapshot=next; snapshotKnown=true; return true;
  } catch { $("#announcer").textContent = "This browser could not save your progress. Download a draft before closing."; return false; }
}
function unlocked(index) { return index === 0 || quests.slice(0,index).every((q) => state.completed[q.id] || (optional.has(q.id) && state.skipped[q.id])); }
function firstIncomplete() { const i = quests.findIndex((q, n) => unlocked(n) && !state.completed[q.id] && !state.skipped[q.id]); return i < 0 ? quests.length - 1 : i; }
function startPlayer(value) {
  const id = value.trim().toUpperCase();
  if (!validPlayer(id)) { $("#login-error").textContent = "Enter an ID from P01 to P30, or DEMO."; return; }
  player = id; editorDraft=null; editorDirty.clear(); state = load(); current = firstIncomplete(); conflict=false; $("#sync-progress").hidden=true; $("#sync-status").textContent=migratedQuests.length ? `Quests ${migratedQuests.join(", ")} were updated. Your earlier answers are saved as drafts; please recheck them.` : "";
  $("#login").hidden = true; $("#quest-app").hidden = false; $("#player-label").textContent = `Player ${player}`;
  $("#city-link").href = `starter.html?player=${encodeURIComponent(player)}`;
  history.replaceState(null,"",`?player=${encodeURIComponent(player)}`);
  render(); $("#quest-heading").focus(); startWorker();
}
function startWorker() {
  if (worker) worker.terminate(); clearTimeout(timer); ready=false; running=false;
  $("#runtime-status").textContent = "Loading Python…";
  worker = new Worker("js/first-run-worker.js");
  timer = setTimeout(() => { worker.terminate(); worker=null; $("#runtime-status").textContent = "Python did not start. Reload to try again."; updateRun(); }, 90000);
  worker.onmessage = ({data}) => {
    if (data.type === "ready") { clearTimeout(timer); ready=true; $("#runtime-status").textContent=offlineCached ? "Python ready · offline copy saved" : "Python ready"; updateRun(); }
    else if (data.type === "fatal") { clearTimeout(timer); ready=false; running=false; $("#runtime-status").textContent="Python stopped. Retry to restart."; showFeedback("Python could not start or finish. Try again.","error"); if (/bad-file:/.test(data.error || "")) warmOffline(); updateRun(); }
    else if (data.type === "result" && data.id === runId) { clearTimeout(timer); running=false; finishRun(data.data.runs); updateRun(); }
  };
  worker.onerror = () => { clearTimeout(timer); ready=false; running=false; $("#runtime-status").textContent="Python stopped. Retry to restart."; showFeedback("Python stopped. Try again.","error"); updateRun(); };
  worker.postMessage({type:"init",verify:true});
}
function updateRun() { const b = $("#run"); if (b) { b.disabled=running || conflict; b.textContent=running ? "Running…" : ready ? "Run & check" : "Start Python / retry"; } }
function showFeedback(msg, kind="info") { const box=$("#run-feedback"); if (box) {box.hidden=false;box.dataset.kind=kind;box.textContent=msg;} }
function setPortfolio(q, result, personal, options = {}) {
  const p = state.starterPortfolio, u = state.starterUnlocked;
  if (q.id === "1.1") { p.header = {...p.header, name:result?.name || personal}; u.header=true; }
  if (q.id === "1.2") { p.header = {...p.header, name:personal}; u.header=true; }
  if (q.id === "1.4") {
    const raw = Array.isArray(result?.value) ? result.value : personal.split(",").map((s)=>s.trim()).filter(Boolean);
    p.skills = raw.filter((v)=>typeof v === "string"); p.stats=[{label:"Skills listed",value:Number.isFinite(result?.count)?result.count:p.skills.length,computedStat:"skillCount"},...(p.stats || []).filter((item)=>!(item.computedStat === "skillCount" || (item.label === "Skills listed" && !item.studentStat)))]; u.skills=true;u.stats=true;
  }
  if (q.id === "1.5" && personal.trim()) { const n=Number(personal); if (Number.isFinite(n)) p.stats=[...p.stats.filter((s)=>!s.studentStat),{label:options.statLabel,value:n,studentStat:true}]; state.profile.statLabel=options.statLabel; }
  if (q.id === "1.6") { p.experience = [...(p.experience || []).filter((item)=>item.title || item.organization), ...(personal.trim() ? [{description:personal.trim()}] : []), ...(state.profile.extraExperiences || []).map((description)=>({description}))]; u.experience=true; }
  if (q.id === "1.8") { p.nextStep={text:personal.trim(),date:options.nextDate || ""}; u.nextStep=true; state.profile.date=p.nextStep.date; }
}
let pending = null;
function finishRun(runs) {
  if (!pending || pending.id !== quests[current].id) return;
  const q=quests[current], {personal,expression,experienceDate,skillLevels,nextDate,statLabel}=pending;
  if (conflict) { running=false; showFeedback("Progress changed in another tab. Load the saved progress before running again.","error"); return; }
  let result; try { result=q.check(runs,personal); } catch { result={pass:false,msg:"The check could not read that result. Try again."}; }
  if (!result?.pass) { showFeedback((result?.msg || "That result is not quite right. Check your code and try again.") + (runs[0]?.stdout ? `\nPython showed: ${(q.publicOutput ? q.publicOutput(runs[0].stdout) : runs[0].stdout).slice(0,500)}` : ""),"error"); return; }
  const previousUnlocks={...state.starterUnlocked};
  const changed=invalidateChangedInputs(state,q.id,personal);
  state.completed[q.id]={expression,personal,result:result.result || {}, output:q.publicOutput ? q.publicOutput(runs[0]?.stdout) : (runs[0]?.stdout || ""), at:new Date().toISOString()};
  delete state.answers[q.id];
  delete state.skipped[q.id];
  if (q.secondaryKey) { const values=JSON.parse(personal); state.profile[q.secondaryKey]=values.postingSkills; }
  else if(q.personalKey && !["2.5","2.6"].includes(q.id)) state.profile[q.personalKey]=personal;
  if (q.id === "2.2") state.profile.experienceDate=experienceDate;
  if (q.id === "2.6") state.profile.skillLevels=skillLevels;
  setPortfolio(q,result.result,personal,{nextDate,statLabel});
  recentUnlocks=Object.keys(state.starterUnlocked).filter((key)=>state.starterUnlocked[key] && !previousUnlocks[key]);
  if (!save() && conflict) { showFeedback("Progress changed in another tab. Load the saved progress before continuing.","error"); return; }
  render();
  const notice=changed.length ? ` Your other progress is saved. Recheck quests ${changed.join(", ")} because this input changed.` : "";
  if (notice) { const n=document.createElement("p"); n.className="feedback"; n.textContent=notice.trim(); $("#success").prepend(n); }
  $("#announcer").textContent=`${q.title} passed. ${q.why}${notice}`;
  $("#success")?.focus();
}
function run(q) {
  if (conflict) {showFeedback("Progress changed in another tab. Load the saved progress first.","error");return;}
  if (!ready) {startWorker();return;}
  if (running) return;
  const input=$("#personal"); let personal=input ? input.value.trim() : "";
  if (q.personalLabel && q.personalRequired !== false && !personal) {showFeedback("Add your own information before running this quest.","error"); input?.focus(); return;}
  if (q.id === "2.1" && state.starterPortfolio?.header?.name && personal !== state.starterPortfolio.header.name) {showFeedback("To change your portfolio name, return to Name Tag first. Then run this quest with the same name.","error");input?.focus();return;}
  if (q.secondaryKey) {
    const second=$("#personal-secondary").value.trim();
    if (!second) {showFeedback("Add the skills from the posting first.","error"); $("#personal-secondary").focus(); return;}
    personal=JSON.stringify({skills:personal,postingSkills:second});
  }
  if (q.id === "1.8" && !$("#personal-date")?.value) {showFeedback("Choose a date for your next step.","error"); $("#personal-date")?.focus(); return;}
  const expression=$("#expression").value.trim();
  if (!expression) {showFeedback("Pick an answer or type in the blank first.","error"); return;}
  let sources; try { sources=q.sources(expression,personal); } catch {showFeedback("There was a problem preparing the Python. Check your input and try again.","error");return;}
  const skillLevels = $("#skill-levels")?.value.trim() || "";
  if (skillLevels && !skillLevels.split(",").every((part)=>/^\s*[^,:]+\s*:\s*[1-5]\s*$/.test(part))) { showFeedback("Use a skill and a number from 1 to 5 for each rating, like Research: 3, Design: 4.","error"); $("#skill-levels").focus(); return; }
  const experienceDate = $("#experience-date")?.value || "";
  const nextDate = $("#personal-date")?.value || "";
  const statLabel = $("#stat-label")?.value.trim() || "";
  if(q.id === "1.5" && !statLabel) {showFeedback("Tell us what your number counts.","error");$("#stat-label").focus();return;}
  pending={id:q.id,personal,expression,skillLevels,experienceDate,nextDate,statLabel}; running=true; runId++; updateRun();
  timer=setTimeout(()=>{worker?.terminate();worker=null;ready=false;running=false;$("#runtime-status").textContent="Python took too long. Retry to restart.";showFeedback("Python took too long. Check for a loop that does not stop, then try again.","error");updateRun();},12000);
  worker.postMessage({type:"run",id:runId,token:runId,sources});
}
function renderLive({discardDraft=false} = {}) {
  const panel=$("#live-portfolio"); if (!panel) return;
  const keys=["headline","linkedin","github","education","projects","experiences"];
  if (discardDraft) { editorDraft=null; editorDirty.clear(); }
  else if (panel.querySelector("#edit-headline")) {
    editorDraft ||= {};
    for (const key of keys) {
      const field=panel.querySelector(`#edit-${key}`);
      if (field && editorDirty.has(key)) editorDraft[key]=field.value;
    }
  }
  const wasOpen=panel.querySelector("#portfolio-editor")?.open || false;
  const codeOpen=panel.querySelector("#code-so-far")?.open || false;
  const p=state.starterPortfolio || {}, u=state.starterUnlocked || {}, header=p.header || {};
  const earned=STARTER_BUILDINGS.filter((b)=>u[b.key] === true).length;
  const city=STARTER_BUILDINGS.map((b)=>`<span class="bldg b-${b.key} ${recentUnlocks.includes(b.key)?"city-rise":""}" data-state="${u[b.key]===true?"open":"locked"}"><span class="b-art">${buildingSvg(b.key,{locked:u[b.key]!==true})}</span><span class="b-sign">${esc(b.short)}</span></span>`).join("");
  const lineList=(arr) => (Array.isArray(arr)?arr:[]).join("\n");
  // Existing detailed records are kept intact; these fields edit only simple entries.
  const schoolLines=(p.education || []).filter((item)=>!item.qualification && !item.detail).map((item)=>item.school || "").filter(Boolean);
  const projectLines=(p.projects || []).filter((item)=>!item.title && !item.link).map((item)=>item.description || "").filter(Boolean);
  const extra=state.profile.extraExperiences || [];
  const editValue=(key,fallback)=>editorDraft && Object.hasOwn(editorDraft,key) ? editorDraft[key] : fallback;
  const examples=quests.filter((quest)=>quest.id.startsWith("1.") && state.completed[quest.id] && quest.displayCode).map((quest)=>{
    const record=state.completed[quest.id], template=quest.displayCode(record.personal), at=template.lastIndexOf("____");
    const code=at<0 ? template : template.slice(0,at)+record.expression+template.slice(at+4);
    return `# ${quest.id} ${quest.title}\n${code}`;
  });
  panel.innerHTML=`<h2>Your portfolio city</h2><p class="live-intro">${earned} of 5 sections unlocked</p>
    <div class="scene live-scene" aria-hidden="true">${sceneHtml(city)}</div>
    <div class="live-profile" aria-live="polite"><h3>${u.header ? esc(header.name || "Your portfolio") : "Your name goes here"}</h3>
    ${u.header && header.headline ? `<p>${esc(header.headline)}</p>`:""}
    ${u.skills && p.skills?.length ? `<ul class="live-skills" aria-label="Your skills">${p.skills.map((x)=>`<li>${esc(x)}</li>`).join("")}</ul>` : `<p>Your skills will appear here as badges.</p>`}
    ${u.experience && p.experience?.length ? `<p><strong>Experience:</strong> ${esc(p.experience[0].description || p.experience[0].title || "")}</p>`:""}
    ${u.experience && p.education?.length ? `<p><strong>Education:</strong> ${esc(p.education[0].school || p.education[0].qualification || "")}</p>`:""}
    ${u.experience && p.projects?.length ? `<p><strong>Project:</strong> ${esc(p.projects[0].title || p.projects[0].description || "")}</p>`:""}
    ${u.nextStep && p.nextStep?.text ? `<p><strong>Next step:</strong> ${esc(p.nextStep.text)}</p>`:""}</div>
    <a href="starter.html?player=${encodeURIComponent(player)}">Explore your city</a>
    ${examples.length ? `<details class="live-code" id="code-so-far" ${codeOpen?"open":""}><summary>Your Python so far</summary><p class="help">These are the guided parts you completed. Your Level 1 download brings them together in one program.</p><pre>${esc(examples.join("\n\n"))}</pre></details>` : ""}
    ${u.header ? `<details id="portfolio-editor" class="live-editor" ${wasOpen?"open":""}><summary>Add your own portfolio details</summary>
      <p class="help">Use your own words. Select Save details to add them to your downloads.</p>
      <label for="edit-headline">Headline</label><input id="edit-headline" maxlength="150" value="${esc(editValue("headline",header.headline || ""))}" placeholder="What you want people to know about you">
      <label for="edit-linkedin">LinkedIn link (optional)</label><input id="edit-linkedin" maxlength="250" value="${esc(editValue("linkedin",header.linkedin || ""))}" placeholder="linkedin.com/in/your-name">
      <label for="edit-github">GitHub link (optional)</label><input id="edit-github" maxlength="250" value="${esc(editValue("github",header.github || ""))}" placeholder="github.com/your-name">
      ${u.experience ? `<label for="edit-education">Education (one entry per line)</label><textarea id="edit-education" maxlength="1200" placeholder="School, program, or relevant coursework">${esc(editValue("education",lineList(schoolLines)))}</textarea>
      <label for="edit-projects">Projects (one entry per line)</label><textarea id="edit-projects" maxlength="1600" placeholder="Describe something you actually made">${esc(editValue("projects",lineList(projectLines)))}</textarea>
      <label for="edit-experiences">More experiences (one per line)</label><textarea id="edit-experiences" maxlength="1600" placeholder="A class, project, job, or volunteer activity">${esc(editValue("experiences",lineList(extra)))}</textarea>` : `<p class="help">More experience, education and project fields unlock in Smart Messages.</p>`}
      <button type="button" class="btn-small" id="save-portfolio-details">Save details</button><p class="help" id="portfolio-details-status" role="status"></p></details>`:""}`;
  recentUnlocks=[];
  for (const key of keys) panel.querySelector(`#edit-${key}`)?.addEventListener("input",()=>editorDirty.add(key));
  $("#save-portfolio-details")?.addEventListener("click",()=>{
    if (conflict) { $("#portfolio-details-status").textContent="Load progress from the other tab first."; return; }
    const linkedin=$("#edit-linkedin").value.trim(), github=$("#edit-github").value.trim();
    if ((linkedin && !normalizeUrl(linkedin,"linkedin.com")) || (github && !normalizeUrl(github,"github.com"))) { $("#portfolio-details-status").textContent="Check that each link points to LinkedIn or GitHub."; return; }
    p.header={...p.header,headline:$("#edit-headline").value.trim(),linkedin,github};
    const lines=(v)=>v.split("\n").map((x)=>x.trim()).filter(Boolean);
    if (u.experience) {
      const previousEducation=p.education || [], previousProjects=p.projects || [];
      p.education=[...previousEducation.filter((item)=>item.qualification || item.detail),...lines($("#edit-education").value).map((school)=>({school}))];
      p.projects=[...previousProjects.filter((item)=>item.title || item.link),...lines($("#edit-projects").value).map((description)=>({description}))];
      state.profile.extraExperiences=lines($("#edit-experiences").value);
      const main=state.completed["1.6"]?.personal?.trim() || "";
      const protectedRecords=(p.experience || []).filter((item)=>item.title || item.organization);
      p.experience=[...protectedRecords,...(main?[{description:main}]:[]),...state.profile.extraExperiences.map((description)=>({description}))];
    }
    if (save()) { renderLive({discardDraft:true}); $("#portfolio-details-status").textContent="Saved to your portfolio."; $("#save-portfolio-details").focus(); }
  });
}
function render() {
  const q=quests[current];
  $("#python-export").hidden=!state.completed?.["1.8"]; $("#starter-export").hidden=!state.completed?.["1.8"] || !state.completed?.["2.1"]; $("#bundle-export").hidden=!state.completed?.["3.8"] || !unlocked(quests.length-1);
  $("#level-name").textContent = `Level ${q.id.split(".")[0]} · Quest ${q.id}`;
  $("#quest-heading").textContent=q.title; $("#quest-concept").textContent=q.concept || "";
  const groups=[1,2,3].map((n)=>`<h3>Level ${n}</h3>${quests.map((item,i)=>item.id.startsWith(`${n}.`) ? `<button type="button" data-index="${i}" ${i===current?'aria-current="step"':''} ${unlocked(i)?'':'disabled'}>${state.completed[item.id]?'✓ ':state.skipped[item.id]?'↷ ':''}${esc(item.id)} ${esc(item.title)}${optional.has(item.id)?' · extra':''}</button>`:'').join("")}`).join("");
  $("#quest-list").innerHTML=groups;
  $("#quest-list").querySelectorAll("button").forEach((button)=>button.addEventListener("click",()=>{current=Number(button.dataset.index);render();$("#quest-heading").focus();}));
  const explanation=Array.isArray(q.explain)?q.explain:[q.explain];
  const rotate=(items,salt) => { if (!items.length) return items; const shift=[...`${player}:${q.id}:${salt}`].reduce((a,c)=>a+c.charCodeAt(0),0)%items.length; return [...items.slice(shift),...items.slice(0,shift)]; };
  const choices=rotate(q.pick?.choices || [],"code"), prediction=rotate(q.predict?.choices || [],"predict");
  const old=state.completed[q.id], draft=old || state.answers[q.id];
  let oldPersonal=draft?.preferCurrentInput ? null : draft?.personal; let oldSecondary;
  if (q.secondaryKey && oldPersonal) { try { const parsed=JSON.parse(oldPersonal); oldPersonal=parsed.skills; oldSecondary=parsed.postingSkills; } catch {} }
  $("#lesson").innerHTML=`<h2>Learn</h2>${explanation.filter(Boolean).map((x)=>`<p>${esc(x)}</p>`).join("")}${q.example?`<pre>${esc(q.example)}</pre>`:""}
  <h3>Predict</h3><p>${esc(q.predict?.question || "What do you think happens?")}</p><div class="choices" id="predictions">${prediction.map((c,i)=>`<button type="button" data-i="${i}">${esc(c.text)}</button>`).join("")}</div><p class="feedback" id="prediction-feedback" aria-live="polite" hidden></p>
  <h3>Your move</h3><p>${esc(q.prompt)}</p>${q.personalLabel?`<label for="personal">${esc(q.personalLabel)}</label><input id="personal" maxlength="150" placeholder="${esc(q.personalPlaceholder || "")}" value="${esc(oldPersonal ?? state.profile[q.personalKey] ?? "")}">`:""}
  ${["2.5","2.6","2.7"].includes(q.id)?`<p class="help">These skills are for this exercise. To change your portfolio badges, revisit Badge Factory.</p>`:""}
  ${q.secondaryKey?`<label for="personal-secondary">${esc(q.secondaryLabel)}</label><input id="personal-secondary" maxlength="150" placeholder="${esc(q.secondaryPlaceholder || "")}" value="${esc(oldSecondary ?? state.profile[q.secondaryKey] ?? "")}">`:""}
  ${draft?.preferCurrentInput && typeof draft.personal === "string" ? `<p class="help">Your earlier entry is saved: ${esc(draft.personal)}. Review the new value before running again.</p>` : ""}
  ${q.id==="1.5"?`<label for="stat-label">What does this number count?</label><input id="stat-label" maxlength="80" placeholder="For example: Projects completed" value="${esc(state.profile.statLabel || "")}">`:""}
  ${q.id==="2.2"?`<label for="experience-date">Date for this experience (optional)</label><input type="date" id="experience-date" value="${esc(state.profile.experienceDate || "")}">`:""}
  ${q.id==="2.6"?`<label for="skill-levels">Your own skill ratings, 1–5 (optional)</label><input id="skill-levels" maxlength="150" placeholder="Research: 3, Design: 4" value="${esc(state.profile.skillLevels || "")}"><p>These are your self-assessments, not verified ratings.</p>`:""}
  ${q.id==="1.8"?`<label for="personal-date">Date for your next step</label><input type="date" id="personal-date" value="${esc(state.profile.date || "")}">`:""}
  <pre id="shown-code">${esc(q.displayCode ? q.displayCode(oldPersonal ?? state.profile[q.personalKey] ?? "") : `${q.pick?.before || ""}____${q.pick?.after || ""}`)}</pre><p class="help">The prepared lines set up your input and show the result. Some use tools you will learn later; change only the highlighted part.</p><p>Pick what goes in the blank, or type your own answer.</p><div class="choices" id="code-choices">${choices.map((c,i)=>`<button type="button" data-i="${i}">${esc(c.label || c.code)}</button>`).join("")}</div>
  <label for="expression">Your answer for the blank</label><textarea id="expression" rows="2" spellcheck="false">${esc(draft?.expression || "")}</textarea><p id="choice-feedback" class="feedback" aria-live="polite" hidden></p>
  <div class="quest-actions"><button class="btn btn-go" id="run" type="button">Run &amp; check</button><button class="btn-small" id="hint" type="button">Show a hint</button></div><ol class="hint-list" id="hints" aria-live="polite" aria-relevant="additions"></ol><p class="feedback" id="run-feedback" aria-live="polite" hidden></p>
  ${old?`<div class="quest-complete" id="success" tabindex="-1">${old.output ? `<h3>Python output</h3><pre>${esc(old.output)}</pre>` : ""}<h3>Why it worked</h3><p>${esc(q.why)}</p><p><strong>In an interview:</strong> ${esc(q.interview)}</p><div class="quest-actions">${q.id === "1.8" ? '<button class="btn-small" type="button" id="python-download">Download my Python</button>' : ""}${current<quests.length-1?'<button class="btn btn-go" type="button" id="next">Next quest</button>':'<a class="btn btn-go" href="starter.html?player='+encodeURIComponent(player)+'">See your portfolio city</a>'}</div></div>`:""}
  ${optional.has(q.id)&&!old?'<div class="quest-actions"><button class="btn-small" type="button" id="skip">Skip this extra for now</button></div>':""}`;
  $("#predictions").querySelectorAll("button").forEach((b)=>b.addEventListener("click",()=>{const c=prediction[Number(b.dataset.i)];const f=$("#prediction-feedback");f.hidden=false;f.textContent=c.feedback || (c.correct?"You got it.":"Try another choice.");}));
  function updateShownCode() {
    const ownInput=$("#personal")?.value || "";
    let template, marker="____";
    try {
      const input=q.secondaryKey ? JSON.stringify({skills:ownInput,postingSkills:$("#personal-secondary")?.value || ""}) : ownInput;
      if (q.displayCode) template=q.displayCode(ownInput);
      else {
        marker="__CQ_LEARNER_BLANK_7D93__";
        while (input.includes(marker)) marker+="X";
        template=q.sources(marker,input)[0];
      }
    } catch { marker="____"; template=`${q.pick?.before || ""}____${q.pick?.after || ""}`; }
    const at=template.lastIndexOf(marker), pre=$("#shown-code");
    if (at<0) {pre.textContent=template;return;}
    const mark=document.createElement("mark");
    const start=document.createElement("span"), end=document.createElement("span");
    start.className="sr-only"; start.textContent=" Start of your editable answer: ";
    end.className="sr-only"; end.textContent=" End of your editable answer. ";
    const answer=$("#expression").value;
    if (answer) mark.append(start,document.createTextNode(answer),end);
    else {
      const visualBlank=document.createElement("span"), spokenBlank=document.createElement("span");
      visualBlank.setAttribute("aria-hidden","true"); visualBlank.textContent="____";
      spokenBlank.className="sr-only"; spokenBlank.textContent="blank";
      mark.append(start,visualBlank,spokenBlank,end);
    }
    pre.replaceChildren(document.createTextNode(template.slice(0,at)),mark,document.createTextNode(template.slice(at+marker.length)));
  }
  $("#code-choices").querySelectorAll("button").forEach((b)=>b.addEventListener("click",()=>{const c=choices[Number(b.dataset.i)];$("#expression").value=c.code;$("#code-choices").querySelectorAll("button").forEach((x)=>x.setAttribute("aria-pressed",String(x===b))); const f=$("#choice-feedback");f.hidden=false;f.textContent=c.why || "Run it to see what happens.";updateShownCode();}));
  $("#expression").addEventListener("input",updateShownCode);
  $("#personal")?.addEventListener("input",updateShownCode);
  $("#personal-secondary")?.addEventListener("input",updateShownCode);
  updateShownCode();
  let hint=0; $("#hint").addEventListener("click",()=>{if(hint>=q.hints.length)return;const li=document.createElement("li");li.textContent=`${["Observe","Reason","Practice"][hint]}: ${typeof q.hints[hint]==="string"?q.hints[hint]:q.hints[hint].text}`;$("#hints").append(li);hint++;if(hint>=q.hints.length)$("#hint").disabled=true;});
  $("#run").addEventListener("click",()=>run(q)); updateRun();
  $("#python-download")?.addEventListener("click",()=>download(`career-quest-${player}-level-1.py`, buildStarterPython(state,quests,player), "text/x-python"));
  $("#next")?.addEventListener("click",()=>{current++;render();$("#quest-heading").focus();window.scrollTo(0,0);});
  $("#skip")?.addEventListener("click",()=>{if(conflict)return;state.skipped[q.id]=true;if (!save() && conflict)return;current++;render();$("#quest-heading").focus();window.scrollTo(0,0);});
  renderLive();
}
$("#start").addEventListener("click",()=>startPlayer($("#player-id").value));
$("#player-id").addEventListener("keydown",(e)=>{if(e.key==="Enter")startPlayer(e.target.value);});
function returnToLogin() { worker?.terminate(); worker=null; clearTimeout(timer); ready=false; conflict=false; editorDraft=null; editorDirty.clear(); savedSnapshot=null; snapshotKnown=false; $("#sync-progress").hidden=true; $("#sync-status").textContent=""; player=""; state=blank(); $("#quest-app").hidden=true; $("#login").hidden=false; $("#player-label").textContent=""; $("#python-export").hidden=true; $("#starter-export").hidden=true; $("#bundle-export").hidden=true; $("#city-link").href="starter.html"; $("#draft").disabled=false; $("#python-export").disabled=false; $("#starter-export").disabled=false; $("#bundle-export").disabled=false; history.replaceState(null,"",location.pathname); $("#player-id").value=""; $("#player-id").focus(); }
$("#switch-player").addEventListener("click",()=>{
  if (editorDirty.size && !confirm("You have unsaved portfolio details. Switch players without saving them?")) return;
  returnToLogin();
});
window.addEventListener("beforeunload",(event)=>{ if (editorDirty.size) { event.preventDefault(); event.returnValue=""; } });
$("#erase-player").addEventListener("click",()=>{
  if (!player || !confirm(`Erase ${player}'s Career Quest progress from this browser? Downloaded files will remain on this computer.`)) return;
  try { localStorage.removeItem(storeKey()); localStorage.removeItem(`${storeKey()}.citySeen`); }
  catch { $("#announcer").textContent="Could not erase the saved progress. Check browser storage settings."; return; }
  returnToLogin(); $("#login-error").textContent="This player's saved progress was erased from this browser.";
});
function markConflict() {
  conflict=true;
  if (running) { worker?.terminate(); worker=null; running=false; ready=false; clearTimeout(timer); }
  $("#sync-progress").hidden=false;
  $("#sync-status").textContent="Progress changed in another tab. Load the saved progress before continuing.";
  $("#draft").disabled=true; $("#python-export").disabled=true; $("#starter-export").disabled=true; $("#bundle-export").disabled=true; updateRun();
}
window.addEventListener("storage",(event)=>{ if (player && event.key===storeKey()) markConflict(); });
$("#sync-progress").addEventListener("click",()=>{
  state=load(); conflict=false; $("#sync-progress").hidden=true; $("#sync-status").textContent="Saved progress loaded.";
  $("#draft").disabled=false; $("#python-export").disabled=false; $("#starter-export").disabled=false; $("#bundle-export").disabled=false;
  if (!unlocked(current)) current=firstIncomplete(); render(); if (!ready) startWorker(); $("#quest-heading").focus();
});
function pageHtml() { return state.completed?.["2.1"] ? structuredPortfolioHtml(state,{draft:!state.completed?.["2.7"]}) : starterPortfolioHtml(state,{draft:!state.completed?.["1.8"]}); }
$("#draft").addEventListener("click",()=>download(`career-portfolio-${player || "draft"}.html`,pageHtml()));
$("#python-export").addEventListener("click",()=>download(`career-quest-${player}.py`,state.completed?.["2.1"] ? buildPortfolioPython(state,quests,player) : buildStarterPython(state,quests,player),"text/x-python"));
$("#starter-export").addEventListener("click",()=>download(`career-quest-${player}-level-1.py`,buildStarterPython(state,quests,player),"text/x-python"));
const themes = {
  light: "",
  dark: `body{background:#101727;color:#f6f8ff}.band{background:#123366;color:#fff}.card,.chip{background:#1c2b40;border-color:#8fa7c3;color:#fff}.locked,.empty,.stat-label,.date,.cq-note,footer{color:#dce8f7}.cq-table th,.cq-table td{border-color:#8fa7c3}.cq-bar{background:#a6d1ff}.band a{color:#fff}`,
  "high-contrast": `body{background:#fff;color:#000}.band{background:#000;color:#fff}.card,.chip{background:#fff;border-color:#000;color:#000}.locked,.empty,.stat-label,.date,.cq-note,footer{color:#000}.cq-table th,.cq-table td{border-color:#000}.cq-bar{background:#000}.band a{color:#fff}`,
};
function themedPage(html, css) { return css ? html.replace("</head>", `<style>${css}</style></head>`) : html; }
$("#bundle-export").addEventListener("click",()=>{
  if (!state.completed?.["3.8"] || !unlocked(quests.length-1)) return;
  const originalHtml=structuredPortfolioHtml(state,{draft:false});
  const nav='<nav aria-label="Portfolio pages"><a href="pages/skills.html">Skills</a> · <a href="pages/experience.html">Experience</a></nav>';
  const html=originalHtml.replace("<main>","<main>"+nav);
  const python=buildPortfolioPython(state,quests,player);
  const names=Object.keys(state.completed || {}).sort();
  const report=`Career Quest progress report\n\nQuests passed in this browser: ${names.join(", ")}\nEach pass checked actual Python output on two inputs. This is a progress record, not an independent audit of the portfolio.\n`;
  const readme=`Career Quest Portfolio\n\nOpen portfolio.html in a browser. Run starter.py with Python 3 to see your readable Level 1 program, or run portfolio.py to rebuild the fuller portfolio from the recorded quest programs. Three readable theme examples are in themes/; the portfolio links to its separate skills and experience pages.\n${state.profile.postingSkills ? "tailored.html focuses the visible badges on skills shared with the posting you supplied.\n" : ""}\nOnly include achievements you can explain and verify. Review your files before sharing.\n`;
  const matches=state.completed?.["2.7"]?.result?.value;
  let tailoredHtml;
  if (state.profile.postingSkills && Array.isArray(matches)) {
    const tailoredState={...state,starterPortfolio:{...state.starterPortfolio,skills:matches}};
    tailoredHtml=structuredPortfolioHtml(tailoredState,{draft:false}).replace("<main>","<main><p>Skill badges tailored to the posting skills you entered.</p>");
  }
  const themePages=Object.fromEntries(Object.entries(themes).map(([name,css])=>[name,themedPage(originalHtml,css)]));
  const title=esc((state.starterUnlocked?.header && state.starterPortfolio?.header?.name) || "Portfolio");
  const wrapPage=(heading,body)=>`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>${heading} | ${title}</title><style>body{font:17px/1.6 system-ui,sans-serif;color:#1d2246;background:#fbfaf6;margin:0}header{background:#1747b0;color:white;padding:2rem}main{max-width:50rem;margin:auto;padding:2rem}a{color:#1747b0}header a{color:white}li{margin:.4rem 0}</style></head><body><header><p>${title}</p><h1>${heading}</h1><a href="../portfolio.html">Back to portfolio</a></header><main>${body}</main></body></html>`;
  const skills=state.starterUnlocked?.skills ? (state.starterPortfolio?.skills || []) : [];
  const experience=state.starterUnlocked?.experience ? (state.starterPortfolio?.experience || []) : [];
  const education=state.starterUnlocked?.experience ? (state.starterPortfolio?.education || []) : [];
  const projects=state.starterUnlocked?.experience ? (state.starterPortfolio?.projects || []) : [];
  const experienceBody=[experience.length ? `<h2>Experience</h2>${experience.map((x)=>`<p>${esc(x.title || "")} ${esc(x.organization || "")} ${esc(x.description || "")}</p>`).join("")}` : "", education.length ? `<h2>Education</h2>${education.map((x)=>`<p>${esc(x.school || "")} ${esc(x.qualification || "")} ${esc(x.detail || "")}</p>`).join("")}` : "",projects.length ? `<h2>Projects</h2>${projects.map((x)=>`<p>${esc(x.title || "")} ${esc(x.description || "")}${normalizeUrl(x.link) ? ` <a href="${esc(normalizeUrl(x.link))}" rel="noopener noreferrer">View project</a>` : ""}</p>`).join("")}` : ""].join("") || "<p>No experience, education, or projects added.</p>";
  const pages={skills:wrapPage("Skills",skills.length?`<ul>${skills.map((x)=>`<li>${esc(x)}</li>`).join("")}</ul>`:"<p>No skills added.</p>"), experience:wrapPage("Experience",experienceBody)};
  const starterPython=buildStarterPython(state,quests,player);
  const bytes=buildPortfolioBundle({player,html,python,starterPython,readme,report,tailoredHtml,themePages,pages});
  const url=URL.createObjectURL(new Blob([bytes],{type:"application/zip"}));
  const a=Object.assign(document.createElement("a"),{href:url,download:`career-quest-${player}-portfolio-bundle.zip`});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);
});

// Once the core service worker is installed, verify and save the runtime for a later offline visit.
// A failure never changes a quest result or claims that Python is available offline.
async function warmOffline() {
  if (!("serviceWorker" in navigator) || !("caches" in window) || !globalThis.CQ_SAVED || !crypto.subtle) return;
  try {
    await navigator.serviceWorker.register("sw.js");
    await navigator.serviceWorker.ready;
    const cache = await caches.open(globalThis.CQ_SAVED.cache);
    for (const [path, meta] of Object.entries(globalThis.CQ_SAVED.files)) {
      const url=new URL(path,location.href).href;
      const existing=await cache.match(url);
      if (existing) {
        const oldHash=[...new Uint8Array(await crypto.subtle.digest("SHA-256",await existing.clone().arrayBuffer()))].map((v)=>v.toString(16).padStart(2,"0")).join("");
        if (oldHash===meta.sha256) continue;
        await cache.delete(url);
      }
      const response=await fetch(`${url}?cq-save=1`,{cache:"reload"});
      if (!response.ok) throw new Error("missing runtime asset");
      const hash=[...new Uint8Array(await crypto.subtle.digest("SHA-256",await response.clone().arrayBuffer()))].map((v)=>v.toString(16).padStart(2,"0")).join("");
      if (hash !== meta.sha256) throw new Error("runtime fingerprint mismatch");
      await cache.put(url,response);
    }
    offlineCached=true;
    if (ready) $("#runtime-status").textContent="Python ready · offline copy saved";
  } catch { /* The game remains usable online; no offline claim is shown. */ }
}
warmOffline();
const fromUrl = new URLSearchParams(location.search).get("player")?.toUpperCase(); if (fromUrl && validPlayer(fromUrl)) startPlayer(fromUrl);
