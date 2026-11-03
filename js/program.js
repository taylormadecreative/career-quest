// Builds the student's Python program from the lines they fixed.
// A level finished with a helper is written as plain data (its result), never as a fixed line,
// so no answer ever ships inside the game.
const FIX_COMMENT = "  # completed with a helper";

// level: the level being run (1-3), or 4 for the finished program.
// override: the line typed right now for that level. role: run as if this career were picked.
// countsOverride: swap in different counts before the rank line (used to prove the sort really sorts).
export function programLines(state, jobs, level, { override, role = state.role, countsOverride, extraJobs } = {}) {
  const line = (k) => (k === level && override != null ? override : state.lines[k] ?? "").replace(/^\s+/, "");
  const helped = (k) => k < level && !!state.helped?.[k];
  const out = [];
  const push = (text, fixed = false) => out.push({ text, fixed });

  if (extraJobs?.length) push(`JOBS = JOBS + ${JSON.stringify(extraJobs)}`);
  push(`TARGET_ROLE = ${JSON.stringify(role)}`);
  if (helped(1)) {
    const idx = jobs.map((j, i) => (j.role === role ? i : -1)).filter((i) => i >= 0);
    push(`matched_jobs = [JOBS[i] for i in ${JSON.stringify(idx)}]${FIX_COMMENT}`);
  } else {
    push("matched_jobs = [job for job in JOBS");
    push(`    ${line(1)}`, true);
  }
  if (level >= 2) {
    if (helped(2)) push(`counts = ${JSON.stringify(Object.fromEntries(state.results[2].ranked))}${FIX_COMMENT}`);
    else {
      push("counts = {}");
      push("for posting in matched_jobs:");
      push('    for skill in posting["skills"]:');
      push(`        ${line(2)}`, true);
    }
  }
  if (level >= 3) {
    if (countsOverride) push(`counts = ${JSON.stringify(countsOverride)}`);
    if (helped(3)) push(`top_skills = ${JSON.stringify(state.results[3].top)}${FIX_COMMENT}`);
    else {
      push("top_skills = sorted(counts,");
      push(`    ${line(3)}`, true);
    }
    push("print(top_skills)");
  }
  return out;
}
export const program = (...args) => programLines(...args).map((l) => l.text).join("\n") + "\n";
