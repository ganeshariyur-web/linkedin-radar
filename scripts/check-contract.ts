// Build-time guard: fails the build if any default question references a field
// outside the contract, or a pre-enrichment question names a forbidden field.
import { DEFAULT_ICP } from "../src/lib/icp";
import { buildDefaultQuestions, validateQuestions, hasErrors } from "../src/lib/questions";
import { contractFieldNames, FORBIDDEN_PRE_ENRICHMENT } from "../src/lib/contract";

const qs = buildDefaultQuestions(DEFAULT_ICP);
const issues = validateQuestions(qs);
let failed = false;
for (const q of qs) {
  const allowed = contractFieldNames(q.tab, q.pass);
  for (const f of q.fields) {
    if (!allowed.includes(f)) { console.error(`✕ ${q.id}: field "${f}" is outside the ${q.tab}/${q.pass} contract`); failed = true; }
    if (q.pass === "pre" && FORBIDDEN_PRE_ENRICHMENT.includes(f)) { console.error(`✕ ${q.id}: field "${f}" is forbidden before enrichment`); failed = true; }
  }
  if (q.pass === "pre") {
    for (const bad of FORBIDDEN_PRE_ENRICHMENT) {
      if (new RegExp("`" + bad + "`").test(q.instructions)) { console.error(`✕ ${q.id}: instructions reference forbidden field \`${bad}\``); failed = true; }
    }
  }
  if (hasErrors(issues[q.id])) { console.error(`✕ ${q.id}: ${issues[q.id].filter((i) => i.level === "error").map((i) => i.message).join("; ")}`); failed = true; }
}
if (failed) { console.error("Contract check failed."); process.exit(1); }
console.log(`✓ Contract check passed: ${qs.length} default questions read only contract fields.`);
