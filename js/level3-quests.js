// Level 3 quests. Choice examples are instructional; grading executes Python twice
// and compares its actual behavior to the expected results, not its source text.
const py = (s) => JSON.stringify(s);
const select = (text, feedback, correct = false) => ({ text, feedback, correct });
const opt = (code, why) => ({ label: code, code, why });
const hints = (a, b, c) => [a, b, c];
const personalText = (value, fallback) => typeof value === "string" && value.trim() ? value.trim() : fallback;
function makeQuest(config) {
  const { cases, script, ...data } = config;
  const examples = (personal) => typeof cases === "function" ? cases(personal) : cases;
  return {
    ...data,
    sources(expression, personal) { return examples(personal).map((item) => script(expression, item, personal)); },
    check(runs, personal) {
      const checked = examples(personal);
      if (!Array.isArray(runs) || runs.length !== checked.length) return { pass: false, msg: "Python did not finish both checks. Run it again." };
      const error = runs.find((run) => !run?.ok);
      if (error) return { pass: false, msg: `Python stopped${error.name ? ` with ${error.name}` : ""}. Check the spelling and the structure, then try again.` };
      if (runs.some((run, i) => run.stdout !== checked[i].expected)) return { pass: false, msg: "The result is not right for both examples. Compare the output with the goal and try a different expression." };
      return { pass: true, result: { output: runs[0].stdout.trimEnd() } };
    },
  };
}

export const LEVEL3_QUESTS = [
  makeQuest({
    id: "3.1", title: "Blueprint", concept: "Dataclasses and type hints",
    personalKey: "blueprintSkill", personalLabel: "A skill for your blueprint", personalPlaceholder: "A skill you have",
    explain: ["A dataclass is a reusable blueprint for related information. A type hint describes the kind of value a field is meant to hold.", "This blueprint has one text field, label. Create a Skill with the value stored in skill_name."],
    example: '@dataclass\nclass Pet:\n    name: str\n\nPet(name="Milo")',
    predict: { question: 'If a Pet is made with name="Milo", what does pet.name hold?', choices: [select("Milo", "Yes. The field holds the value supplied when the object was created.", true), select("name", "That is the field's label; look for the value supplied to it."), select("Nothing", "The object was created with a value for this field.")] },
    prompt: "Fill the blank to create a Skill that holds the current skill name. Run it on two different names.",
    pick: { before: "skill = Skill(label=", after: ")", choices: [opt('"skill_name"', "Quotes make this the literal words skill_name."), opt("skill_name", "This reads the current value saved under that name."), opt('""', "An empty string cannot hold the skill name.")] },
    hints: hints("Look at what the printed field contains. Is it the current name?", "Use the value stored under the name, not the characters in that name.", 'For a different example, if animal = "fox", which expression reads the value of animal?'),
    why: "The Skill blueprint gives the value a named field; creating an instance puts the current label into that field.",
    interview: "In a guided exercise, I used a small data model to keep a field and its value together.",
    cases: (personal) => { const name = personalText(personal, "Research"); const alternate = name === "Design" ? "Writing" : "Design"; return [{ name, expected: `${name}\n` }, { name: alternate, expected: `${alternate}\n` }]; },
    script: (e,c) => `from dataclasses import dataclass\n@dataclass\nclass Skill:\n    label: str\nskill_name = ${py(c.name)}\nskill = Skill(label=${e})\nprint(skill.label)\n`,
  }),
  makeQuest({
    id: "3.2", title: "Components", concept: "Pure functions and composition",
    personalKey: "componentSkill", personalLabel: "A skill to turn into a component", personalPlaceholder: "A skill you have",
    explain: ["A pure function returns an output from its inputs without changing outside data. Small functions can be combined: the output of one becomes the input of another.", "Make a label from the current skill, then pass it into a second function that adds brackets."],
    example: 'def double(n):\n    return n * 2\n\ndef show(n):\n    return "[" + str(n) + "]"',
    predict: { question: 'What does show(double(2)) return in the example?', choices: [select("[4]", "Yes. double produces 4, then show wraps it.", true), select("[2]", "The first function doubles the number before show receives it."), select("4", "show adds brackets around the result.")] },
    prompt: "Fill the blank in make_label so the composed functions use the skill passed in.",
    pick: { before: '    return "Skill: " + ', after: "", choices: [opt('"label"', "This adds the literal word label."), opt("label", "This uses the input supplied to the function."), opt('""', "This leaves the actual skill out.")] },
    hints: hints("Look at the output inside the brackets. Is the skill there?", "A function's parameter refers to the value handed to it.", 'For a different function def greet(person), how would it use the input person instead of the word "person"?'),
    why: "The first function returns a label for its input, and the second wraps that returned text without changing outside data.",
    interview: "In a guided exercise, I completed a step in a program that combines small functions.",
    cases: (personal) => { const label = personalText(personal, "Writing"); const alternate = label === "Research" ? "Design" : "Research"; return [{ label, expected: `[Skill: ${label}]\n` }, { label: alternate, expected: `[Skill: ${alternate}]\n` }]; },
    script: (e,c) => `def make_label(label):\n    return "Skill: " + ${e}\ndef frame(text):\n    return "[" + text + "]"\nprint(frame(make_label(${py(c.label)})))\n`,
  }),
  makeQuest({
    id: "3.3", title: "Tailor to a Posting", concept: "Regular expressions and multi-key sorting",
    personalKey: "matchSkill", personalLabel: "One skill word to match", personalPlaceholder: "For example, writing",
    explain: ["A regular expression, or regex, is a pattern used to find text. Here it finds words in a posting, so we can keep matching skills.", "A sort key can contain two parts: a negative score puts bigger scores first, then a lowercase label puts ties in alphabetical order."],
    example: 'words = re.findall(r"[a-z]+", "data AND design".lower())\n# words contains data, and, design',
    predict: { question: "Two matching skills have the same score. Which comes first when the second sort key is the lowercase name?", choices: [select("The name earlier in the alphabet", "Yes. The second key breaks a tie alphabetically.", true), select("The longer name", "Length is not used in the sort key."), select("The one typed last", "The name is the tie breaker, not the input order.")] },
    prompt: "Choose a sort key that orders matching skills by highest score, then by name. The practice match uses the first word of your skill.",
    pick: { before: "ranked = sorted(matches, key=lambda item: ", after: ")", choices: [opt('(item[1], item[0].lower())', "That puts smaller scores first."), opt('(-item[1], item[0].lower())', "The minus sign puts higher scores first; the name breaks ties."), opt('item[0].lower()', "This sorts by name but ignores the scores.")] },
    hints: hints("Check which score appears first, then check the order of tied names.", "A tuple sort compares its first part, then its second part when the first parts match.", "In a different list of scores 2 and 8, compare -2 with -8: which comes first when sorting small to large?"),
    why: "Regex found words to match. Sorting negative scores made the largest score first, and the name resolved ties.",
    interview: "In a guided exercise, I completed a two-part sort key for skills matched to a practice posting.",
    cases: (personal) => { const match = personalText(personal, "research").match(/[a-z]+/i); const own = match ? match[0].toLowerCase() : "research"; const other = own === "design" ? "writing" : "design"; return [
      { post: `${own} and ${other}`, skills: [[other, 2], [own, 8]], expected: `${own}, ${other}\n` },
      { post: "Design and research", skills: [["Research", 5], ["Design", 5], ["Writing", 9]], expected: "Design, Research\n" },
    ]; },
    script: (e,c) => `import re\nwords = re.findall(r"[a-z]+", ${py(c.post)}.lower())\nskills = ${JSON.stringify(c.skills)}\nmatches = [item for item in skills if item[0].lower() in words]\nranked = sorted(matches, key=lambda item: ${e})\nprint(", ".join(item[0] for item in ranked))\n`,
  }),
  makeQuest({
    id: "3.4", title: "Error-Proofing", concept: "try, except and validation",
    explain: ["Some text cannot be turned into a number. A try block attempts an operation, and except handles a matching error so the program can continue.", "Choose the fallback for invalid input. Zero means no count was entered; it does not invent experience."],
    example: 'try:\n    count = int(text)\nexcept ValueError:\n    count = 0',
    predict: { question: 'What happens when int("many") is attempted?', choices: [select("It raises a ValueError", "Yes. The except block can handle that error.", true), select("It returns 1", "Python does not guess a number from that word."), select("It returns many", "int tries to make a number; it cannot convert this word.")] },
    prompt: "Fill in the fallback returned for text that is not a whole number.",
    pick: { before: "        return ", after: "", choices: [opt("0", "Zero is the chosen safe fallback for an invalid count."), opt("1", "That would invent a count of one."), opt('"unknown"', "This returns text rather than the number the caller expects.")] },
    hints: hints("Compare the normal number and the result for invalid text.", "The except branch should return the specified numeric fallback.", 'For another example, if int("several") raises ValueError, which whole number did the lesson choose as its fallback?'),
    why: "The conversion succeeds for numeric text. For invalid text, ValueError is caught and a safe fallback is returned.",
    interview: "In a guided exercise, I handled an invalid input explicitly so a program could continue without guessing data.",
    cases: [{ good: "7", bad: "many", expected: "7\n0\n" }, { good: "3", bad: "none", expected: "3\n0\n" }],
    script: (e,c) => `def to_count(text):\n    try:\n        return int(text)\n    except ValueError:\n        return ${e}\nprint(to_count(${py(c.good)}))\nprint(to_count(${py(c.bad)}))\n`,
  }),
  makeQuest({
    id: "3.5", title: "Prove It", concept: "Tests and edge cases",
    personalKey: "testPhrase", personalLabel: "A short phrase to clean and test", personalPlaceholder: "Words from your own project",
    explain: ["A test checks whether code behaves as expected. An edge case is an input near a boundary, such as empty text.", "This test should accept a clean empty string and catch a broken version that returns the wrong result for empty input."],
    example: 'assert clean("   ") == ""\n# An assertion fails if the comparison is false.',
    predict: { question: 'What happens when assert 2 == 3 runs?', choices: [select("The assertion fails", "Yes. The comparison is false, so Python raises an AssertionError.", true), select("It prints 2", "An assertion checks a condition; it does not print the first value."), select("It changes 2 to 3", "A comparison does not change either value.")] },
    prompt: "Choose the assertion that checks whether empty text stays empty.",
    pick: { before: "    assert ", after: "", choices: [opt('clean("") == ""', "This checks the empty-input boundary."), opt('clean("cat") == "cat"', "This only tests a normal input, so the empty-input bug can pass."), opt('True', "This always passes, even when the function is broken.")] },
    hints: hints("One check uses working code and the other uses a version broken only for an empty input.", "A useful test must fail when that boundary behavior is wrong.", 'For a different trim function, what input would test the boundary where there are no letters at all?'),
    why: "The assertion checks the edge case directly; the test passes for the working function and catches the broken one.",
    interview: "In a guided exercise, I completed an edge-case test and saw it catch a defect.",
    cases: (personal) => { const phrase = personalText(personal, "Practice"); return [{ phrase, broken: false, expected: `${phrase}\ntest passed\n` }, { phrase: "Example", broken: true, expected: "Example\ntest caught bug\n" }]; },
    script: (e,c) => `def clean(text):\n    return ${c.broken ? '"wrong" if text == "" else text.strip()' : 'text.strip()'}\nprint(clean(${py(c.phrase)}))\ndef test_empty():\n    assert ${e}\ntry:\n    test_empty()\n    print("test passed")\nexcept AssertionError:\n    print("test caught bug")\n`,
  }),
  makeQuest({
    id: "3.6", title: "Accessible by Design", concept: "Contrast math and themes",
    explain: ["Contrast measures the difference in light between two colors. The ratio uses relative luminance: a brightness value from 0 (darkest) to 1 (lightest).", "Put the lighter value on top, add 0.05 to both values, and divide. A larger ratio means more contrast."],
    example: 'contrast = (high + 0.05) / (low + 0.05)',
    predict: { question: "Which pair has the greater contrast: black and white, or two similar grays?", choices: [select("Black and white", "Yes. They are farther apart in luminance.", true), select("Two similar grays", "Similar luminance values produce a ratio closer to 1."), select("They are always equal", "The ratio changes with the luminance values.")] },
    prompt: "Choose the contrast formula; the inputs here are already linear relative luminance values.",
    pick: { before: "ratio = ", after: "", choices: [opt("(lighter + 0.05) / (darker + 0.05)", "The brighter value goes on top, and both get 0.05."), opt("lighter / darker", "This omits the offsets and can divide by zero."), opt("(darker + 0.05) / (lighter + 0.05)", "This reverses the ratio and makes it less than or equal to 1.")] },
    hints: hints("Compare the result for black and white with the one for less separated values.", "Add the same small offset to both luminances before dividing, with the lighter value above.", "For another pair, lighter = 0.8 and darker = 0.2. What goes in the top and bottom of the ratio?"),
    why: "The offset formula compares the lighter and darker luminance values without dividing by zero.",
    interview: "In a guided exercise, I calculated contrast from luminance values to help assess a theme's readability.",
    cases: [{ light: "1.0", dark: "0.0", expected: "21.0\n" }, { light: "0.5", dark: "0.05", expected: "5.5\n" }],
    script: (e,c) => `lighter = ${c.light}\ndarker = ${c.dark}\nratio = ${e}\nprint(round(ratio, 1))\n`,
  }),
  makeQuest({
    id: "3.7", title: "Skills Over Time", concept: "Dates and overlapping ranges",
    explain: ["A date range has a start and an end. Sort ranges by their start date: ranges that overlap can be combined, while ranges with a gap stay separate.", "For an overlap, keep the earlier start and whichever end is later. The dates in this exercise are practice data, not your portfolio dates."],
    example: 'longest = max(3, 7)  # the later of two numbers',
    predict: { question: "When two ranges overlap, which end belongs on their merged range?", choices: [select("The later end", "Yes. It covers the full combined span.", true), select("The earlier end", "That would cut off part of the longer range."), select("Either end", "Choosing the earlier end can lose part of the range.")] },
    prompt: "Choose the end that covers both overlapping ranges. The program will keep separate ranges when there is a gap.",
    pick: { before: "merged_end = ", after: "", choices: [opt("max(end_a, end_b)", "The later end covers both ranges."), opt("min(end_a, end_b)", "The earlier end may cut the range short."), opt("end_a", "The second range may extend beyond the first.")] },
    hints: hints("Look for one range inside another and another that extends past the first. Which ends should remain?", "When ranges overlap, use the later of their end dates; a separate range after a gap stays separate.", "For a different pair ending in March and May, which month must the combined range reach?"),
    why: "The loop sorts practice ranges, joins overlaps through their later end, and keeps ranges separated by a gap apart.",
    interview: "In a guided exercise, I completed a step that merges overlapping date ranges.",
    cases: [
      { ranges: [["2024-08-01", "2024-09-01"], ["2024-03-01", "2024-04-01"], ["2024-01-01", "2024-06-01"]], expected: "2024-01-01 to 2024-06-01\n2024-08-01 to 2024-09-01\n" },
      { ranges: [["2025-11-01", "2026-01-01"], ["2025-02-01", "2025-07-01"], ["2025-10-01", "2025-12-01"], ["2025-01-01", "2025-03-01"]], expected: "2025-01-01 to 2025-07-01\n2025-10-01 to 2026-01-01\n" },
    ],
    script: (e,c) => `from datetime import date\nranges = [(date.fromisoformat(a), date.fromisoformat(b)) for a, b in ${JSON.stringify(c.ranges)}]\nranges.sort()\nmerged = []\nfor start, end in ranges:\n    if not merged or start > merged[-1][1]:\n        merged.append((start, end))\n    else:\n        first_start, end_a = merged[-1]\n        end_b = end\n        merged_end = ${e}\n        merged[-1] = (first_start, merged_end)\nfor start, end in merged:\n    print(start.isoformat(), "to", end.isoformat())\n`,
  }),
  makeQuest({
    id: "3.8", title: "Package and Publish", concept: "main, zip and reproducibility",
    personalKey: "readmeNote", personalLabel: "A truthful note for your README", personalPlaceholder: "Describe your own project",
    explain: ["A main function groups the steps a program runs. A main guard runs those steps when the script is launched, while allowing it to be imported without running them.", "This script creates a zip in memory with a fixed timestamp, then checks that two runs match and that the README has the supplied text."],
    example: 'if status == "ready":\n    start()',
    predict: { question: "Why give the zip entry a fixed timestamp?", choices: [select("So identical inputs can produce identical archive bytes", "Yes. A changing timestamp can otherwise change the archive.", true), select("To make the text longer", "A timestamp is metadata; it does not add words to the README."), select("To hide the file", "The file remains present in the archive.")] },
    prompt: "Choose the standard name checked by the main guard when a script is run directly.",
    pick: { before: "if __name__ == ", after: ":", choices: [opt('"__main__"', "Python uses this name when running a script directly."), opt('"main"', "The special name has two underscores on both sides."), opt('"__import__"', "This is not the special name for a directly run script.")] },
    hints: hints("The script sets its run name to represent direct execution. What name does the guard compare it with?", "The special name for a directly run script has two underscores on each side.", 'For another condition, if status is "ready", what text would make a check against status true?'),
    why: "The main guard ran the packaging function for a direct launch. A fixed timestamp made repeated archives reproducible for the same input.",
    interview: "In a guided exercise, I completed a main guard and checked a reproducible archive.",
    cases: (personal) => { const note = personalText(personal, "Practice portfolio files"); const alternate = note === "Practice project notes" ? "Practice archive" : "Practice project notes"; return [{ note, expected: `same: True\nREADME.txt: ${note}\n` }, { note: alternate, expected: `same: True\nREADME.txt: ${alternate}\n` }]; },
    script: (e,c) => `import io, zipfile\n__name__ = "__main__"\ndef build():\n    buffer = io.BytesIO()\n    info = zipfile.ZipInfo("README.txt", (2020, 1, 1, 0, 0, 0))\n    with zipfile.ZipFile(buffer, "w") as archive:\n        archive.writestr(info, ${py(c.note)})\n    return buffer.getvalue()\ndef main():\n    first, second = build(), build()\n    print("same:", first == second)\n    with zipfile.ZipFile(io.BytesIO(first)) as archive:\n        print("README.txt:", archive.read("README.txt").decode())\nif __name__ == ${e}:\n    main()\n`,
  }),
];
