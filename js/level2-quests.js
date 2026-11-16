// Level 2: small, reusable practice quests. Every value below is practice data,
// not a claim about the student or a substitute for their own portfolio details.
// All checks inspect the result of real Python runs on two different inputs.
const quote = (value) => JSON.stringify(value);
const pack = (value) => `json.loads(${quote(JSON.stringify(value))})`;
const canonical = (value) => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const evaluate = (runs, expected, mistake) => {
  if (!Array.isArray(runs) || runs.length !== expected.length) return { pass: false, msg: "Run the code to check both examples." };
  for (let i = 0; i < expected.length; i++) {
    if (!runs[i]?.ok) return { pass: false, msg: "Python stopped before finishing. Check the highlighted part and try again." };
    let value;
    try { value = JSON.parse(runs[i].stdout.trim()); } catch { return { pass: false, msg: "The result could not be read. Check what your code returns and try again." }; }
    if (!same(value, expected[i])) return { pass: false, msg: mistake };
  }
  return { pass: true, msg: "Your code worked for both examples.", result: expected[0] };
};
const choice = (text, feedback, correct = false) => ({ text, feedback, correct });
const pick = (choices) => ({ before: "", after: "", choices: choices.map(([code, why]) => ({ label: code, code, why })) });
const build = (data, expression, prefix, suffix) => data.map((input) => `import json\n${prefix(input)}\nresult = ${expression}\n${suffix}\n`);

export const LEVEL2_QUESTS = [
  {
    id: "2.1", title: "Résumé as a Dictionary", concept: "dictionaries",
    explain: "A dictionary stores information under labels called keys. You can use a key in square brackets to get the value saved under it. These are practice profiles.",
    example: 'person = {"name": "Ari"}\nprint(person["name"])  # Ari',
    predict: { question: 'What does {"name": "Ari"}["name"] give back?', choices: [choice('"Ari"', "The key looks up the value saved beside it.", true), choice('"name"', "The key is the label; the stored value is different."), choice("A list", "Square brackets here look up one value in a dictionary.")] },
    prompt: "Choose an expression that reads the name from a profile.",
    pick: pick([['resume["name"]', "Look up the value under the name key."], ['"name"', "This is only the label, not the stored name."], ['resume["role"]', "This looks up a different key."]]),
    hints: ["Look at the keys inside the practice dictionary.", "Square brackets after the dictionary can use a key to retrieve its value.", 'For box = {"color": "blue"}, box["color"] reads the color.'],
    why: "A dictionary connects a label to a value, so the same lookup works for different profiles.",
    interview: "In a guided exercise, I used a dictionary to organize profile information and retrieve a value by its key.",
    sources: (expression) => build([{name:"Ari",role:"Student"},{name:"Bo",role:"Designer"}], expression, (v) => `resume = ${pack(v)}`, "print(json.dumps(result))"),
    check: (runs) => evaluate(runs, ["Ari", "Bo"], "The result should be each profile's name. Which key holds it?"),
  },
  {
    id: "2.2", title: "Experience Timeline", concept: "lists of dictionaries and sorting",
    explain: "A list can hold several dictionaries, one for each experience. Sorting places those entries in order; a key tells Python which value to compare.",
    example: 'sorted(items, key=lambda item: item["year"])',
    predict: { question: "If years are 2024 and 2021, which comes first when sorted from smallest to largest?", choices: [choice("2021", "The smaller year comes first.", true), choice("2024", "That would put the later year first."), choice("They never change order", "Sorting can rearrange the entries.")] },
    prompt: "Put the practice experiences in order by year, earliest first.",
    pick: pick([['sorted(experience, key=lambda item: item["year"])', "This compares each item's year."], ['experience', "This leaves the input order unchanged."], ['sorted(experience, key=lambda item: item["year"], reverse=True)', "This places later years first."]]),
    hints: ["Check the year in each practice entry.", "A sort key tells Python which piece of each entry to compare.", 'To order boxes by size, use sorted(boxes, key=lambda box: box["size"]).'],
    why: "The sort reads the year of each dictionary and returns a new list in chronological order.",
    interview: "In a guided exercise, I used a sorting key to order a list of records.",
    sources: (expression) => build([[{title:"Design",year:2024},{title:"Tutoring",year:2021}],[{title:"Club",year:2025},{title:"Study",year:2020},{title:"Project",year:2022}]], expression, (v) => `experience = ${pack(v)}`, 'print(json.dumps([item["title"] for item in result]))'),
    check: (runs) => evaluate(runs, [["Tutoring","Design"],["Study","Project","Club"]], "The earliest experience should appear first. Look at the sort direction and key."),
  },
  {
    id: "2.3", title: "Bullet Booster", concept: "string methods",
    explain: "String methods are actions Python can perform on text. strip() removes spaces at the ends, and lower() makes letters lowercase.",
    example: '"  HI  ".strip().lower()  # "hi"',
    predict: { question: 'What does "  YES  ".strip().lower() produce?', choices: [choice('"yes"', "The outer spaces are removed and the letters become lowercase.", true), choice('"  yes  "', "lower() changes letters, but strip() also removes outer spaces."), choice('"YES"', "strip() removes the outer spaces; lower() changes the letters too.")] },
    prompt: "Clean your text by removing outer spaces and making letters lowercase.",
    pick: pick([["text.strip().lower()", "Both methods run on the text."], ["text.lower()", "The outer spaces remain."], ["text.strip()", "The capital letters remain."]]),
    hints: ["Look for spaces at the start and end, and capital letters.", "Each method handles a different part of the clean-up.", '"  GREEN  ".strip().lower() becomes "green".'],
    why: "The first method trims outer spaces; the second makes the remaining letters lowercase.",
    interview: "In a guided exercise, I used string methods to clean text consistently.",
    sources: (expression) => build(["  HELLO  ","  Practice Text  "], expression, (v) => `text = ${quote(v)}`, "print(json.dumps(result))"),
    check: (runs) => evaluate(runs, ["hello","practice text"], "Keep the words, remove only the outside spaces, and make the letters lowercase."),
  },
  {
    id: "2.4", title: "Save and Load", concept: "JSON",
    explain: "JSON is a text format for storing structured information. json.loads() reads JSON text and turns it back into Python data.",
    example: 'json.loads(\'{"skill": "Art"}\')["skill"]  # "Art"',
    predict: { question: 'What does json.loads(\'{"skill": "Art"}\') create?', choices: [choice("A Python dictionary", "The JSON object becomes a dictionary.", true), choice("A picture", "JSON stores data as text; it does not draw a picture."), choice("The word loads", "loads reads the text into a Python value.")] },
    prompt: "Read JSON containing your skill into a Python dictionary.",
    pick: pick([["json.loads(saved)", "This reads JSON text into Python data."], ["saved", "This leaves the value as text."], ["json.dumps(saved)", "This writes a Python value as JSON text instead of reading it."]]),
    hints: ["The saved value is text; the next line needs a dictionary.", "One JSON function reads text, while another writes it.", 'json.loads(\'{"pet": "cat"}\') reads the text as a dictionary.'],
    why: "Reading JSON turns the saved text into a dictionary that Python can use again.",
    interview: "In a guided exercise, I converted stored JSON text into structured Python data.",
    sources: (expression) => build([{skill:"Art"},{skill:"Music"}], expression, (v) => `saved = ${quote(JSON.stringify(v))}`, 'print(json.dumps(result["skill"]))'),
    check: (runs) => evaluate(runs, ["Art","Music"], "Read the saved text into a dictionary before looking up its skill."),
  },
  {
    id: "2.5", title: "Skill Inventory", concept: "grouping and counting",
    explain: "A count tells how many times something appears. Counter groups matching items and records a count for each one.",
    example: 'Counter(["art", "art", "music"])  # art: 2, music: 1',
    predict: { question: 'How many times does "art" appear in ["art", "music", "art"]?', choices: [choice("2", "Art appears twice.", true), choice("1", "Look at both the first and last items."), choice("3", "Three is the count of all items, not just art.")] },
    prompt: "Make a count for each skill in your list.",
    pick: pick([["Counter(skills)", "Counter groups the items and counts each one."], ["len(skills)", "This counts all items together, without grouping them."], ["set(skills)", "A set removes repeats but does not record counts."]]),
    hints: ["A skill may occur more than once.", "The result needs a separate number for each different skill.", 'Counter(["tea", "tea", "juice"]) records tea as 2 and juice as 1.'],
    why: "Counter groups equal items and records how many times each occurs.",
    interview: "In a guided exercise, I grouped repeated items and counted how often each appeared.",
    sources: (expression) => build([["art","music","art"],["code","code","code","design","design"]], expression, (v) => `from collections import Counter\nskills = ${pack(v)}`, "print(json.dumps(result, sort_keys=True))"),
    check: (runs) => evaluate(runs, [{art:2,music:1},{code:3,design:2}], "The result needs each different skill and its count."),
  },
  {
    id: "2.6", title: "Rank and Chart", concept: "sorting, slicing and SVG charts",
    explain: "Sorting can put the largest counts first; a slice keeps part of the result. The game uses the chosen items to draw an SVG chart, a picture described with text.",
    example: 'sorted(counts, key=counts.get, reverse=True)[:2]',
    predict: { question: "If counts are 2, 5 and 3, which two are largest?", choices: [choice("5 and 3", "Largest first means 5, then 3.", true), choice("2 and 3", "Those are the two smallest."), choice("2 and 5", "That pair misses the second-largest count.")] },
    prompt: "Choose the two most common skills in your list, highest count first.",
    pick: pick([["sorted(counts, key=counts.get, reverse=True)[:2]", "This sorts biggest first and keeps two."], ["sorted(counts, key=counts.get)[:2]", "This keeps the smallest counts."], ["list(counts)[:2]", "This uses the input order instead of the counts."]]),
    hints: ["Compare the counts, then decide which two are biggest.", "Use the counts as the sort key and put the larger numbers first.", 'For scores {"A": 2, "B": 7, "C": 4}, the largest two are B and C.'],
    why: "The two highest counts become the selected chart bars, in descending order.",
    interview: "In a guided exercise, I ranked counts and selected the highest values for a chart.",
    sources: (expression) => build([{art:2,music:5,design:3},{code:1,design:4,writing:7}], expression, (v) => `from html import escape\ncounts = ${pack(v)}`, 'svg = "<svg>" + "".join("<g><text>" + escape(str(k)) + "</text><rect width=\\"" + str(counts[k] * 10) + "\\" height=\\"10\\"/></g>" for k in result) + "</svg>"\nprint(json.dumps({"top": result, "svg": svg}))'),
    check: (runs) => evaluate(runs, [{top:["music","design"],svg:'<svg><g><text>music</text><rect width="50" height="10"/></g><g><text>design</text><rect width="30" height="10"/></g></svg>'},{top:["writing","design"],svg:'<svg><g><text>writing</text><rect width="70" height="10"/></g><g><text>design</text><rect width="40" height="10"/></g></svg>'}], "The chart needs the two highest counts in order. Check the sort direction and slice."),
  },
  {
    id: "2.7", title: "Match a Posting", concept: "sets",
    explain: "A set holds unique items. The intersection of two sets contains only the items found in both.",
    example: 'set(["art", "music"]) & set(["art", "code"])  # {"art"}',
    predict: { question: 'What is shared by ["art", "music"] and ["art", "code"]?', choices: [choice("art", "Art appears in both lists.", true), choice("music", "Music appears only in the first list."), choice("code", "Code appears only in the second list.")] },
    prompt: "Find the skills shared by the two practice lists.",
    pick: pick([["set(my_skills) & set(job_skills)", "The intersection keeps only shared items."], ["set(my_skills) | set(job_skills)", "The union includes items that appear in either list."], ["set(my_skills)", "This includes skills whether or not the other list has them."]]),
    hints: ["Look for a skill appearing in both lists.", "A set intersection keeps the overlap between sets.", 'For ["tea", "water"] and ["tea", "juice"], only "tea" is shared.'],
    why: "The set intersection finds the values that both lists have in common.",
    interview: "In a guided exercise, I compared two collections to find their shared items.",
    sources: (expression) => build([{mine:["art","music"],job:["art","code"]},{mine:["design","writing","code"],job:["writing","design","math"]}], expression, (v) => `my_skills = ${pack(v.mine)}\njob_skills = ${pack(v.job)}`, "print(json.dumps(sorted(result)))"),
    check: (runs) => evaluate(runs, [["art"],["design","writing"]], "Keep only skills appearing in both lists."),
  },
  {
    id: "2.8", title: "Safe and Reusable", concept: "escaping text and refactoring",
    explain: "HTML uses symbols such as < and > to mark page structure. Escaping changes those symbols into safe text, so a person's words are displayed instead of treated as markup. A function can reuse the same step.",
    example: 'escape("A < B")  # "A &lt; B"',
    predict: { question: 'What does escape("A < B") return?', choices: [choice('"A &lt; B"', "The less-than sign becomes text-safe HTML.", true), choice('"A < B"', "The less-than sign still looks like HTML markup."), choice('"A B"', "Escaping preserves the symbol's meaning; it does not delete it.")] },
    prompt: "Complete the reusable card function so your text is escaped before it is placed in a page.",
    pick: pick([["escape(text)", "Escape the text each time the function is called."], ["text", "Raw angle brackets could be treated as markup."], ["text.upper()", "Capital letters do not escape HTML symbols."]]),
    hints: ["The text can contain characters that also have a meaning in HTML.", "The function should make those characters safe before wrapping them in a paragraph.", 'escape("tea & cake") produces "tea &amp; cake".'],
    why: "The reusable function escapes the text before adding it to HTML, preserving the words safely.",
    interview: "In a guided exercise, I used a reusable function to escape text before displaying it in HTML.",
    sources: (expression) => build(["A < B", "Tea & cake"], expression, (v) => `from html import escape\ntext = ${quote(v)}`, 'def card(value):\n    text = value\n    return "<p>" + (' + expression + ') + "</p>"\nprint(json.dumps(card(text)))').map((src, i) => {
      // The expression is evaluated inside the function only; avoid a redundant outer evaluation.
      const marker = `\nresult = ${expression}\n`;
      return src.replace(marker, "\n");
    }),
    check: (runs) => evaluate(runs, ["<p>A &lt; B</p>","<p>Tea &amp; cake</p>"], "Make sure the function escapes special characters before adding the paragraph tags."),
  },
];

// The first run uses the learner's own words. The second run uses different,
// clearly labeled practice data to check that the same code works again.
// Only personal values or results computed from them are returned to the UI.
const own = (p) => typeof p === "string" ? p.trim() : "";
const ownList = (p) => own(p).split(",").map((x) => x.trim()).filter(Boolean);
const personalCheck = (runs, expected, message, value) => {
  const result = evaluate(runs, expected, message);
  return result.pass ? { ...result, result: { value } } : result;
};
const setupPersonal = (index, key, label, placeholder, sources, check) => Object.assign(LEVEL2_QUESTS[index], {
  personalKey: key, personalLabel: label, personalPlaceholder: placeholder, sources, check,
});

setupPersonal(0, "name", "Your name", "Your name", (e, p) => build([{name:own(p),role:""},{name:"Bo",role:"Designer"}], e, (v) => `resume = ${pack(v)}`, "print(json.dumps(result))"),
  (r, p) => personalCheck(r, [own(p),"Bo"], "The result should be each profile's name. Which key holds it?", own(p)));

LEVEL2_QUESTS[1].explain += " The years in this exercise are practice values, not claims about your experience.";
LEVEL2_QUESTS[1].prompt = "Sort a practice timeline that includes your experience title. The years are only for this exercise.";
setupPersonal(1, "experience", "An experience title or activity", "For example: Campus volunteer", (e, p) => build([[{title:"Practice item",year:2024},{title:own(p),year:2021}],[{title:"Club",year:2025},{title:"Study",year:2020},{title:"Project",year:2022}]], e, (v) => `experience = ${pack(v)}`, 'print(json.dumps([item["title"] for item in result]))'),
  (r, p) => personalCheck(r, [[own(p),"Practice item"],["Study","Project","Club"]], "The earliest practice year should appear first.", own(p)));

setupPersonal(2, "bulletText", "A short line in your own words", "Write a short line", (e, p) => build([own(p),"  Practice Text  "], e, (v) => `text = ${quote(v)}`, "print(json.dumps(result))"),
  (r, p) => personalCheck(r, [own(p).toLowerCase(),"practice text"], "Keep the words, remove outer spaces, and make the letters lowercase.", own(p).toLowerCase()));

setupPersonal(3, "oneSkill", "One of your skills", "For example: Research", (e, p) => build([{skill:own(p)},{skill:"Music"}], e, (v) => `saved = ${quote(JSON.stringify(v))}`, 'print(json.dumps(result["skill"]))'),
  (r, p) => personalCheck(r, [own(p),"Music"], "Read the saved text into a dictionary before looking up its skill.", own(p)));

const countSkills = (values) => values.reduce((out, v) => { out[v] = (out[v] || 0) + 1; return out; }, Object.create(null));
setupPersonal(4, "skills", "Your skills, separated by commas", "For example: Research, Design", (e, p) => build([ownList(p),["code","code","code","design","design"]], e, (v) => `from collections import Counter\nskills = ${pack(v)}`, "print(json.dumps(result, sort_keys=True))"),
  (r, p) => personalCheck(r, [countSkills(ownList(p)),{code:3,design:2}], "The result needs each different skill and its count.", countSkills(ownList(p))));

const svgEscape = (s) => String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
const chart = (counts) => {
  const top = Object.keys(counts).sort((a,b) => counts[b] - counts[a]).slice(0,2);
  return { top, svg: `<svg>${top.map((k) => `<g><text>${svgEscape(k)}</text><rect width="${counts[k] * 10}" height="10"/></g>`).join("")}</svg>` };
};
setupPersonal(5, "skills", "Your skills, separated by commas", "For example: Research, Design", (e, p) => build([countSkills(ownList(p)),{code:1,design:4,writing:7}], e, (v) => `from html import escape\ncounts = ${pack(v)}`, 'svg = "<svg>" + "".join("<g><text>" + escape(str(k)) + "</text><rect width=\\"" + str(counts[k] * 10) + "\\" height=\\"10\\"/></g>" for k in result) + "</svg>"\nprint(json.dumps({"top": result, "svg": svg}))'),
  (r, p) => { const first = chart(countSkills(ownList(p))); return personalCheck(r, [first,chart({code:1,design:4,writing:7})], "The chart needs the two highest counts in order. Check the sort direction and slice.", first.top); });

LEVEL2_QUESTS[6].explain += " Match the spelling and capital letters in both lists so Python can identify the same skill.";
LEVEL2_QUESTS[6].prompt = "Find the skills shared by your list and the posting skills you entered.";
LEVEL2_QUESTS[6].explain += " For this exercise, spelling and capital letters must match exactly.";
LEVEL2_QUESTS[6].secondaryKey = "postingSkills";
LEVEL2_QUESTS[6].secondaryLabel = "Skills from the job posting, separated by commas";
LEVEL2_QUESTS[6].secondaryPlaceholder = "For example: Research, Python";
const postingInputs = (personal) => {
  try {
    const parsed = JSON.parse(personal);
    if (!parsed || typeof parsed.skills !== "string" || typeof parsed.postingSkills !== "string") return null;
    return { mine: ownList(parsed.skills), job: ownList(parsed.postingSkills) };
  } catch { return null; }
};
const intersection = ({ mine, job }) => [...new Set(mine.filter((v) => job.includes(v)))].sort();
setupPersonal(6, "skills", "Your skills, separated by commas", "For example: Research, Design", (e,p) => {
  const inputs = postingInputs(p) || { mine: [], job: [] };
  return build([inputs,{mine:["design","writing","code"],job:["writing","design","math"]}], e,
    (v) => `my_skills = ${pack(v.mine)}\njob_skills = ${pack(v.job)}`, "print(json.dumps(sorted(result)))");
}, (r,p) => {
  const inputs = postingInputs(p);
  if (!inputs || !inputs.mine.length || !inputs.job.length) return {pass:false,msg:"Enter your skills and the posting's skills, separated by commas."};
  const shared = intersection(inputs);
  return personalCheck(r,[shared,["design","writing"]],"Keep only skills appearing in both lists.",shared);
});

setupPersonal(7, "safeText", "A short line in your own words", "Write a short line", (e,p) => [own(p),"Tea & cake"].map((v) => `import json\nfrom html import escape\ndef card(text):\n    return "<p>" + (${e}) + "</p>"\nprint(json.dumps(card(${quote(v)})))\n`),
  (r,p) => personalCheck(r,[`<p>${svgEscape(own(p))}</p>`,"<p>Tea &amp; cake</p>"],"Escape special characters before adding the paragraph tags.",own(p)));
