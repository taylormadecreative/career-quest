import { pythonString } from "./first-run-rules.js";

const text = (v) => String(v ?? "").trim();
const skillList = (v) => text(v).split(",").map((s) => s.trim()).filter(Boolean).slice(0, 12);
const alternateSkills = (items) => items[0] === "Sketching" ? ["Dancing", "Planning"] : ["Sketching", "Listening"];
const alternateCount = (value) => Number(value) === 7 ? "008" : "007";
const pylist = (items) => `[${items.map(pythonString).join(", ")}]`;
const alternate = (actual, one, two) => actual === one ? two : one;
function beginnerError(report) {
  if (!report) return "Python did not return a result. Try running again.";
  if (report.kind === "syntax" || report.name === "SyntaxError") {
    if (/string|quote/i.test(report.msg || "")) return "A piece of text may be missing a quotation mark. Check that the opening and closing quotes match.";
    return "Python could not read this instruction. Check the punctuation and make sure parentheses and quotes are paired.";
  }
  if (report.name === "NameError") return "Python does not recognize a name. Check its spelling and capital letters; quoted text and saved names work differently.";
  if (report.name === "IndexError") return "Python tried to use a position that is not in this list. The first position is 0.";
  if (report.name === "ValueError") return "Python could not use that value here. If you are converting a number, check that the input contains only digits.";
  if (report.name === "TypeError") return "Python tried to use two kinds of information that do not fit together. Check whether the value is text or a number.";
  if (report.name === "ZeroDivisionError") return "Python tried to divide by zero. Check the number after the division sign.";
  return "Python stopped while running this instruction. Check the expression in the blank and try one small change.";
}
function evaluate(runs, expected, value, extra = {}) {
  if (!Array.isArray(runs) || runs.length !== 2) return { pass: false, msg: "Python did not finish both checks. Try again." };
  if (!runs[0]?.ok) return { pass: false, msg: beginnerError(runs[0]) };
  if (runs[0].stdout !== expected[0]) return { pass: false, msg: "The output is different from the goal. Compare it with the example and try again." };
  if (!runs[1]?.ok) return { pass: false, msg: `That ran for your input, but stopped for another example. ${beginnerError(runs[1])}` };
  if (runs[1].stdout !== expected[1]) return { pass: false, msg: "That worked for this input. Make the instruction work when the input changes, too." };
  return { pass: true, result: { value, output: runs[0].stdout, ...extra } };
}
const pred = (question, choices) => ({ question, choices: choices.map(([text, feedback, correct = false]) => ({ text, feedback, correct })) });
const picks = (before, after, choices) => ({ before, after, choices: choices.map(([code, why]) => ({ label: code, code, why })) });
const hint = (a, b, c) => [a, b, c];
const input = (key, label, placeholder) => ({ personalKey: key, personalLabel: label, personalPlaceholder: placeholder });
const q = pythonString;

export const LEVEL1_QUESTS = [
  {
    id: "1.2", title: "Name Tag", concept: "variables and f-strings",
    ...input("name", "Your name", "The name you want on your portfolio"),
    explain: "A variable is a name that holds a value, like a labeled box. An f-string puts a value inside text: put f before the quotes and a variable name inside curly braces.",
    example: 'animal = "fox"\nprint(f"Meet the {animal}")  # shows Meet the fox',
    predict: pred('What does animal = "fox" followed by print(f"Meet the {animal}") show?', [["Meet the fox", "The braces insert the value held in animal.", true], ["Meet the animal", "That would be the word itself; the braces insert the stored value."], ["An error", "The f and matching quotes make this valid."]]),
    prompt: "Use your name to make a greeting. Choose what goes inside print.",
    pick: picks("print(", ")", [['f"Hello, {PROFILE_NAME}"', "Run it to check the greeting."], ['"Hello, PROFILE_NAME"', "This treats PROFILE_NAME as literal letters."], ['PROFILE_NAME', "This shows the name but leaves out the greeting."]]),
    hints: hint("Look for the greeting words and the place where the name should appear.", "An f-string begins with f and uses curly braces to insert a stored value.", 'With color = "blue", f"Sky: {color}" becomes Sky: blue.'),
    why: "An f-string joins the greeting with the value stored under the name PROFILE_NAME.", interview: "In a guided exercise, I used a variable and an f-string to make a message adapt to its input.",
    sources(expr, personal) { return [text(personal), alternate(text(personal), "Avery", "Morgan")].map((n) => `PROFILE_NAME = ${q(n)}\nprint(${expr})\n`); },
    check(runs, personal) { const n = text(personal); if (!n) return { pass: false, msg: "Add your name first." }; return evaluate(runs, [`Hello, ${n}\n`, `Hello, ${alternate(n, "Avery", "Morgan")}\n`], `Hello, ${n}`); },
  },
  {
    id: "1.3", title: "Skill Shelf", concept: "lists and positions",
    ...input("skills", "Your skills, separated by commas", "Research, teamwork, writing"),
    explain: "A list keeps items in order. Python numbers positions starting at 0, so [0] means the first item.",
    example: 'fruit = ["pear", "lime"]\nprint(fruit[0])  # shows pear',
    predict: pred('What does ["pear", "lime"][0] give?', [["pear", "Position 0 is the first item.", true], ["lime", "Lime is in position 1."], ["0", "The 0 selects a position; it is not the item itself."]]),
    prompt: "Enter at least one skill, then choose how to show the first skill on your list.",
    pick: picks("print(", ")", [["skills[0]", "Run it to see the first skill."], ["skills[1]", "Position 1 selects the second item, if there is one."], ['"skills[0]"', "Quotes show the letters instead of selecting an item."]]),
    hints: hint("Find the first item and its position in the list.", "Python counts list positions from zero, not one.", 'For colors = ["red", "teal"], colors[0] selects red.'),
    why: "The first item has position zero, so the code selected your first skill.", interview: "In a guided exercise, I selected an item from a list by its position.",
    sources(expr, personal) { return [skillList(personal), alternateSkills(skillList(personal))].map((s) => `skills = ${pylist(s)}\nprint(${expr})\n`); },
    check(runs, personal) { const s = skillList(personal); if (!s.length) return { pass: false, msg: "Add at least one skill first." }; return evaluate(runs, [`${s[0]}\n`, `${alternateSkills(s)[0]}\n`], s[0], { skills: s }); },
  },
  {
    id: "1.4", title: "Badge Factory", concept: "for loops",
    ...input("skills", "Your skills, separated by commas", "Research, teamwork, writing"),
    explain: "A loop repeats an action for each item in a list. In for skill in skills, skill is the current item each time the action runs.",
    example: 'for fruit in ["pear", "lime"]:\n    print(fruit)  # shows pear, then lime',
    predict: pred('What does a loop printing each item in ["pear", "lime"] show?', [["pear, then lime", "The action runs once per item, in order.", true], ["Only pear", "The loop continues to the next item."], ["The word fruit twice", "Without quotes, fruit is the current item."]]),
    prompt: "Show each of the skills you entered. Choose what print should show on every trip through the loop.",
    pick: picks("for skill in skills:\n    print(", ")", [["skill", "Run it to show each skill."], ['"skill"', "Quotes show the same letters each time."], ["skills[0]", "This repeats the first skill instead of showing each item."]]),
    hints: hint("Follow the loop as it visits one skill and then another.", "The short name after for changes to the current item on each trip.", 'In for fruit in ["pear", "lime"], fruit is pear first and lime next.'),
    why: "The loop visited each item and printed its value, making a list of your own skills.", interview: "In a guided exercise, I used a loop to process each item in a list.",
    sources(expr, personal) { return [skillList(personal), alternateSkills(skillList(personal))].map((s) => `skills = ${pylist(s)}\nfor skill in skills:\n    print(${expr})\n`); },
    check(runs, personal) { const s = skillList(personal); if (!s.length) return { pass: false, msg: "Add at least one skill first." }; return evaluate(runs, [s.map((x) => x + "\n").join(""), alternateSkills(s).map((x) => x + "\n").join("")], s, { skills: s, count: s.length }); },
  },
  {
    id: "1.5", title: "By the Numbers", concept: "numbers and conversion", optional: true,
    ...input("stat", "A number from your own experience", "For example, a count you can explain"),
    explain: "Digits typed into a form arrive as text. int converts whole-number text into a number Python can use in math. The game checks the kind of value too: int means a whole number; str means text.",
    example: 'amount = "07"\nprint(int(amount))  # shows 7',
    predict: pred('What does int("07") produce?', [["7", "int converts the text to a whole number.", true], ["07 as text", "The result is a number, so the leading zero is not part of it."], ["An error", "07 is valid text for a whole number."]]),
    prompt: "Enter a nonnegative whole number that belongs to you, then convert it so Python can use it as a number.",
    pick: picks("number = ", "\nprint(number)\nprint(type(number).__name__)", [["int(NUMBER_TEXT)", "Run it to convert the text."], ["NUMBER_TEXT", "That leaves the input as text."], ['"NUMBER_TEXT"', "That shows the name as literal text."]]),
    hints: hint("The input begins as text, even when it contains digits.", "Find the operation that changes digit text into a whole number.", 'For amount = "03", converting it to a whole number gives 3.'),
    why: "The conversion changed the digit text into a whole number.", interview: "In a guided exercise, I converted a text input into a number before using it.",
    sources(expr, personal) { return [text(personal), alternateCount(personal)].map((s) => `NUMBER_TEXT = ${q(s)}\nnumber = ${expr}\nprint(number)\nprint(type(number).__name__)\n`); },
    check(runs, personal) {
      const s = text(personal); if (!/^\d{1,6}$/.test(s)) return { pass: false, msg: "Enter a nonnegative whole number using up to six digits." };
      const n = Number(s), expected = [`${n}\nint\n`, `${Number(alternateCount(personal))}\nint\n`];
      if (Array.isArray(runs) && runs.length === 2 && runs[0]?.ok && runs[0].stdout === `${n}\nstr\n`) return { pass: false, msg: "Those digits look right, but Python still sees text (str). Convert the text to a whole number (int)." };
      return evaluate(runs, expected, n);
    },
  },
  {
    id: "1.6", title: "Smart Messages", concept: "if and else",
    ...input("experience", "One real experience you want to share (optional)", "A project, volunteer role, class, or job"), personalRequired: false,
    explain: "An if statement chooses an action when a condition is true. An else statement chooses a different action when it is false. Empty text counts as false in this check.",
    example: 'if item:\n    print(item)\nelse:\n    print("Nothing yet")',
    predict: pred('If item is empty text, which message does the example show?', [["Nothing yet", "Empty text is false, so the else action runs.", true], ["The item", "There is no text in the item, so the else action runs."], ["Both messages", "Only one branch runs."]]),
    prompt: "Use the experience you entered, or leave it blank. Choose a condition so the program shows your experience when it exists and a reminder when it does not.",
    pick: picks("if ", ':\n    print(EXPERIENCE)\nelse:\n    print("No experience added yet")', [["EXPERIENCE", "Run it to check both cases."], ['"EXPERIENCE"', "This literal text is not empty even when your experience is blank."], ['""', "This empty text stays false even when you add experience."]]),
    hints: hint("The condition should change when your input is empty or filled in.", "A fixed piece of quoted text stays the same; the stored input can change.", 'If note = "", a check of note chooses the else branch; a nonempty note chooses the first branch.'),
    why: "The condition checked whether the input contained text and chose one branch.", interview: "In a guided exercise, I used a condition to handle both an empty input and a filled-in one.",
    sources(expr, personal) { const v = text(personal); return [v, v ? "" : "Helped at a library"].map((s) => `EXPERIENCE = ${q(s)}\nif ${expr}:\n    print(EXPERIENCE)\nelse:\n    print("No experience added yet")\n`); },
    check(runs, personal) { const s = text(personal), alt = s ? "" : "Helped at a library"; const out = (x) => (x || "No experience added yet") + "\n"; return evaluate(runs, [out(s), out(alt)], s); },
  },
  {
    id: "1.7", title: "Your First Function", concept: "functions and return", optional: true,
    ...input("nextStep", "A next step you choose", "A real step you plan to take"),
    explain: "A function is a named set of instructions you can use again. A parameter is a name for information the function receives, and return sends a result back.",
    example: 'def echo(item):\n    return item\nprint(echo("pear"))  # shows pear',
    predict: pred('What does echo("pear") return in the example?', [["pear", "The function returns the value passed as item.", true], ["item", "item holds the passed value; it is not quoted."], ["Nothing", "The return instruction sends a value back."]]),
    prompt: "Give the function your next step. Choose what it should return.",
    pick: picks("def keep_step(step):\n    return ", "\nprint(keep_step(NEXT_STEP))", [["step", "Run it to return the step."], ['"step"', "This returns the literal letters step."], ['""', "This returns empty text."]]),
    hints: hint("The function receives one piece of text under a short name.", "return sends a value back; quoted words are literal text.", 'In def echo(item):, returning item sends back the value provided when echo is called.'),
    why: "The function received the next step and returned that value to the caller.", interview: "In a guided project, I completed a function that receives and returns a value.",
    sources(expr, personal) { const s = text(personal); return [s, alternate(s, "Read a chapter", "Practice a skill")].map((v) => `NEXT_STEP = ${q(v)}\ndef keep_step(step):\n    return ${expr}\nprint(keep_step(NEXT_STEP))\n`); },
    check(runs, personal) { const s = text(personal); if (!s) return { pass: false, msg: "Add your next step first." }; return evaluate(runs, [`${s}\n`, `${alternate(s, "Read a chapter", "Practice a skill")}\n`], s); },
  },
  {
    id: "1.8", title: "Ship It", concept: "Python builds a piece of your webpage",
    ...input("nextStep", "Your next step", "A real step you plan to take"),
    explain: "A webpage is made from HTML: text with labels called tags, such as <p> for a paragraph. This Python script puts your own words into a paragraph. The escape tool protects characters such as < and & so they appear as your words on the page.",
    example: 'message = "Read a chapter"\nprint("<p>" + message + "</p>")  # makes a paragraph',
    predict: pred('If message is "Read", what does "<p>" + message + "</p>" make?', [["<p>Read</p>", "The paragraph tags surround the value stored in message.", true], ["<p>message</p>", "Without quotes around message, Python reads its value."], ["Read", "The paragraph tags are joined to the text, too."]]),
    prompt: "Finish your Python script. It will make a real HTML section for your next step; you can see that section in your portfolio.",
    pick: picks('from html import escape\n# NEXT_STEP holds your own words\nsafe_step = escape(', ')\nsection = "<section><h2>My next step</h2><p>" + safe_step + "</p></section>"\nprint(section)', [["NEXT_STEP", "Run it to build a section from your own words."], ['"NEXT_STEP"', "Quotes would add the letters NEXT_STEP instead of your own words."], ['""', "This would make an empty paragraph."]]),
    hints: hint("Look for the text you entered and the place where the paragraph is assembled.", "Use the value saved for your next step, rather than fixed words in quotation marks.", 'For a different example, when task = "Read", using task without quotes reads the value "Read".'),
    why: "Your Python used your own words, escaped special characters, and wrapped them in HTML tags to make a webpage section.", interview: "In a guided Python project, I built part of a webpage using my own text and made special characters safe to display.",
    sources(expr, personal) { const s = text(personal); return [s, alternate(s, "Read a chapter", "Practice a skill")].map((v) => `from html import escape\nNEXT_STEP = ${q(v)}\nsafe_step = escape(${expr})\nsection = "<section><h2>My next step</h2><p>" + safe_step + "</p></section>"\nprint(section)\n`); },
    check(runs, personal) {
      const s = text(personal); if (!s) return { pass: false, msg: "Add your next step first." };
      const escapeHtml = (v) => v.replace(/[&<>"']/g, (ch) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#x27;"}[ch]));
      const section = (v) => `<section><h2>My next step</h2><p>${escapeHtml(v)}</p></section>\n`;
      const verdict = evaluate(runs, [section(s), section(alternate(s, "Read a chapter", "Practice a skill"))], s);
      if (verdict.pass) verdict.result.html = runs[0].stdout;
      return verdict;
    },
  },
];

// Show the student's own setup and the editable blank. These examples are not
// the second, hidden proof run; hints and checks never reveal that answer.
const displayById = {
  "1.2": (p) => `PROFILE_NAME = ${q(text(p))}\nprint(____)`,
  "1.3": (p) => `skills = ${pylist(skillList(p))}\nprint(____)`,
  "1.4": (p) => `skills = ${pylist(skillList(p))}\nfor skill in skills:\n    print(____)`,
  "1.5": (p) => `NUMBER_TEXT = ${q(text(p))}\nnumber = ____\nprint(number)`,
  "1.6": (p) => `EXPERIENCE = ${q(text(p))}\nif ____:\n    print(EXPERIENCE)\nelse:\n    print("No experience added yet")`,
  "1.7": (p) => `NEXT_STEP = ${q(text(p))}\ndef keep_step(step):\n    return ____\nprint(keep_step(NEXT_STEP))`,
  "1.8": (p) => `from html import escape\nNEXT_STEP = ${q(text(p))}\nsafe_step = escape(____)\nsection = "<section><h2>My next step</h2><p>" + safe_step + "</p></section>"\nprint(section)`,
};
for (const quest of LEVEL1_QUESTS) quest.displayCode = displayById[quest.id];
// The type marker in this run is for the checker; learners see their actual value.
LEVEL1_QUESTS.find((quest) => quest.id === "1.5").publicOutput = (output) => String(output || "").replace(/\n(?:int|str|float|bool|NoneType)\n$/, "\n");
