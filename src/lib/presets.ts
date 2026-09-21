import { DEFAULT_ICP } from "./icp";
import jobSearchIcp from "@/config/icp-job-search.json";
import peIcp from "@/config/icp-private-equity.json";
import recruitersIcp from "@/config/icp-recruiters.json";
import fortuneIcp from "@/config/icp-fortune-1000.json";
import { buildDefaultQuestions } from "./questions";
import { DEFAULT_THRESHOLDS } from "./tiers";
import type { IcpConfig, Preset, QuestionSpec, Thresholds } from "./types";

export const DEFAULT_PRESET_NAME = "Default ICP";
export const JOB_SEARCH_PRESET_NAME = "Job Search (CIO)";
export const JOB_SEARCH_ICP: IcpConfig = jobSearchIcp as IcpConfig;
export const PE_PRESET_NAME = "Private Equity";
export const RECRUITERS_PRESET_NAME = "Recruiters & Search Firms";
export const FORTUNE_PRESET_NAME = "Fortune 1000";
export const BUILTIN_PRESET_NAMES = [DEFAULT_PRESET_NAME, JOB_SEARCH_PRESET_NAME, PE_PRESET_NAME, RECRUITERS_PRESET_NAME, FORTUNE_PRESET_NAME];
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

const RECRUITER_INTENT = {
  key: "recruiter_or_hiring_outreach",
  description: "A recruiter, executive search partner, or hiring leader describing a role, asking about availability, or inviting a conversation about a position.",
};

function addRecruiterIntent(p: Preset) {
  const intent = p.questions.find((q) => q.id === "message_intent");
  if (intent?.options && !intent.options.some((o) => o.key === RECRUITER_INTENT.key)) {
    intent.options.splice(1, 0, { ...RECRUITER_INTENT });
    intent.instructions += ' Choose "recruiter_or_hiring_outreach" when the sender is recruiting or hiring, even if the message is short.';
  }
}

/** Private equity lens: firms, deal and operating teams, portfolio leadership. Founders of funded companies are not disqualified. */
export function buildPrivateEquityPreset(): Preset {
  const p = buildDefaultPreset(peIcp as IcpConfig);
  p.name = PE_PRESET_NAME;
  addRecruiterIntent(p);
  const intent = p.questions.find((q) => q.id === "message_intent");
  if (intent?.options) intent.options.splice(2, 0, { key: "deal_or_advisory_outreach", description: "A PE professional or portfolio executive proposing an operating partner, advisory, board or due-diligence conversation." });
  p.thresholds = { ...p.thresholds, t1BigBrandMax: 1.0, acceptIntents: ["genuine_networking", "fan_or_learner", "recruiter_or_hiring_outreach", "deal_or_advisory_outreach"] };
  return p;
}

/** Recruiters lens: retained search, boutique tech-leadership recruiters, in-house executive recruiting. */
export function buildRecruitersPreset(): Preset {
  const p = buildDefaultPreset(recruitersIcp as IcpConfig);
  p.name = RECRUITERS_PRESET_NAME;
  addRecruiterIntent(p);
  const disq = p.questions.find((q) => q.id === "disqualified");
  if (disq) disq.instructions += " Executive recruiters, search partners and in-house talent leaders are targets, never disqualifiers. Only contract, hourly or offshore staffing sellers count as agencies selling services.";
  p.thresholds = { ...p.thresholds, t1BigBrandMax: 1.0, t2PrivateFamilyMin: 1.01, acceptIntents: ["genuine_networking", "fan_or_learner", "recruiter_or_hiring_outreach"] };
  return p;
}

/**
 * Fortune 1000 lens. Membership is a fact, so it is matched in code against the
 * preset's watchlist (paste the list in the Studio). Before enrichment Jev only
 * judges the role and whether the company reads as a well-known large public
 * corporation, which becomes a Tier 1 requirement here instead of an exclusion.
 */
export function buildFortune1000Preset(): Preset {
  const p = buildDefaultPreset(fortuneIcp as IcpConfig);
  p.name = FORTUNE_PRESET_NAME;
  addRecruiterIntent(p);
  p.thresholds = { ...p.thresholds, t1BigBrandMax: 1.01, t1BigBrandMin: 0.5, t2PrivateFamilyMin: 1.01, watchlistTier1Only: false, acceptIntents: ["genuine_networking", "fan_or_learner", "recruiter_or_hiring_outreach"] };
  p.watchlist = [];
  return p;
}

export function builtinPresets(): Preset[] {
  return [buildDefaultPreset(), buildJobSearchPreset(), buildPrivateEquityPreset(), buildRecruitersPreset(), buildFortune1000Preset()];
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
  return { ...p, version: p.version ?? PRESET_VERSION, thresholds, icp, questions, watchlist: Array.isArray(p.watchlist) ? p.watchlist : [] };
}
