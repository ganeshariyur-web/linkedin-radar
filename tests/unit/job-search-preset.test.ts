import { describe, expect, it } from "vitest";
import { buildJobSearchPreset, JOB_SEARCH_PRESET_NAME } from "@/lib/presets";
import { hasErrors, validateQuestions } from "@/lib/questions";
import { connectionTier, invitationBucket } from "@/lib/tiers";
import type { ConnectionRow, InvitationRow, QuestionAnswer, RowResult } from "@/lib/types";

const p = buildJobSearchPreset();
const choice = (answer: string, confidence: number, extra: Record<string, number> = {}): QuestionAnswer => ({ type: "choice", answer, probability: confidence, confidence, probabilities: { [answer]: confidence, ...extra } });
const noul = (v: number): QuestionAnswer => ({ type: "noul", answer: v >= 0.5 ? "yes" : "no", probability: v, confidence: null, probabilities: { yes: v, no: 1 - v }, noul: v });
const res = (a: Record<string, QuestionAnswer>): RowResult => ({ rowId: "x", pass: "pre", questionsHash: "h", answers: a, latencyMs: 1, inputTokens: 1, outputTokens: 1, model: "jev", scoredAt: "" });

describe("Job Search (CIO) preset", () => {
  it("is named, valid, and derives hiring-side roles from the ICP", () => {
    expect(p.name).toBe(JOB_SEARCH_PRESET_NAME);
    const issues = validateQuestions(p.questions);
    for (const [id, v] of Object.entries(issues)) expect(hasErrors(v), id).toBe(false);
    const role = p.questions.find((q) => q.id === "role")!;
    expect(role.options!.map((o) => o.key)).toEqual(expect.arrayContaining(["ceo", "coo", "cfo", "chro", "board_member", "pe_operating_partner", "executive_search_partner", "cio_cto_cdo_peer", "unknown"]));
    const ct = p.questions.find((q) => q.id === "company_type")!;
    const keys = ct.options!.map((o) => o.key);
    expect(new Set(keys).size).toBe(keys.length); // no duplicate healthcare key
    expect(keys).toEqual(expect.arrayContaining(["healthcare", "life_sciences", "medtech", "private_equity", "executive_search", "unclear"]));
  });
  it("treats recruiter outreach as Accept and keeps vendors as Ignore", () => {
    const inv: InvitationRow = { id: "i", from: "", to: "", name: "N", sentAtRaw: "", sentAt: null, invitationAge: "this week", message: "hi", hasMessage: true, direction: "INCOMING", inviterProfileUrl: "", inviteeProfileUrl: "", profileUrl: "", urlKey: "", match: null };
    const rec = res({ message_intent: choice("recruiter_or_hiring_outreach", 0.9), self_described_seniority: choice("director_or_vp", 0.8) });
    expect(invitationBucket(inv, rec, p.thresholds)).toBe("accept");
    const vendor = res({ message_intent: choice("wants_to_sell_me_something", 0.85), self_described_seniority: choice("not_stated", 0.9) });
    expect(invitationBucket(inv, vendor, p.thresholds)).toBe("ignore");
  });
  it("does not exclude executives at big public companies from Tier 1", () => {
    const row: ConnectionRow = { id: "c", firstName: "A", lastName: "B", lastNameClean: "B", nameSuffixes: null, url: "", urlKey: "", email: "", hasEmail: false, company: "Pfizer", position: "Chief Financial Officer", connectedOnRaw: "", connectedOn: null, connectedFor: "1–3 years" };
    const r = res({ role: choice("cfo", 0.95), company_type: choice("life_sciences", 0.8), likely_private_or_family: noul(0.05), is_big_public_brand: noul(0.95), disqualified: noul(0.05) });
    expect(connectionTier(row, r, p.thresholds, p.icp)).toBe("tier1");
  });
});
