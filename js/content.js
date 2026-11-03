// Career Quest content: careers, the three challenges, hint ladders and explain prompts.
// Hint wording follows Jamal Ware's Guided_Hints_and_Notes.md (Observe -> Reason -> Practice).
// No challenge answers live in this file: success is checked by what the student's code DOES.
// Text wrapped in `backticks` renders as code.

export const CAREERS = [
  { id: "Data Analyst", icon: "chart", blurb: "Turns data into answers people can act on." },
  { id: "Data Scientist", icon: "flask", blurb: "Builds models that predict and explain." },
  { id: "Research Analyst", icon: "lens", blurb: "Investigates questions with evidence." },
];

export const SKILL_CHOICES = [
  "Excel", "Teamwork", "Public speaking", "Writing", "Research", "Organizing",
  "Math", "Leadership", "Customer service", "Design", "Social media", "Problem solving",
];

export const BUILDINGS = [
  { key: "summary", label: "Skills and Experience", short: "Experience" },
  { key: "explorer", label: "Career Explorer", short: "Explorer" },
  { key: "chart", label: "Skills Demand Chart", short: "Skills Chart" },
  { key: "strategy", label: "Career Strategy", short: "Strategy" },
  { key: "built", label: "How I Built This", short: "My Story" },
];

export const CHALLENGES = [
  {
    level: 1,
    step: "Filter",
    points: 8,
    unlocks: "explorer",
    mission: "Find the job postings for your career.",
    intro: "Line 1 saves your career in a variable (a name that stores a value) called TARGET_ROLE. Lines 2 and 3 say: keep each job in JOBS if its role equals ___. This code has one bug, a small mistake. Press Run to see what it does now, then change the highlighted line (line 3) and run it again.",
    // The briefing a total beginner reads first: the goal in real numbers, every line in plain English, the bug, the move.
    brief: (c) => ({
      goal: `Keep only the ${c.mine} ${c.role} postings out of all ${c.total}.`,
      lines: [
        { text: `Save your career, "${c.role}", under the name \`TARGET_ROLE\`.` },
        { text: "Go through every job posting in `JOBS`, one at a time,"  },
        { text: "and keep a posting only if its role (`job[\"role\"]`) equals (`==`) the text \"ROLE_GOES_HERE\".", bug: "No posting has that role, so right now this keeps 0." },
      ],
      move: "Change line 3 so it keeps the postings for your career. Then press Run.",
    }),
    lines: (role) => [
      { code: `TARGET_ROLE = ${JSON.stringify(role)}`, note: "from your profile" },
      { code: "matched_jobs = [job for job in JOBS" },
      { edit: true, indent: 4, start: 'if job["role"] == "ROLE_GOES_HERE"]' },
    ],
    hints: [
      { tier: "Observe", text: "Compare the career you picked with what comes after `==` in the filter. Are the two sides the same kind of thing?" },
      { tier: "Reason", text: "Words inside quotation marks are literal text: Python looks for those exact letters. A variable name, with no quotes, reads the value you stored earlier. Which one should follow your career choice?" },
      { tier: "Practice", text: "Say `favorite_fruit = \"mango\"`. Now `\"mango\" == \"favorite_fruit\"` is False: in quotes, it's just those letters. But `\"mango\" == favorite_fruit` is True: with no quotes, Python reads the value stored in the variable. Which one fits your filter?" },
    ],
    whatItDid: (r) => `Your filter read the career saved in TARGET_ROLE and kept ${r.n} of the ${r.total} postings, all ${r.role} jobs. Then we ran your same line as if a friend had picked ${r.alt}: it kept their ${r.altN} postings and none of yours. Your code really follows the variable.`,
    helpedWhat: (r) => `The fixed filter reads the career saved in TARGET_ROLE, so it keeps the ${r.n} ${r.role} postings out of ${r.total}. Pick a different career and the same code keeps different postings.`,
    why: "Change the career and the same code finds a different set of postings, without rewriting anything. That is what variables are for.",
    portfolioWhy: "It shows an employer you can narrow a big dataset down to the records that answer your question.",
    helpedPortfolioWhy: "This section shows how a filter narrows a big dataset down to the records that answer a question.",
    transfer: () => "What would happen if TARGET_ROLE had a typo, like \"Data Analist\"? How would you notice?",
    explain: {
      question: "How did your code focus the job data on your career?",
      helpedQuestion: "How does the fixed code focus the job data on your career?",
      starters: ["I wanted to find…", "My code kept only…", "Picking a different career would…"],
      helpedStarters: ["I wanted to find…", "The fixed code keeps only…", "With a helper, I learned…"],
    },
  },
  {
    level: 2,
    step: "Count",
    points: 8,
    unlocks: "chart",
    mission: "Count how many of your postings mention each skill.",
    intro: "Line 1 starts an empty tally. Lines 2 and 3 visit every skill in every one of your postings. Line 4 says: a skill's new count is its old count (0 the first time) plus ___. Press Run to see what the counter does now, then fix the highlighted line (line 4).",
    brief: (c) => ({
      goal: `Give every skill a count of the postings that list it. If 3 of your ${c.mine} postings list SQL, SQL's count should be 3.`,
      lines: [
        { text: "Start an empty tally called `counts`." },
        { text: "Go through each of your postings," },
        { text: "and through each skill listed on it." },
        { text: "Set the skill's count (`counts[skill]`) to its old count, or 0 if it's new (`counts.get(skill, 0)`), plus 0.", bug: "Adding 0 never changes anything, so every count stays at 0." },
      ],
      move: "Change line 4 so a skill's count goes up each time the skill shows up. Then press Run.",
    }),
    lines: () => [
      { code: "counts = {}" },
      { code: "for posting in matched_jobs:" },
      { code: "    for skill in posting[\"skills\"]:" },
      { edit: true, indent: 8, start: "counts[skill] = counts.get(skill, 0) + 0" },
    ],
    hints: [
      { tier: "Observe", text: "Follow one skill, like SQL, through the loop. When it shows up a second time, does its count change?" },
      { tier: "Reason", text: "A loop repeats the same step for every item. A counter has to move forward each time it sees something, like a tally mark for every mention." },
      { tier: "Practice", text: "Counting people walking into a room: `people_count = 0`. One more person walks in. What math makes the count show one more? Find the matching math in your loop." },
    ],
    whatItDid: (r) => `Your loop visited all ${r.n} of your postings and added one to a skill's tally every time it appeared: ${r.mentions} skill mentions in all.`,
    helpedWhat: (r) => `The fixed loop adds one to a skill's tally every time it appears: ${r.mentions} skill mentions across your ${r.n} postings.`,
    why: "That turns every posting's separate skill list into one summary you can chart. Data people call that aggregation.",
    portfolioWhy: "It shows you can move from single records to patterns across many records, and show them as a chart.",
    helpedPortfolioWhy: "This section shows how counting turns single records into a pattern across many records, shown as a chart.",
    transfer: () => "If SQL appeared in two more postings, how should its total change?",
    explain: {
      question: "What did your loop count? What can't this chart tell you?",
      helpedQuestion: "What does the loop count? What can't this chart tell you?",
      starters: ["The input was…", "The loop went through…", "The chart helped me see…", "One limit is…"],
      helpedStarters: ["The input was…", "The fixed loop goes through…", "The chart helped me see…", "One limit is…"],
    },
  },
  {
    level: 3,
    step: "Rank",
    points: 9,
    unlocks: "strategy",
    mission: "Find the three skills mentioned most, not least.",
    intro: "Lines 1 and 2 say: sort the skills by their counts, then keep the first three. Line 3 shows them. For a top three, the most common skills need to come first. Press Run to see which three it picks now, then fix the highlighted line (line 2).",
    brief: () => ({
      goal: "List your career's 3 most-mentioned skills, biggest count first.",
      lines: [
        { text: "Sort the skills in `counts` (your Level 2 tally)" },
        { text: "by each skill's count (`key=counts.get`), smallest first (`reverse=False`), then keep the first three (`[:3]`).", bug: "Smallest first means you get the three rarest skills, not the top three." },
        { text: "Show the three skills." },
      ],
      move: "Change line 2 so the biggest counts come first. Then press Run.",
    }),
    lines: () => [
      { code: "top_skills = sorted(counts," },
      { edit: true, indent: 4, start: "key=counts.get, reverse=False)[:3]" },
      { code: "print(top_skills)" },
    ],
    hints: [
      { tier: "Observe", text: "Look at the count for the first skill in your result and the last one. Which direction are the numbers going?" },
      { tier: "Reason", text: "Sorting can go smallest to largest or largest to smallest. Top means the highest counts, so the order matters as much as taking three." },
      { tier: "Practice", text: "Scores `4, 9, 2` sorted smallest first give `2, 4, 9`. For a winners' podium you want the other order. Find the part of the sort that controls direction." },
    ],
    whatItDid: (r) => `Your sort put the biggest counts first, so your top three are ${r.top.map(prettySkill).join(", ")}.`,
    helpedWhat: (r) => `The fixed sort puts the biggest counts first, so the top three are ${r.top.map(prettySkill).join(", ")}.`,
    why: "Highest first puts the skills that showed up most in this sample at the top, so you can decide what to practice next.",
    portfolioWhy: "It shows you can turn an analysis into a decision, and back it with evidence.",
    helpedPortfolioWhy: "This section shows how ranking turns an analysis into a decision backed by evidence.",
    transfer: () => "Why would sorting the other way tell a misleading story on a chart that says most common?",
    explain: {
      question: "Why does sorting highest first matter when you choose which skill to work on?",
      helpedQuestion: "Why does sorting highest first matter when you choose which skill to work on?",
      starters: ["Sorting highest first…", "The skill that stood out was…", "I will…"],
      helpedStarters: ["Sorting highest first…", "The skill that stood out was…", "I will…"],
    },
  },
];

// Friendly names for the dataset's lowercase skill labels.
const SKILL_NAMES = {
  sql: "SQL", python: "Python", excel: "Excel", r: "R", tableau: "Tableau", sas: "SAS", aws: "AWS",
  "power bi": "Power BI", azure: "Azure", spark: "Spark", java: "Java", scala: "Scala", go: "Go",
  snowflake: "Snowflake", looker: "Looker", word: "Word", powerpoint: "PowerPoint", "sql server": "SQL Server",
  oracle: "Oracle", spss: "SPSS", matlab: "MATLAB", hadoop: "Hadoop", databricks: "Databricks",
  tensorflow: "TensorFlow", pytorch: "PyTorch", pandas: "pandas", numpy: "NumPy", git: "Git",
  vba: "VBA", sheets: "Google Sheets", qlik: "Qlik", alteryx: "Alteryx", jira: "Jira", gcp: "GCP",
  "c++": "C++", "c#": "C#", c: "C", javascript: "JavaScript", "ms access": "MS Access", sharepoint: "SharePoint",
  "scikit-learn": "scikit-learn", bigquery: "BigQuery", redshift: "Redshift", mysql: "MySQL",
  postgresql: "PostgreSQL", nosql: "NoSQL", flow: "Flow", outlook: "Outlook", visio: "Visio", bash: "Bash",
  "data visualization": "Data Visualization", "machine learning": "Machine Learning", statistics: "Statistics",
  communication: "Communication", "research methods": "Research Methods",
};
export const prettySkill = (s) => SKILL_NAMES[s] || String(s).replace(/\b\w/g, (c) => c.toUpperCase());

// Words that change with the data set, so fictional practice data is never called real.
export const dataWords = (mode) => mode === "real"
  ? { postings: "real job postings from 2023", sample: "2023 sample", badge: "Data: 2023 U.S. job postings sample",
      source: "Source: Luke Barousse, data_jobs (2023). Historical sample, not current openings.", project: "real 2023 U.S. job postings" }
  : { postings: "made-up practice postings", sample: "practice data", badge: "Data: FICTIONAL practice postings",
      source: "Practice data made up for this workshop. Not real job-market data.", project: "made-up practice job postings" };

// Job titles come straight from scraped postings: drop pay, IDs and location tails for display.
export const cleanTitle = (t) => String(t).split(/\s+[-|–]\s+|\s*\/\s*\d|,\s*(?=[^,]*\$)/)[0].replace(/\s*\(.*?\$.*?\)\s*/g, " ").replace(/\s{2,}/g, " ").trim();
