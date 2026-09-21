// Request validation shared by the scoring route and its tests.

import { contractFieldNames, FORBIDDEN_PRE_ENRICHMENT } from "./contract";
import { hasErrors, validateQuestions } from "./questions";
import type { Pass, QuestionSpec, Tab } from "./types";
import type { JevState } from "./state";

export const MAX_ROWS_PER_REQUEST = 50;
export const PARALLEL_ROWS = 8;

export interface ScoreRequest {
  tab: Tab;
  pass: Pass;
  questions: QuestionSpec[];
  rows: { id: string; state: JevState }[];
}

export type ValidationResult = { ok: true; value: ScoreRequest } | { ok: false; status: number; error: string; details?: unknown };

export function validateScoreRequest(body: unknown): ValidationResult {
  if (!body || typeof body !== "object") return { ok: false, status: 400, error: "Body must be a JSON object." };
  const b = body as Partial<ScoreRequest>;
  if (b.tab !== "connections" && b.tab !== "invitations") return { ok: false, status: 400, error: 'tab must be "connections" or "invitations".' };
  if (b.pass !== "pre" && b.pass !== "post") return { ok: false, status: 400, error: 'pass must be "pre" or "post".' };
  if (!Array.isArray(b.questions) || b.questions.length === 0) return { ok: false, status: 400, error: "questions must be a non-empty array." };
  if (!Array.isArray(b.rows) || b.rows.length === 0) return { ok: false, status: 400, error: "rows must be a non-empty array." };
  if (b.rows.length > MAX_ROWS_PER_REQUEST) return { ok: false, status: 413, error: `At most ${MAX_ROWS_PER_REQUEST} rows per request.` };

  const questions = b.questions as QuestionSpec[];
  for (const q of questions) {
    if (q.tab !== b.tab || q.pass !== b.pass) return { ok: false, status: 422, error: `Question "${q.id}" belongs to ${q.tab}/${q.pass}, not ${b.tab}/${b.pass}.` };
  }
  const enabled = questions.filter((q) => q.enabled !== false);
  if (enabled.length === 0) return { ok: false, status: 422, error: "No enabled questions." };
  const issues = validateQuestions(enabled);
  const errors = Object.entries(issues).filter(([, v]) => hasErrors(v));
  if (errors.length) {
    return {
      ok: false,
      status: 422,
      error: "Question spec failed validation.",
      details: Object.fromEntries(errors.map(([id, v]) => [id, v.filter((i) => i.level === "error").map((i) => i.message)])),
    };
  }

  const allowed = new Set(contractFieldNames(b.tab, b.pass));
  for (const r of b.rows) {
    if (!r || typeof r !== "object" || typeof r.id !== "string" || !r.state || typeof r.state !== "object") {
      return { ok: false, status: 400, error: "Each row needs a string id and an object state." };
    }
    for (const [k, v] of Object.entries(r.state)) {
      if (!allowed.has(k)) return { ok: false, status: 422, error: `State field "${k}" is outside the ${b.tab} ${b.pass}-enrichment contract.` };
      if (b.pass === "pre" && FORBIDDEN_PRE_ENRICHMENT.includes(k)) return { ok: false, status: 422, error: `State field "${k}" is forbidden before enrichment.` };
      const t = typeof v;
      if (!(v === null || t === "string" || t === "number" || t === "boolean")) return { ok: false, status: 422, error: `State field "${k}" must be a scalar.` };
    }
  }
  return { ok: true, value: { tab: b.tab, pass: b.pass, questions: enabled, rows: b.rows as ScoreRequest["rows"] } };
}
