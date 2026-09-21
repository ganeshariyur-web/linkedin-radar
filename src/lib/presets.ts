import { DEFAULT_ICP } from "./icp";
import jobSearchIcp from "@/config/icp-job-search.json";
import { buildDefaultQuestions } from "./questions";
import { DEFAULT_THRESHOLDS } from "./tiers";
import type { IcpConfig, Preset, QuestionSpec, Thresholds } from "./types";

export const DEFAULT_PRESET_NAME = "Default ICP";
export const JOB_SEARCH_PRESET_NAME = "Job Search (CIO)";
export const JOB_SEARCH_ICP: IcpConfig = jobSearchIcp as IcpConfig;
export const BUILTIN_PRESET_NAMES = [DEFAULT_PRESET_NAME, JOB_SEARCH_PRESET_NAME];
export const PRESET_VERSION = 1;

export function buildDefaultPreset(icp: IcpConfig = DEFAULT_ICP): Preset {
  return {
    name: DEFAULT_PRESET_NAME,
    version: PRESET_VERSION,
    createdAt: new Date().toISOString(),
    icp,
    questions: buildDefaultQuestions(icp),
    thresholds: { ...DEFAULT_THRESHOLDS },
  };
}

/**
 * Job-search preset: the same question structure derived from a job-search ICP,
 * plus a recruiter / hiring-outreach intent that counts as Accept, and no
 * big-public-brand exclusion (public companies are targets here).
 */
export function buildJobSearchPreset(): Preset {
  const p = buildDefaultPreset(JOB_SEARCH_ICP);
  p.name = JOB_SEARCH_PRESET_NAME;
  const intent = p.questions.find((q) => q.id === "message_intent");
  if (intent?.options) {
    intent.options.splice(1, 0, {
      key: "recruiter_or_hiring_outreach",
      description: "A recruiter, executive search partner, or hiring leader describing a role, asking about availability, or inviting a conversation about a position.",
    });
    intent.instructions += ' Choose "recruiter_or_hiring_outreach" when the sender is recruiting or hiring, even if the message is short.';
  }
  const disq = p.questions.find((q) => q.id === "disqualified");
  if (disq) disq.instructions += " Recruiters, executive search partners and hiring leaders are targets, not disqualifiers.";
  p.thresholds = {
    ...p.thresholds,
    t1BigBrandMax: 1.0, // public companies are in scope for a job search
    acceptIntents: ["genuine_networking", "fan_or_learner", "recruiter_or_hiring_outreach"],
  };
  return p;
}

export function builtinPresets(): Preset[] {
  return [buildDefaultPreset(), buildJobSearchPreset()];
}

export function isPreset(x: unknown): x is Preset {
  if (!x || typeof x !== "object") return false;
  const p = x as Partial<Preset>;
  return typeof p.name === "string" && Array.isArray(p.questions) && !!p.thresholds && !!p.icp;
}

/** Fill any missing thresholds from defaults so older preset files still load. */
export function normalizePreset(p: Preset): Preset {
  const thresholds: Thresholds = { ...DEFAULT_THRESHOLDS, ...p.thresholds };
  const icp: IcpConfig = { ...DEFAULT_ICP, ...p.icp };
  const questions: QuestionSpec[] = p.questions.map((q) => ({ ...q, enabled: q.enabled ?? true }));
  return { ...p, version: p.version ?? PRESET_VERSION, thresholds, icp, questions };
}
