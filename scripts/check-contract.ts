// Build-time guard: fails the build if any default question references a field
// outside the contract, or a pre-enrichment question names a forbidden field.
import { validateQuestions, hasErrors } from "../src/lib/questions";
import { contractFieldNames, FORBIDDEN_PRE_ENRICHMENT } from "../src/lib/contract";
import { builtinPresets } from "../src/lib/presets";

let failed = false;
let total = 0;
for (const preset of builtinPresets()) {
const qs = preset.questions;
total += qs.length;
const issues = validateQuestions(qs);
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
}
if (failed) { console.error("Contract check failed."); process.exit(1); }
console.log(`✓ Contract check passed: ${total} built-in questions across ${builtinPresets().length} presets read only contract fields.`);
