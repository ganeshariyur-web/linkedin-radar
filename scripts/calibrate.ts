// Calibration: score every fixture connection with the default questions and
// report role / disqualified / big-brand distributions by fixture category.
// Run: TYPESAFE_API_KEY=... npx tsx scripts/calibrate.ts
import { readFileSync } from "node:fs";
import { detectFile } from "../src/lib/csv";
import { buildConnections } from "../src/lib/rows";
import { DEFAULT_ICP } from "../src/lib/icp";
import { buildDefaultQuestions } from "../src/lib/questions";
import { toJevQuestions, scoreRow, runParallel } from "../src/lib/jev";
import { connectionPreState, fieldsForQuestions } from "../src/lib/state";
import { connectionTier, DEFAULT_THRESHOLDS } from "../src/lib/tiers";
import type { RowResult } from "../src/lib/types";

const TARGET = /president|owner|chief operating|coo|ceo|chief executive|chief of staff|managing director/i;
const DISQ = /recruit|talent|candidate|seeking|stealth|student|10x leads/i;
const OTHER_EXEC = /vp|svp|evp|chief financial|general manager/i;

async function main() {
const file = detectFile(readFileSync("fixtures/Connections.csv", "utf8"))!;
const { rows } = buildConnections(file, "Connections.csv", new Date(Date.UTC(2026, 8, 21)));
const specs = buildDefaultQuestions(DEFAULT_ICP).filter((q) => q.tab === "connections" && q.pass === "pre" && q.enabled);
const jq = toJevQuestions(specs);
const fields = fieldsForQuestions(specs);

const results = new Map<string, RowResult>();
let tokens = 0, lat: number[] = [];
const t0 = Date.now();
await runParallel(rows.map((r) => () => scoreRow(r.id, connectionPreState(r, fields), specs, jq)), 8, (s) => {
  tokens += s.inputTokens; lat.push(s.latencyMs);
  results.set(s.id, { rowId: s.id, pass: "pre", questionsHash: "cal", answers: s.answers, latencyMs: s.latencyMs, inputTokens: s.inputTokens, outputTokens: s.outputTokens, model: s.model, scoredAt: "", error: s.error });
});
const wall = Date.now() - t0;
lat.sort((a, b) => a - b);
console.log(`rows=${rows.length} wall=${wall}ms p50=${lat[Math.floor(lat.length * 0.5)]}ms p95=${lat[Math.floor(lat.length * 0.95)]}ms tokens=${tokens} avg/row=${Math.round(tokens / rows.length)} cost=$${((tokens / 1e6) * 0.042).toFixed(4)} model=${results.values().next().value?.model}`);

type Cat = "empty" | "target" | "disqualifier" | "other_exec" | "non_exec";
const cat = (p: string): Cat => (!p ? "empty" : DISQ.test(p) ? "disqualifier" : TARGET.test(p) ? "target" : OTHER_EXEC.test(p) ? "other_exec" : "non_exec");
const byCat: Record<Cat, { n: number; roles: Record<string, number>; disq: number[]; tiers: Record<string, number>; roleConf: number[] }> = {} as never;
for (const r of rows) {
  const c = cat(r.position);
  byCat[c] ??= { n: 0, roles: {}, disq: [], tiers: {}, roleConf: [] };
  const res = results.get(r.id)!;
  const b = byCat[c];
  b.n++;
  const role = res.answers.role?.answer ?? "ERR";
  b.roles[role] = (b.roles[role] ?? 0) + 1;
  b.disq.push(res.answers.disqualified?.noul ?? -1);
  b.roleConf.push(res.answers.role?.confidence ?? -1);
  const t = connectionTier(r, res, DEFAULT_THRESHOLDS, DEFAULT_ICP);
  b.tiers[t] = (b.tiers[t] ?? 0) + 1;
}
const q = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
for (const [c, b] of Object.entries(byCat)) {
  console.log(`\n[${c}] n=${b.n}`);
  console.log(`  roles: ${JSON.stringify(b.roles)}`);
  console.log(`  role confidence p10=${q(b.roleConf, 0.1).toFixed(2)} p50=${q(b.roleConf, 0.5).toFixed(2)}`);
  console.log(`  disqualified p10=${q(b.disq, 0.1).toFixed(2)} p50=${q(b.disq, 0.5).toFixed(2)} p90=${q(b.disq, 0.9).toFixed(2)}`);
  console.log(`  tiers: ${JSON.stringify(b.tiers)}`);
}
// Big-brand check
const big = rows.filter((r) => /Microsoft|Amazon|JPMorgan|Pfizer|Deloitte|Accenture|Oracle|Caterpillar|General Electric|Salesforce/.test(r.company));
const fam = rows.filter((r) => /& Sons|Group|Holdings|Brothers|Fabricat|Contractors|Tool & Die|LLC|Inc\./.test(r.company));
const avg = (a: number[]) => (a.reduce((x, y) => x + y, 0) / Math.max(1, a.length)).toFixed(2);
console.log(`\nbig public brand: n=${big.length} mean is_big_public_brand=${avg(big.map((r) => results.get(r.id)!.answers.is_big_public_brand?.noul ?? 0))} mean private=${avg(big.map((r) => results.get(r.id)!.answers.likely_private_or_family?.noul ?? 0))}`);
console.log(`family-sounding:  n=${fam.length} mean is_big_public_brand=${avg(fam.map((r) => results.get(r.id)!.answers.is_big_public_brand?.noul ?? 0))} mean private=${avg(fam.map((r) => results.get(r.id)!.answers.likely_private_or_family?.noul ?? 0))}`);
// Show any target-role row that did not reach Tier 1 and why
console.log("\nTarget-role rows not in Tier 1:");
for (const r of rows.filter((r) => cat(r.position) === "target")) {
  const res = results.get(r.id)!; const t = connectionTier(r, res, DEFAULT_THRESHOLDS, DEFAULT_ICP);
  if (t !== "tier1") console.log(`  ${t} | ${r.position} @ ${r.company || "(empty)"} | role=${res.answers.role?.answer} conf=${res.answers.role?.confidence} disq=${res.answers.disqualified?.noul} big=${res.answers.is_big_public_brand?.noul}`);
}
console.log("\nEmpty-position rows:");
for (const r of rows.filter((r) => !r.position)) { const res = results.get(r.id)!; console.log(`  role=${res.answers.role?.answer} conf=${res.answers.role?.confidence} disq=${res.answers.disqualified?.noul} type=${res.answers.company_type?.answer} @ ${r.company || "(empty)"}`); }

}
main().catch((e) => { console.error(e); process.exit(1); });
