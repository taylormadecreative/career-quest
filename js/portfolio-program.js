import { pythonString } from "./first-run-rules.js";

/** Build a self-contained Python script from the student's verified quest code.
 * Each program runs in its own namespace, as it did in the game. No claimed
 * result is pulled from localStorage: portfolio values come from captured output.
 */
export function buildPortfolioPython(state = {}, quests = [], player = "PLAYER") {
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(String(player))) throw new Error("Invalid player ID");
  const completed = state.completed || {};
  const records = [];
  for (const quest of quests) {
    const done = completed[quest.id];
    if (!done) continue;
    if (typeof quest.sources !== "function" || typeof done.expression !== "string" || typeof done.personal !== "string") {
      throw new Error(`Missing code for quest ${quest.id}`);
    }
    let source = quest.sources(done.expression, done.personal)?.[0];
    if (quest.id === "2.7") {
      let inputs;
      try { inputs = JSON.parse(done.personal); } catch { inputs = null; }
      // Earlier saves used one plain-text skill list and a clearly labeled practice posting.
      // Restore that original input for the current two-input quest implementation.
      if (!(inputs && typeof inputs.skills === "string" && typeof inputs.postingSkills === "string") &&
          typeof source === "string" && source.includes("my_skills =") && source.includes("job_skills =")) {
        const mine = done.personal.split(",").map((v) => v.trim()).filter(Boolean);
        const job = ["Python", "Research", "Design"];
        source = `import json\nmy_skills = json.loads(${pythonString(JSON.stringify(mine))})\njob_skills = json.loads(${pythonString(JSON.stringify(job))})\nresult = ${done.expression}\nprint(json.dumps(sorted(result)))\n`;
      }
    }
    if (typeof source !== "string") throw new Error(`Could not prepare code for quest ${quest.id}`);
    records.push({ id: quest.id, title: String(quest.title || quest.id), personal: done.personal, source });
  }
  // Never insert a student string directly into executable Python syntax.
  const recordedSources = records.map((record) => `# Quest ${String(record.id).replace(/[^A-Za-z0-9.]/g, "")}\n${record.source.split(/\r\n|\r|\n/).map((line) => `# ${line}`).join("\n")}`).join("\n#\n");
  const recordsLiteral = pythonString(JSON.stringify(records));
  const playerLiteral = pythonString(String(player));
  const dateLiteral = pythonString(typeof state.starterPortfolio?.nextStep?.date === "string" ? state.starterPortfolio.nextStep.date : typeof state.profile?.date === "string" ? state.profile.date : "");
  const experienceDateLiteral = pythonString(typeof state.profile?.experienceDate === "string" ? state.profile.experienceDate : "");
  const postingLiteral = pythonString(typeof state.profile?.postingSkills === "string" ? state.profile.postingSkills : "");
  const levelsLiteral = pythonString(typeof state.profile?.skillLevels === "string" ? state.profile.skillLevels : "");
  const portfolioLiteral = pythonString(JSON.stringify(state.starterPortfolio || {}));
  const unlockedLiteral = pythonString(JSON.stringify(state.starterUnlocked || {}));
  return `# Career Quest: your Python portfolio program
# Run with Python 3: python3 this_file.py
# Each completed quest runs in its own namespace, matching the game's separate runs.
# Your quest instructions are below as recorded source; the HTML uses their output.
# Only run this file if you trust the code you entered into the game.
# Recorded quest source follows, then the executable version runs below.
${recordedSources}
import contextlib
import html
import io
import json
import math
import re
from datetime import date
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit
from xml.etree import ElementTree

QUESTS = json.loads(${recordsLiteral})
PLAYER = ${playerLiteral}
NEXT_STEP_DATE = ${dateLiteral}
EXPERIENCE_DATE = ${experienceDateLiteral}
POSTING_SKILLS = ${postingLiteral}
SKILL_LEVELS = ${levelsLiteral}
PORTFOLIO = json.loads(${portfolioLiteral})
UNLOCKED = json.loads(${unlockedLiteral})

def run_quest(quest):
    output = io.StringIO()
    namespace = {"__name__": "__student__"}
    try:
        with contextlib.redirect_stdout(output):
            exec(compile(quest["source"], "<quest " + quest["id"] + ">", "exec"), namespace)
    except BaseException as error:
        raise SystemExit("Quest " + quest["id"] + " could not run: " + str(error)) from error
    return output.getvalue()

outputs = {quest["id"]: run_quest(quest) for quest in QUESTS}
esc = lambda value: html.escape(str(value), quote=True)

def lines_for(quest_id):
    return outputs.get(quest_id, "").splitlines()

def section(title, body):
    return '<section><h2>' + esc(title) + '</h2>' + body + '</section>'

def quest_record(quest_id):
    return next((quest for quest in QUESTS if quest["id"] == quest_id), None)

def json_output(quest_id, expected_type):
    try:
        value = json.loads(outputs[quest_id])
        return value if isinstance(value, expected_type) else None
    except (KeyError, ValueError, TypeError):
        return None

def valid_date(value):
    try:
        return date.fromisoformat(value).isoformat() if value else ""
    except (ValueError, TypeError):
        return ""

# Quest 1.2 can revise the name entered in 1.1. Its checked greeting is the
# latest verified header value, so don't silently revert the student's edit.
header_lines = lines_for("1.1")
name = header_lines[0] if header_lines else ""
greeting_lines = lines_for("1.2")
if greeting_lines and greeting_lines[0].startswith("Hello, "):
    name = greeting_lines[0][len("Hello, "):]
if "header" in UNLOCKED and UNLOCKED["header"] is not True:
    name = ""
skills = [line for line in lines_for("1.4") if line.strip()]
experience_lines = lines_for("1.6")
# Only the input's real experience is included; the empty-input reminder is not an experience.
experience_input = next((q for q in QUESTS if q["id"] == "1.6"), None)
experience = experience_lines[0] if experience_lines and experience_input and experience_input["personal"].strip() else ""
next_lines = lines_for("1.8")
next_step = ""
if next_lines:
    # New Ship It outputs an HTML section; extract only its validated text and
    # escape again below. Never inject arbitrary HTML from an executed program.
    try:
        root = ElementTree.fromstring(outputs["1.8"].strip())
        children = list(root)
        if (root.tag == "section" and len(children) == 2 and children[0].tag == "h2"
                and children[0].text == "My next step" and children[1].tag == "p"
                and len(children[1]) == 0):
            next_step = children[1].text or ""
    except ElementTree.ParseError:
        # Earlier saves printed a title and a next step on separate lines.
        if len(next_lines) >= 2 and next_lines[0] == "My next step":
            next_step = next_lines[1]
if "nextStep" in UNLOCKED and UNLOCKED["nextStep"] is not True:
    next_step = ""
date_text = valid_date(NEXT_STEP_DATE)

def text_value(value):
    return value.strip() if isinstance(value, str) else ""

def safe_url(value, allowed_domain=None):
    value = text_value(value)
    if not value or any(char.isspace() for char in value):
        return ""
    if "://" not in value and "." in value.split("/")[0]:
        value = "https://" + value
    try:
        url = urlsplit(value)
        host = (url.hostname or "").lower()
        if (url.scheme.lower() not in ("http", "https") or "." not in host or
                url.username is not None or url.password is not None or
                (allowed_domain and host != allowed_domain and not host.endswith("." + allowed_domain))):
            return ""
        url.port  # Reject malformed port values.
        return urlunsplit(("https", url.netloc, url.path, url.query, url.fragment))
    except (ValueError, TypeError):
        return ""

def supplied_cards(key, fields, link=False):
    values = PORTFOLIO.get(key, []) if isinstance(PORTFOLIO, dict) else []
    if not isinstance(values, list):
        return []
    cards = []
    for value in values:
        if not isinstance(value, dict):
            continue
        lines = [text_value(value.get(field)) for field in fields]
        url = safe_url(value.get("link")) if link else ""
        if not any(lines) and not url:
            continue
        content = ''.join('<p>' + esc(line) + '</p>' for line in lines if line)
        if url:
            content += '<p><a href="' + esc(url) + '" rel="noopener noreferrer">View project</a></p>'
        cards.append('<div class="card">' + content + '</div>')
    return cards

parts = []
if "1.4" in outputs and ("skills" not in UNLOCKED or UNLOCKED["skills"] is True):
    parts.append(section("Skills", '<div class="chips">' + ''.join('<span class="chip">' + esc(s) + '</span>' for s in skills) + '</div>' if skills else '<p>No skills added yet.</p>'))
    if UNLOCKED.get("stats") is True and isinstance(PORTFOLIO, dict):
        stats = PORTFOLIO.get("stats", [])
        if not isinstance(stats, list):
            stats = []
        stat_cards = []
        for stat in stats:
            if not isinstance(stat, dict):
                continue
            label, value = text_value(stat.get("label")), stat.get("value")
            if label and ((isinstance(value, str) and value.strip()) or (type(value) in (int, float) and math.isfinite(value))):
                stat_cards.append('<div class="card"><strong>' + esc(value) + '</strong><br>' + esc(label) + '</div>')
        if stat_cards:
            parts.append(section("My numbers", ''.join(stat_cards)))
    elif not PORTFOLIO and ("stats" not in UNLOCKED or UNLOCKED["stats"] is True):
        parts.append(section("My numbers", '<div class="card"><strong>' + str(len(skills)) + '</strong><br>Skills listed</div>'))
if UNLOCKED.get("experience") is True:
    cards = supplied_cards("experience", ("title", "organization", "description"))
    if cards:
        parts.append(section("Experience", ''.join(cards)))
    education_cards = supplied_cards("education", ("school", "qualification", "detail"))
    if education_cards:
        parts.append(section("Education", ''.join(education_cards)))
    project_cards = supplied_cards("projects", ("title", "description"), link=True)
    if project_cards:
        parts.append(section("Projects", ''.join(project_cards)))
elif experience and not PORTFOLIO and ("experience" not in UNLOCKED or UNLOCKED["experience"] is True):
    # Backward compatibility for exports created from the earlier save format.
    parts.append(section("Experience", '<div class="card">' + esc(experience) + '</div>'))
if next_step:
    parts.append(section("My next step", '<div class="card">' + esc(next_step) + ('<p><time datetime="' + esc(date_text) + '">' + esc(date_text) + '</time></p>' if date_text else '') + '</div>'))

# Level 2: do not copy the exercise's practice entries or artificial years.
timeline = json_output("2.2", list)
timeline_record = quest_record("2.2")
if timeline is not None and timeline_record:
    own_title = timeline_record["personal"].strip()
    if own_title and own_title in timeline:
        actual_date = valid_date(EXPERIENCE_DATE)
        body = '<div class="card">' + esc(own_title)
        if actual_date:
            body += '<p><time datetime="' + esc(actual_date) + '">' + esc(actual_date) + '</time></p>'
        parts.append(section("Experience timeline", body + '</div>'))

counts = json_output("2.5", dict)
if counts is not None:
    count_record = quest_record("2.5")
    own_count_items = [item.strip() for item in count_record["personal"].split(",") if item.strip()] if count_record else []
    rows = [(key, value) for key, value in counts.items() if isinstance(key, str) and type(value) is int and value > 0 and own_count_items.count(key) == value]
    if rows:
        body = '<p>Occurrences in the skills you entered; these counts do not measure proficiency.</p><table><thead><tr><th scope="col">Skill</th><th scope="col">Times listed</th></tr></thead><tbody>'
        body += ''.join('<tr><th scope="row">' + esc(key) + '</th><td>' + str(value) + '</td></tr>' for key, value in rows)
        parts.append(section("Skills summary", body + '</tbody></table>'))

# Read the student's generated SVG as data only: never insert markup from program output into HTML.
chart = json_output("2.6", dict)
chart_record = quest_record("2.6")
if chart and chart_record and isinstance(chart.get("svg"), str) and isinstance(chart.get("top"), list):
    own_chart_skills = {item.strip() for item in chart_record["personal"].split(",") if item.strip()}
    try:
        svg = ElementTree.fromstring(chart["svg"])
        chart_rows = []
        for group in svg.findall("g"):
            label_node, rect = group.find("text"), group.find("rect")
            label = label_node.text if label_node is not None else None
            width = int(rect.get("width", "")) if rect is not None else -1
            if label in own_chart_skills and label in chart["top"] and 0 <= width <= 100000 and width % 10 == 0:
                chart_rows.append((label, width // 10))
        if chart_rows:
            max_count = max(value for _, value in chart_rows) or 1
            body = '<p>Most frequently entered skills, shown as counts rather than skill levels.</p><table><thead><tr><th scope="col">Skill</th><th scope="col">Count</th><th scope="col">Relative count</th></tr></thead><tbody>'
            body += ''.join('<tr><th scope="row">' + esc(label) + '</th><td>' + str(value) + '</td><td><meter min="0" max="' + str(max_count) + '" value="' + str(value) + '">' + str(value) + '</meter></td></tr>' for label, value in chart_rows)
            parts.append(section("Skill count chart", body + '</tbody></table>'))
    except (ElementTree.ParseError, ValueError, TypeError):
        pass

# Optional, explicitly student-provided ratings are separate from computed frequency counts.
if "2.6" in outputs and SKILL_LEVELS:
    ratings = {}
    for part in SKILL_LEVELS.split(","):
        match = re.fullmatch(r"\\s*([^,:]+?)\\s*:\\s*([1-5])\\s*", part)
        if match and match.group(1).strip():
            ratings[match.group(1).strip()] = int(match.group(2))
    if ratings:
        body = '<p>Student self-assessment, from 1 to 5; these ratings are not independently verified.</p><table><thead><tr><th scope="col">Skill</th><th scope="col">Self-rating</th></tr></thead><tbody>'
        body += ''.join('<tr><th scope="row">' + esc(skill) + '</th><td><meter min="1" max="5" value="' + str(rating) + '">' + str(rating) + ' out of 5</meter> ' + str(rating) + ' / 5</td></tr>' for skill, rating in ratings.items())
        parts.append(section("Self-assessed skill levels", body + '</tbody></table>'))

match_output = json_output("2.7", list)
match_record = quest_record("2.7")
match_inputs = None
if match_record:
    try:
        candidate = json.loads(match_record["personal"])
        if isinstance(candidate, dict) and isinstance(candidate.get("skills"), str) and isinstance(candidate.get("postingSkills"), str):
            match_inputs = candidate
    except (TypeError, ValueError):
        pass

actual_posting = []
actual_matches = []
if match_output is not None and match_record and match_inputs is not None:
    entered_skills = {item.strip() for item in match_inputs["skills"].split(",") if item.strip()}
    actual_posting = [item.strip() for item in match_inputs["postingSkills"].split(",") if item.strip()]
    actual_posting_set = set(actual_posting)
    actual_matches = [item for item in match_output if isinstance(item, str) and item in entered_skills and item in actual_posting_set]
    body = '<p>Posting skills entered: ' + ', '.join(esc(s) for s in actual_posting) + '</p>'
    body += '<p>Shared skills: ' + (', '.join(esc(s) for s in actual_matches) if actual_matches else 'No shared skills found.') + '</p>'
    parts.append(section("Match for the posting you entered", body))
elif match_output is not None and match_record:
    # Older saves only contained a personal skill list; their posting was practice data.
    own_match_skills = {item.strip() for item in match_record["personal"].split(",") if item.strip()}
    matches = [s for s in match_output if isinstance(s, str) and s in own_match_skills]
    body = '<p>Practice example: Python, Research, Design. This is not a real job posting.</p>'
    body += '<p>' + (', '.join(esc(s) for s in matches) if matches else 'No shared skills found in this example.') + '</p>'
    parts.append(section("Practice posting match", body))

posting = actual_posting or [item.strip() for item in POSTING_SKILLS.split(",") if item.strip()]
if match_inputs is None:
    actual_skills = [key for key, _ in rows] if counts is not None else skills
    posting_folded = {item.casefold() for item in posting}
    actual_matches = [s for s in actual_skills if isinstance(s, str) and s.casefold() in posting_folded]
tailored_body = ''
if posting and ("2.7" in outputs or "3.3" in outputs):
    tailored_body = section("Skills shared with the posting you entered", '<p>' + (', '.join(esc(s) for s in actual_matches) if actual_matches else 'No shared skills found.') + '</p>')

header_extra = ""
if UNLOCKED.get("header") is True and isinstance(PORTFOLIO, dict):
    header = PORTFOLIO.get("header") if isinstance(PORTFOLIO.get("header"), dict) else {}
    headline = text_value(header.get("headline"))
    if headline:
        header_extra += '<p>' + esc(headline) + '</p>'
    links = []
    for key, domain, label in (("linkedin", "linkedin.com", "LinkedIn"), ("github", "github.com", "GitHub")):
        url = safe_url(header.get(key), domain)
        if url:
            links.append('<a href="' + esc(url) + '" rel="noopener noreferrer">' + label + '</a>')
    if links:
        header_extra += '<p>' + ' · '.join(links) + '</p>'

document = '''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<title>Starter Portfolio</title><style>
*{box-sizing:border-box}body{margin:0;background:THEME_PAPER;color:THEME_INK;font:17px/1.6 system-ui,sans-serif;overflow-wrap:anywhere}
header{background:THEME_HEADER;color:white;padding:36px max(24px,calc((100% - 824px)/2));print-color-adjust:exact}
main{max-width:880px;margin:auto;padding:30px 28px 56px}header a{color:white}main a{color:THEME_LINK}h1{margin:0;font-size:2.5rem;line-height:1.15}h2{font-size:1.35rem;margin:0 0 12px}
section{margin-bottom:30px}.card{border:2px solid THEME_EDGE;background:THEME_CARD;border-radius:14px;padding:16px}.card strong{font-size:1.5rem}
.chips{display:flex;flex-wrap:wrap;gap:8px}.chip{background:THEME_CARD;border:1.5px solid THEME_EDGE;border-radius:999px;padding:5px 12px}
table{border-collapse:collapse;width:100%}th,td{padding:8px;text-align:left;border-bottom:1px solid THEME_EDGE}meter{width:100%}
footer{color:THEME_INK;border-top:1px solid THEME_EDGE;padding-top:16px;font-size:.85rem} @media print{section,.card{break-inside:avoid}}
</style></head><body><header><h1>''' + esc(name or "Starter Portfolio") + '''</h1>''' + header_extra + '''</header><main>''' + ''.join(parts) + '''<footer>Made in Career Quest.</footer></main></body></html>'''
themes = {
    "light": {"THEME_PAPER": "#fbfaf6", "THEME_INK": "#1d2246", "THEME_HEADER": "#1747b0", "THEME_EDGE": "#b0b5c6", "THEME_CARD": "#fffdf8", "THEME_LINK": "#1747b0"},
    "dark": {"THEME_PAPER": "#141c30", "THEME_INK": "#f7f8ff", "THEME_HEADER": "#071127", "THEME_EDGE": "#8796b4", "THEME_CARD": "#202a40", "THEME_LINK": "#a6d1ff"},
    "blue": {"THEME_PAPER": "#f3f7ff", "THEME_INK": "#10264c", "THEME_HEADER": "#153c7a", "THEME_EDGE": "#a2b4ce", "THEME_CARD": "#ffffff", "THEME_LINK": "#153c7a"},
}
def with_theme(source, colors):
    start = source.index("<style>") + len("<style>")
    end = source.index("</style>", start)
    css = source[start:end]
    for token, value in colors.items():
        css = css.replace(token, value)
    return source[:start] + css + source[end:]

def write_page(suffix, source, theme="light"):
    filename = Path("career-portfolio-" + PLAYER + suffix + ".html")
    filename.write_text(with_theme(source, themes[theme]), encoding="utf-8")
    print("Created " + str(filename))

write_page("", document)
if "3.6" in outputs:
    for theme in themes:
        write_page("-theme-" + theme, document, theme)
if tailored_body:
    write_page("-tailored", document.replace('<footer>', tailored_body + '<footer>', 1))
`;
}
