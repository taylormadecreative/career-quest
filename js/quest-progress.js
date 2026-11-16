// A changed input can make later computed results stale. Keep their answers as
// drafts, but require a fresh Python check before those results are exported.
const DEPENDENTS = {
  "1.1": ["1.2", "2.1"],
  "1.2": ["2.1"],
  "1.3": ["1.4", "2.5", "2.6", "2.7"],
  "1.4": ["2.5", "2.6", "2.7"],
  "1.6": ["2.2"],
  "1.7": ["1.8"],
  "2.5": ["2.6", "2.7"],
  "2.6": ["2.7"],
};
export function invalidateChangedInputs(state, id, personal) {
  const previous = state.completed?.[id];
  const changed = previous ? previous.personal !== personal : id === "1.7" && !!state.completed?.["1.8"] && state.completed["1.8"].personal !== personal;
  if (!changed) return [];
  const affected = [];
  state.answers ||= {};
  for (const key of DEPENDENTS[id] || []) {
    const old = state.completed[key];
    if (!old) continue;
    // Preserve the original inputs and code. For a dependent profile quest,
    // suggest the newly changed input while keeping the earlier value visible.
    state.answers[key] = { ...old, preferCurrentInput: ["1.2", "2.1", "1.4", "1.8"].includes(key), result: undefined, output: undefined };
    delete state.completed[key];
    affected.push(key);
  }
  if (affected.includes("1.4")) {
    state.starterUnlocked.skills = false;
    state.starterUnlocked.stats = false;
    state.starterPortfolio.skills = [];
    state.starterPortfolio.stats = (state.starterPortfolio.stats || []).filter((item) => !(item.computedStat === "skillCount" || (item.label === "Skills listed" && !item.studentStat)));
  }
  if (affected.includes("1.8")) {
    state.starterUnlocked.nextStep = false;
    state.starterPortfolio.nextStep = {};
  }
  return affected;
}

// Previous versions accepted a printed number without checking its type, and
// shipped the old print-only 1.8. Keep those answers as drafts for rechecking.
export function migrateLegacyProgress(state) {
  const updated=[];
  state.answers ||= {};
  const numeric=state.completed?.["1.5"];
  if (numeric && !/\nint\n$/.test(String(numeric.result?.output || ""))) {
    state.answers["1.5"]={...numeric,result:undefined,output:undefined};
    delete state.completed["1.5"];
    state.skipped ||= {}; state.skipped["1.5"]=true;
    state.starterPortfolio.stats=(state.starterPortfolio.stats || []).filter((item)=>!item.studentStat && item.label!=="My number");
    updated.push("1.5");
  }
  const ship=state.completed?.["1.8"];
  if (ship && typeof ship.result?.html !== "string") {
    state.answers["1.8"]={...ship,result:undefined,output:undefined};
    delete state.completed["1.8"];
    state.starterUnlocked.nextStep=false;
    updated.push("1.8");
  }
  return updated;
}
