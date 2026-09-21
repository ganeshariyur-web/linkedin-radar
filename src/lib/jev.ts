// Server-side conversion of app QuestionSpecs into Jev questions, and the
// per-row call. Imported only by the API route.

import { TypeSafeClient, type Question, type Questions, type SystemOneResult } from "@typesafe-ai/sdk";
import type { QuestionAnswer, QuestionSpec } from "./types";
import type { JevState } from "./state";

export const JEV_MODEL = "jev-latest";

let _client: TypeSafeClient | null = null;
export function jevClient(): TypeSafeClient {
  if (_client) return _client;
  if (!process.env.TYPESAFE_API_KEY) throw new Error("TYPESAFE_API_KEY is not configured on the server.");
  _client = new TypeSafeClient({
    defaultModel: JEV_MODEL,
    timeout: 20_000,
    retry: {
      maxRetries: 6,
      backoffInitialMs: 500,
      backoffMaxMs: 10_000,
      backoffJitter: 0.25,
      // 429 rate limit and 529 overloaded (plus other 5xx and 408) retry with exponential backoff.
      httpStatuses: new Set([408, 429, 500, 502, 503, 504, 529]),
      respectRetryAfter: true,
    },
    logLevel: "warn",
  });
  return _client;
}

/** Build the Jev question for a spec. Instructions carry the field list so Jev judges only from declared fields. */
export function toJevQuestion(spec: QuestionSpec): Question {
  const fields = spec.fields.map((f) => `\`${f}\``).join(", ");
  if (spec.type === "choice") {
    const criteria: Record<string, string> = {};
    for (const o of spec.options ?? []) criteria[o.key] = o.description;
    return {
      type: "choice",
      instructions: { task: spec.instructions, judge_only_from_fields: fields },
      criteria,
    };
  }
  if (spec.type === "score") {
    const levels = spec.levels ?? [];
    return {
      type: "score",
      instructions: { task: spec.instructions, judge_only_from_fields: fields, levels_are_ordered: "lowest first, highest last" },
      criteria: [levels[0], levels[1], ...levels.slice(2)],
    };
  }
  // Noul: a statement with no criteria.
  return {
    type: "noul",
    instructions: { statement: spec.instructions, judge_only_from_fields: fields },
  };
}

export function toJevQuestions(specs: QuestionSpec[]): Questions {
  const qs: Questions = {};
  for (const s of specs) if (s.enabled) qs[s.id] = toJevQuestion(s);
  return qs;
}

export interface RowScore {
  id: string;
  answers: Record<string, QuestionAnswer>;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  model: string;
  requestId?: string;
  error?: string;
}

export function normalizeAnswers(result: SystemOneResult<Questions>, specs: QuestionSpec[]): Record<string, QuestionAnswer> {
  const out: Record<string, QuestionAnswer> = {};
  for (const spec of specs) {
    if (!spec.enabled) continue;
    const a = result.answers[spec.id] as unknown as Record<string, unknown> | undefined;
    if (!a) continue;
    if (a.type === "choice") {
      const probs = a.probabilities as Record<string, number>;
      const choice = a.choice as string;
      out[spec.id] = { type: "choice", answer: choice, probability: probs[choice] ?? 0, confidence: a.confidence as number, probabilities: probs };
    } else if (a.type === "score") {
      const probs = a.probabilities as Record<string, number>;
      const score = a.score as number;
      const levels = spec.levels ?? [];
      const nearest = Math.round(score);
      const label = levels[nearest] ?? String(nearest);
      out[spec.id] = { type: "score", answer: label, probability: probs[String(nearest)] ?? 0, confidence: a.confidence as number, probabilities: probs, score };
    } else if (a.type === "noul") {
      const p = a.noul as number;
      out[spec.id] = { type: "noul", answer: p >= 0.5 ? "yes" : "no", probability: p, confidence: null, probabilities: { yes: p, no: 1 - p }, noul: p };
    }
  }
  return out;
}

export async function scoreRow(id: string, state: JevState, specs: QuestionSpec[], questions: Questions): Promise<RowScore> {
  const t0 = Date.now();
  try {
    const { data, requestId } = await jevClient().systemOne({ model: JEV_MODEL, state, questions }).withResponse();
    return {
      id,
      answers: normalizeAnswers(data, specs),
      latencyMs: Date.now() - t0,
      inputTokens: data.usage.input_tokens,
      outputTokens: data.usage.output_tokens,
      model: data.model,
      requestId,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { id, answers: {}, latencyMs: Date.now() - t0, inputTokens: 0, outputTokens: 0, model: JEV_MODEL, error: msg };
  }
}

/** Run a list of tasks with bounded concurrency, invoking onDone as each finishes. */
export async function runParallel<T>(items: (() => Promise<T>)[], concurrency: number, onDone: (r: T) => void | Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      const r = await items[i]();
      await onDone(r);
    }
  });
  await Promise.all(workers);
}
