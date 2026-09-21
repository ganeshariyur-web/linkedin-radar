import { DEFAULT_ICP } from "./icp";
import { buildDefaultQuestions } from "./questions";
import { DEFAULT_THRESHOLDS } from "./tiers";
import type { IcpConfig, Preset, QuestionSpec, Thresholds } from "./types";

export const DEFAULT_PRESET_NAME = "Default ICP";
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
