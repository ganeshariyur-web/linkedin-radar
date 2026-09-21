import { describe, expect, it } from "vitest";
import { connectionTier, DEFAULT_THRESHOLDS, invitationBucket, rankScore } from "@/lib/tiers";
import { DEFAULT_ICP } from "@/lib/icp";
import type { ConnectionRow, InvitationRow, QuestionAnswer, RowResult } from "@/lib/types";

const row = (position: string, company = "Acme"): ConnectionRow => ({
  id: "c:x", firstName: "A", lastName: "B", lastNameClean: "B", nameSuffixes: null, url: "", urlKey: "", email: "", hasEmail: false, company, position, connectedOnRaw: "", connectedOn: null, connectedFor: "1–3 years",
});
const choice = (answer: string, confidence: number): QuestionAnswer => ({ type: "choice", answer, probability: confidence, confidence, probabilities: { [answer]: confidence } });
const noul = (p: number): QuestionAnswer => ({ type: "noul", answer: p >= 0.5 ? "yes" : "no", probability: p, confidence: null, probabilities: { yes: p, no: 1 - p }, noul: p });
const res = (a: Record<string, QuestionAnswer>): RowResult => ({ rowId: "c:x", pass: "pre", questionsHash: "h", answers: a, latencyMs: 1, inputTokens: 1, outputTokens: 1, model: "jev", scoredAt: "" });
const th = DEFAULT_THRESHOLDS;

describe("connectionTier", () => {
  it("Tier 1 for a confident target role, not disqualified, not a big brand", () => {
    const r = res({ role: choice("president_md_owner", 0.95), company_type: choice("manufacturing", 0.8), likely_private_or_family: noul(0.9), is_big_public_brand: noul(0.05), disqualified: noul(0.02) });
    expect(connectionTier(row("President & Owner"), r, th, DEFAULT_ICP)).toBe("tier1");
  });
  it("Rejected when disqualified ≥ 0.7", () => {
    const r = res({ role: choice("not_executive", 0.9), company_type: choice("professional_services", 0.8), likely_private_or_family: noul(0.1), is_big_public_brand: noul(0.1), disqualified: noul(0.85) });
    expect(connectionTier(row("Senior Recruiter"), r, th, DEFAULT_ICP)).toBe("rejected");
  });
  it("empty Position lands in Tier 2, never Rejected, even if Jev were to flag it", () => {
    const r = res({ role: choice("unknown", 0.9), company_type: choice("unclear", 0.6), likely_private_or_family: noul(0.5), is_big_public_brand: noul(0.1), disqualified: noul(0.9) });
    expect(connectionTier(row(""), r, th, DEFAULT_ICP)).toBe("tier2");
    expect(connectionTier(row("   "), r, th, DEFAULT_ICP)).toBe("tier2");
  });
  it("Tier 2 for a mid-confidence target role", () => {
    const r = res({ role: choice("coo", 0.6), company_type: choice("other", 0.5), likely_private_or_family: noul(0.2), is_big_public_brand: noul(0.1), disqualified: noul(0.05) });
    expect(connectionTier(row("COO"), r, th, DEFAULT_ICP)).toBe("tier2");
  });
  it("Tier 2 for unknown role at a preferred industry, and for private/family with an executive role", () => {
    const r1 = res({ role: choice("unknown", 0.9), company_type: choice("logistics", 0.8), likely_private_or_family: noul(0.3), is_big_public_brand: noul(0.1), disqualified: noul(0.05) });
    expect(connectionTier(row("Professional"), r1, th, DEFAULT_ICP)).toBe("tier2");
    const r2 = res({ role: choice("other_executive", 0.9), company_type: choice("other", 0.8), likely_private_or_family: noul(0.8), is_big_public_brand: noul(0.1), disqualified: noul(0.05) });
    expect(connectionTier(row("VP Sales", "Kessler Group"), r2, th, DEFAULT_ICP)).toBe("tier2");
  });
  it("Tier 3 for the remainder; unscored when no result", () => {
    const r = res({ role: choice("not_executive", 0.9), company_type: choice("tech_or_software", 0.8), likely_private_or_family: noul(0.1), is_big_public_brand: noul(0.9), disqualified: noul(0.05) });
    expect(connectionTier(row("Engineer"), r, th, DEFAULT_ICP)).toBe("tier3");
    expect(connectionTier(row("Engineer"), undefined, th, DEFAULT_ICP)).toBe("unscored");
  });
  it("thresholds recompute tiers with no new model call", () => {
    const r = res({ role: choice("ceo", 0.65), company_type: choice("other", 0.5), likely_private_or_family: noul(0.2), is_big_public_brand: noul(0.1), disqualified: noul(0.05) });
    expect(connectionTier(row("CEO"), r, th, DEFAULT_ICP)).toBe("tier2");
    expect(connectionTier(row("CEO"), r, { ...th, t1RoleConfidence: 0.6 }, DEFAULT_ICP)).toBe("tier1");
    expect(connectionTier(row("CEO"), r, { ...th, t2RoleConfidenceMin: 0.7, t1RoleConfidence: 0.9 }, DEFAULT_ICP)).toBe("tier3");
  });
});

describe("invitationBucket", () => {
  const inv = (direction: "INCOMING" | "OUTGOING", message: string): InvitationRow => ({
    id: "i:x", from: "", to: "", name: "N", sentAtRaw: "", sentAt: null, invitationAge: "this week", message, hasMessage: !!message, direction, inviterProfileUrl: "", inviteeProfileUrl: "", profileUrl: "", urlKey: "", match: null,
  });
  it("No signal for message-less INCOMING, Outgoing for OUTGOING, regardless of results", () => {
    expect(invitationBucket(inv("INCOMING", ""), undefined, th)).toBe("no_signal");
    expect(invitationBucket(inv("OUTGOING", "hi"), undefined, th)).toBe("outgoing");
  });
  it("Accept, Ignore, Review", () => {
    const acc = res({ message_intent: { ...choice("genuine_networking", 0.9), probabilities: { genuine_networking: 0.9, spam_or_bot: 0.02, wants_to_sell_me_something: 0.03 } }, self_described_seniority: choice("c_level_or_owner", 0.8) });
    expect(invitationBucket(inv("INCOMING", "hi"), acc, th)).toBe("accept");
    const ign = res({ message_intent: { ...choice("wants_to_sell_me_something", 0.8), probabilities: { wants_to_sell_me_something: 0.8, spam_or_bot: 0.1 } }, self_described_seniority: choice("not_stated", 0.8) });
    expect(invitationBucket(inv("INCOMING", "buy"), ign, th)).toBe("ignore");
    const rev = res({ message_intent: { ...choice("genuine_networking", 0.6), probabilities: { genuine_networking: 0.6, spam_or_bot: 0.1, wants_to_sell_me_something: 0.3 } }, self_described_seniority: choice("not_stated", 0.9) });
    expect(invitationBucket(inv("INCOMING", "hey"), rev, th)).toBe("review");
  });
});

describe("rankScore", () => {
  it("geography first, then decision_maker × normalised revenue", () => {
    const post: RowResult = { rowId: "c:x", pass: "post", questionsHash: "h", latencyMs: 1, inputTokens: 1, outputTokens: 1, model: "jev", scoredAt: "", answers: {
      in_geography: noul(0.9), decision_maker: noul(0.8),
      revenue_over_threshold: { type: "score", answer: "Probably over", probability: 0.5, confidence: 0.5, probabilities: { "0": 0, "1": 0, "2": 0.2, "3": 0.6, "4": 0.2 }, score: 3 },
    } };
    const r = rankScore(post, th);
    expect(r.geoFirst).toBe(1);
    expect(r.score).toBeCloseTo(0.8 * 0.75, 5);
  });
});
