import { pythonString } from "./first-run-rules.js";

// The Level 1 export is a readable, linear program. The student's verified
// expressions are inserted into the surrounding guided code, rather than
// replaying hidden programs with exec().
export function buildStarterPython(state = {}, quests = [], player = "PLAYER") {
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(String(player))) throw new Error("Invalid player ID");
  const p = state.starterPortfolio || {}, unlocked = state.starterUnlocked || {}, done = state.completed || {};
  const valid = (id) => done[id] && typeof done[id].expression === "string" && typeof done[id].personal === "string";
  const expr = (id) => valid(id) ? done[id].expression : null;
  const own = (v) => typeof v === "string" ? v.trim() : "";
  const list = (v) => Array.isArray(v) ? v : [];
  const textList = (v) => list(v).map(own).filter(Boolean);
  const py = (v) => {
    if (typeof v === "string") return pythonString(v);
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
    if (v === true) return "True";
    if (v === false) return "False";
    if (v == null) return "None";
    if (Array.isArray(v)) return `[${v.map(py).join(", ")}]`;
    return `{${Object.entries(v).map(([k, value]) => `${pythonString(k)}: ${py(value)}`).join(", ")}}`;
  };
  const header = p.header || {};
  const name = own(header.name) || own(done["1.2"]?.personal) || own(done["1.1"]?.personal);
  const oldSkills = own(done["1.4"]?.personal || done["1.3"]?.personal).split(",").map((s)=>s.trim()).filter(Boolean);
  const skills = Array.isArray(p.skills) && (p.skills.length || !oldSkills.length) ? textList(p.skills) : oldSkills;
  const entries = (key, fields) => list(p[key]).filter((v)=>v && typeof v === "object").map((v)=>Object.fromEntries(fields.map((field)=>[field,own(v[field])]))).filter((v)=>Object.values(v).some(Boolean));
  const experience = entries("experience",["title","organization","description"]);
  if (!Array.isArray(p.experience) && own(done["1.6"]?.personal)) experience.push({title:"",organization:"",description:own(done["1.6"].personal)});
  const education = entries("education",["school","qualification","detail"]);
  const projects = entries("projects",["title","description","link"]);
  const stats = list(p.stats).filter((s)=>s && own(s.label) && (typeof s.value === "string" ? !!own(s.value) : typeof s.value === "number" && Number.isFinite(s.value))).map((s)=>({label:own(s.label),value:s.value,studentStat:s.studentStat === true}));
  const next = p.nextStep || {};
  const nextText = own(next.text) || own(done["1.8"]?.personal);
  const nextDate = own(next.date) || own(state.profile?.date);
  const output = [];
  const add = (...lines) => output.push(...lines);
  add('# Career Quest: my guided Python portfolio', '# Run with Python 3: python3 portfolio.py', '# Lines marked "Your quest expression" contain expressions you completed.', '# The surrounding input, HTML, and file-writing code is guided scaffolding.', '', 'from html import escape', 'from pathlib import Path', 'from datetime import date', 'from urllib.parse import urlsplit, urlunsplit', '');
  add('# My own portfolio information', `PROFILE_NAME = ${py(name)}`, `skills = ${py(skills)}`, `EXPERIENCE = ${py(own(done["1.6"]?.personal))}`, `NEXT_STEP = ${py(nextText)}`, `next_step_date = ${py(nextDate)}`, `headline = ${py(own(header.headline))}`, `linkedin = ${py(own(header.linkedin))}`, `github = ${py(own(header.github))}`, `experiences = ${py(experience)}`, `education = ${py(education)}`, `projects = ${py(projects)}`, `my_stats = ${py(stats)}`, '');
  if (valid("1.1")) add('# Quest 1.1 — Your quest expression reads your saved name.', `display_name = (${expr("1.1")})`, '');
  else add('display_name = ""', '');
  if (valid("1.2")) add('# Quest 1.2 — Your quest expression makes a greeting from your name.', `greeting = (${expr("1.2")})`, 'display_name = greeting[len("Hello, "):] if greeting.startswith("Hello, ") else display_name', '');
  if (valid("1.3")) add('# Quest 1.3 — Your quest expression selects the first skill.', `first_skill = (${expr("1.3")}) if skills else ""`, '');
  add('skill_badges = []');
  if (valid("1.4")) add('# Quest 1.4 — Your quest expression runs once for each skill.', 'for skill in skills:', `    skill_badges.append(str(${expr("1.4")}))`);
  add('');
  if (valid("1.5")) add('# Quest 1.5 — Your quest expression converts your number.', `NUMBER_TEXT = ${py(own(done["1.5"].personal))}`, `number = (${expr("1.5")})`, '');
  if (valid("1.6")) add('# Quest 1.6 — Your quest expression checks for an experience.', `if (${expr("1.6")}):`, '    experience_message = EXPERIENCE', 'else:', '    experience_message = ""', '');
  else add('experience_message = ""', '');
  if (valid("1.7")) add('# Quest 1.7 — Your quest expression completes this function.', 'def keep_step(step):', `    return (${expr("1.7")})`, '', 'NEXT_STEP = keep_step(NEXT_STEP)', '');
  if (valid("1.8")) add('# Quest 1.8 — Your quest expression helps build a real HTML section.', `safe_step = escape(${expr("1.8")})`, 'next_step_section = "<section><h2>My next step</h2><p>" + safe_step + "</p></section>"', '');
  else add('next_step_section = ""', '');
  add(`# Sections appear only after their corresponding quests have been passed.`, `show_header = ${py(unlocked.header === true || (!Object.hasOwn(unlocked,"header") && valid("1.1")))}`, `show_skills = ${py(unlocked.skills === true || (!Object.hasOwn(unlocked,"skills") && valid("1.4")))}`, `show_stats = ${py(unlocked.stats === true || (!Object.hasOwn(unlocked,"stats") && valid("1.4")))}`, `show_experience = ${py(unlocked.experience === true || (!Object.hasOwn(unlocked,"experience") && valid("1.6")))}`, `show_next_step = ${py(unlocked.nextStep === true || (!Object.hasOwn(unlocked,"nextStep") && valid("1.8")))}`, '');
  add(`# Helpers below are provided scaffolding. They protect text and make the page.`,
`def safe_url(value, required_site=""):
    value = value.strip() if isinstance(value, str) else ""
    if not value or any(char.isspace() for char in value):
        return ""
    if "://" not in value and "." in value.split("/")[0]:
        value = "https://" + value
    try:
        url = urlsplit(value)
        host = (url.hostname or "").lower()
        if (url.scheme.lower() not in ("http", "https") or "." not in host or
                url.username is not None or url.password is not None or
                (required_site and host != required_site and not host.endswith("." + required_site))):
            return ""
        url.port
        return urlunsplit(("https", url.netloc, url.path, url.query, url.fragment))
    except (ValueError, TypeError):
        return ""

def card(entries, link=""):
    body = "".join("<p>" + escape(value) + "</p>" for value in entries if value)
    url = safe_url(link)
    if url:
        body += '<p><a href="' + escape(url, quote=True) + '">View project</a></p>'
    return '<article class="card">' + body + '</article>' if body else ""

def section(title, body):
    return "<section><h2>" + escape(title) + "</h2>" + body + "</section>" if body else ""

header_links = []
for value, site, label in ((linkedin, "linkedin.com", "LinkedIn"), (github, "github.com", "GitHub")):
    url = safe_url(value, site)
    if url:
        header_links.append('<a href="' + escape(url, quote=True) + '">' + label + '</a>')
header_content = "<h1>" + escape(display_name if show_header and display_name else "Starter Portfolio") + "</h1>"
if show_header and headline:
    header_content += "<p>" + escape(headline) + "</p>"
if show_header and header_links:
    header_content += "<p>" + " · ".join(header_links) + "</p>"

page_sections = []
if show_skills and skill_badges:
    page_sections.append(section("Skills", '<div class="chips">' + "".join('<span class="chip">' + escape(skill) + '</span>' for skill in skill_badges) + '</div>'))
if show_stats:
    stat_cards = []
    for stat in my_stats:
        # Optional statistics require the student's verified numeric quest.
        if stat.get("studentStat") and not ${py(valid("1.5"))}:
            continue
        value = stat["value"]
        # The optional numeric quest computes its own labeled statistic.
        if stat.get("studentStat"):
            value = number
        elif stat["label"] == "Skills listed":
            value = len(skill_badges)
        stat_cards.append('<article class="card"><strong>' + escape(str(value)) + '</strong><p>' + escape(stat["label"]) + '</p></article>')
    if not stat_cards and show_skills:
        stat_cards.append('<article class="card"><strong>' + str(len(skill_badges)) + '</strong><p>Skills listed</p></article>')
    page_sections.append(section("My numbers", "".join(stat_cards)))
if show_experience:
    # The condition from Quest 1.6 controls its primary experience; additional
    # experience cards entered in the portfolio editor remain independent.
    displayed_experiences = [entry for entry in experiences if not (EXPERIENCE and entry["description"] == EXPERIENCE and not experience_message)]
    page_sections.append(section("Experience", "".join(card([entry["title"], entry["organization"], entry["description"]]) for entry in displayed_experiences)))
    page_sections.append(section("Education", "".join(card([entry["school"], entry["qualification"], entry["detail"]]) for entry in education)))
    page_sections.append(section("Projects", "".join(card([entry["title"], entry["description"]], entry["link"]) for entry in projects)))
if show_next_step and next_step_section:
    try:
        valid_date = date.fromisoformat(next_step_date).isoformat()
    except ValueError:
        valid_date = ""
    if valid_date:
        date_html = '<p><time datetime="' + escape(valid_date, quote=True) + '">' + escape(valid_date) + '</time></p>'
        next_step_section = next_step_section.replace("</section>", date_html + "</section>", 1)
    page_sections.append(next_step_section)

html = '''<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<title>Starter Portfolio</title><style>
*{box-sizing:border-box}body{margin:0;background:#fbfaf6;color:#1d2246;font:17px/1.6 system-ui,sans-serif;overflow-wrap:anywhere}
header{background:#1747b0;color:white;padding:36px max(24px,calc((100% - 824px)/2))}header a{color:white}
main{max-width:880px;margin:auto;padding:30px 28px 56px}h1{margin:0;font-size:2.5rem;line-height:1.15}h2{font-size:1.35rem}
section{margin-bottom:30px}.card{border:2px solid #b0b5c6;background:#fffdf8;border-radius:14px;padding:16px;margin-bottom:10px}
.chips{display:flex;flex-wrap:wrap;gap:8px}.chip{background:#fffdf8;border:1.5px solid #b0b5c6;border-radius:999px;padding:5px 12px}
footer{border-top:1px solid #b0b5c6;padding-top:16px;font-size:.85rem}
</style></head><body><header>''' + header_content + '''</header><main>''' + "".join(page_sections) + '''<footer>Made in Career Quest.</footer></main></body></html>'''

output_file = Path(${py(`career-portfolio-${player}.html`)})
output_file.write_text(html, encoding="utf-8")
print("Created", output_file)`);
  return output.join("\n") + "\n";
}
