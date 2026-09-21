// Tier math. Pure functions over stored probabilities; sliders re-run these
// instantly with no Jev calls.

import type {
  ConnectionRow,
  ConnectionTier,
  Enrichment,
  IcpConfig,
  InvitationBucket,
  InvitationRow,
  RowResult,
  Thresholds,
} from "./types";
import { targetRoleKeys } from "./questions";

export const DEFAULT_THRESHOLDS: Thresholds = {
  t1RoleConfidence: 0.7,
  t1DisqualifiedMax: 0.3,
  t1BigBrandMax: 0.5,
  t2RoleConfidenceMin: 0.5,
  t2PrivateFamilyMin: 0.6,
  rejectedDisqualifiedMin: 0.7,
  invIgnoreMin: 0.7,
  seniorBuckets: ["c_level_or_owner", "director_or_vp"],
  geographyMin: 0.5,
};

export interface TierInputs {
  role: string | null;
  roleConfidence: number;
  companyType: string | null;
  privateFamily: number;
  bigBrand: number;
  disqualified: number;
}

export function tierInputs(result: RowResult | undefined): TierInputs | null {
  if (!result || result.error) return null;
  const a = result.answers;
  const role = a.role?.answer ?? null;
  return {
    role,
    roleConfidence: a.role?.confidence ?? a.role?.probability ?? 0,
    companyType: a.company_type?.answer ?? null,
    privateFamily: a.likely_private_or_family?.noul ?? 0,
    bigBrand: a.is_big_public_brand?.noul ?? 0,
    disqualified: a.disqualified?.noul ?? 0,
  };
}

export function connectionTier(
  row: ConnectionRow,
  result: RowResult | undefined,
  th: Thresholds,
  icp: IcpConfig,
): ConnectionTier {
  const t = tierInputs(result);
  if (!t) return "unscored";
  // Code rule: an empty Position resolves to "unknown" and lands in Tier 2, never Rejected.
  if (!row.position.trim()) return "tier2";

  const targets = targetRoleKeys(icp);
  const preferred = new Set(icp.preferredIndustries.map((s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")));
  const executiveRoles = new Set([...targets, "other_executive"]);

  if (t.disqualified >= th.rejectedDisqualifiedMin) return "rejected";

  const isTarget = t.role !== null && targets.includes(t.role);
  if (isTarget && t.roleConfidence >= th.t1RoleConfidence && t.disqualified < th.t1DisqualifiedMax && t.bigBrand < th.t1BigBrandMax) {
    return "tier1";
  }
  const midConf = isTarget && t.roleConfidence >= th.t2RoleConfidenceMin && t.roleConfidence < th.t1RoleConfidence;
  const unknownPreferred = t.role === "unknown" && t.companyType !== null && preferred.has(t.companyType);
  const privateExec = t.privateFamily >= th.t2PrivateFamilyMin && t.role !== null && executiveRoles.has(t.role);
  if (midConf || unknownPreferred || privateExec) return "tier2";
  return "tier3";
}

export function invitationBucket(row: InvitationRow, result: RowResult | undefined, th: Thresholds): InvitationBucket {
  if (row.direction === "OUTGOING") return "outgoing";
  if (!row.hasMessage) return "no_signal";
  if (!result || result.error) return "unscored";
  const intent = result.answers.message_intent;
  const seniority = result.answers.self_described_seniority;
  if (!intent) return "unscored";
  const pSpam = intent.probabilities["spam_or_bot"] ?? 0;
  const pSell = intent.probabilities["wants_to_sell_me_something"] ?? 0;
  if (Math.max(pSpam, pSell) >= th.invIgnoreMin) return "ignore";
  const goodIntent = intent.answer === "genuine_networking" || intent.answer === "fan_or_learner";
  const senior = seniority ? th.seniorBuckets.includes(seniority.answer) : false;
  if (goodIntent && senior) return "accept";
  return "review";
}

export interface RankInputs {
  inGeography: number | null;
  decisionMaker: number | null;
  revenueScoreNorm: number | null; // 0..1
}

export function rankInputs(post: RowResult | undefined): RankInputs {
  if (!post || post.error) return { inGeography: null, decisionMaker: null, revenueScoreNorm: null };
  const a = post.answers;
  const rev = a.revenue_over_threshold;
  const levels = rev ? Object.keys(rev.probabilities).length : 0;
  return {
    inGeography: a.in_geography?.noul ?? null,
    decisionMaker: a.decision_maker?.noul ?? null,
    revenueScoreNorm: rev && rev.score !== undefined && levels > 1 ? rev.score / (levels - 1) : null,
  };
}

/** Final ranking after enrichment: decision_maker × revenue score, ICP geography first. */
export function rankScore(post: RowResult | undefined, th: Thresholds): { geoFirst: number; score: number } {
  const r = rankInputs(post);
  const geoFirst = r.inGeography !== null && r.inGeography >= th.geographyMin ? 1 : 0;
  const score = (r.decisionMaker ?? 0) * (r.revenueScoreNorm ?? 0);
  return { geoFirst, score };
}

export function companySizeBand(e: Enrichment | undefined): string {
  if (!e) return "unknown";
  if (e.companySizeRange) return e.companySizeRange;
  const n = e.companySize;
  if (n === null || n === undefined) return "unknown";
  if (n < 11) return "1-10";
  if (n < 51) return "11-50";
  if (n < 201) return "51-200";
  if (n < 501) return "201-500";
  if (n < 1001) return "501-1000";
  if (n < 5001) return "1001-5000";
  if (n < 10001) return "5001-10000";
  return "10001+";
}

export const TIER_LABEL: Record<ConnectionTier, string> = {
  tier1: "Tier 1",
  tier2: "Tier 2",
  tier3: "Tier 3",
  rejected: "Rejected",
  unscored: "Unscored",
};

export const BUCKET_LABEL: Record<InvitationBucket, string> = {
  accept: "Accept",
  review: "Review",
  ignore: "Ignore",
  no_signal: "No signal",
  outgoing: "Outgoing",
  unscored: "Unscored",
};
