import { describe, expect, it } from "vitest";
import { buildWatchlist, normalizeCompany, parseWatchlistText } from "@/lib/watchlist";
import { builtinPresets, buildFortune1000Preset, buildPrivateEquityPreset, buildRecruitersPreset } from "@/lib/presets";
import { hasErrors, validateQuestions } from "@/lib/questions";
import { connectionTier } from "@/lib/tiers";
import type { ConnectionRow, QuestionAnswer, RowResult } from "@/lib/types";

describe("watchlist", () => {
  it("normalises names", () => {
    expect(normalizeCompany("McKesson Corporation")).toBe("mckesson");
    expect(normalizeCompany("The Home Depot, Inc.")).toBe("home depot");
    expect(normalizeCompany("Johnson & Johnson")).toBe("johnson and johnson");
  });
  it("matches exported company text against the list", () => {
    const wl = buildWatchlist(["Stryker", "McKesson Corporation", "AGCO", "Owens & Minor"]);
    expect(wl.match("Stryker")).toBe("Stryker");
    expect(wl.match("McKesson")).toBe("McKesson Corporation");
    expect(wl.match("Owens & Minor, Inc.")).toBe("Owens & Minor");
    expect(wl.match("Stryker Spine Division")).toBe("Stryker");
    expect(wl.match("Pfizer")).toBeNull();
    expect(wl.match("")).toBeNull();
  });
  it("parses pasted text", () => {
    expect(parseWatchlistText("A\nB, C;D\n\nA")).toEqual(["A", "B", "C", "D"]);
  });
});

const choice = (answer: string, confidence: number): QuestionAnswer => ({ type: "choice", answer, probability: confidence, confidence, probabilities: { [answer]: confidence } });
const noul = (v: number): QuestionAnswer => ({ type: "noul", answer: v >= 0.5 ? "yes" : "no", probability: v, confidence: null, probabilities: { yes: v, no: 1 - v }, noul: v });
const res = (a: Record<string, QuestionAnswer>): RowResult => ({ rowId: "x", pass: "pre", questionsHash: "h", answers: a, latencyMs: 1, inputTokens: 1, outputTokens: 1, model: "jev", scoredAt: "" });
const row = (position: string, company: string): ConnectionRow => ({ id: "c", firstName: "A", lastName: "B", lastNameClean: "B", nameSuffixes: null, url: "", urlKey: "", email: "", hasEmail: false, company, position, connectedOnRaw: "", connectedOn: null, connectedFor: "1–3 years" });

describe("new built-in presets", () => {
  it("all five built-ins validate", () => {
    const names = builtinPresets().map((p) => p.name);
    expect(names).toEqual(["Default ICP", "Job Search (CIO)", "Private Equity", "Recruiters & Search Firms", "Fortune 1000"]);
    for (const p of builtinPresets()) {
      const issues = validateQuestions(p.questions);
      for (const [id, v] of Object.entries(issues)) expect(hasErrors(v), `${p.name}/${id}: ${JSON.stringify(v)}`).toBe(false);
    }
  });
  it("Fortune 1000 requires a big public brand for Tier 1 and honours the watchlist rule", () => {
    const p = buildFortune1000Preset();
    const r = res({ role: choice("cfo", 1), company_type: choice("healthcare", 0.8), likely_private_or_family: noul(0.05), is_big_public_brand: noul(0.9), disqualified: noul(0.05) });
    expect(connectionTier(row("CFO", "Pfizer"), r, p.thresholds, p.icp, false)).toBe("tier1");
    const small = res({ ...r.answers, is_big_public_brand: noul(0.1), likely_private_or_family: noul(0.9) });
    expect(connectionTier(row("CFO", "Kessler Group"), small, p.thresholds, p.icp, false)).toBe("tier3");
    const strict = { ...p.thresholds, watchlistTier1Only: true };
    expect(connectionTier(row("CFO", "Pfizer"), r, strict, p.icp, false)).toBe("tier2");
    expect(connectionTier(row("CFO", "Pfizer"), r, strict, p.icp, true)).toBe("tier1");
  });
  it("Private Equity and Recruiters derive their own role keys", () => {
    const pe = buildPrivateEquityPreset().questions.find((q) => q.id === "role")!;
    expect(pe.options!.map((o) => o.key)).toEqual(expect.arrayContaining(["pe_operating_partner", "pe_investment_partner", "ceo", "cfo", "board_member"]));
    const rc = buildRecruitersPreset().questions.find((q) => q.id === "role")!;
    expect(rc.options!.map((o) => o.key)).toEqual(expect.arrayContaining(["executive_search_partner", "tech_leadership_recruiter", "inhouse_exec_recruiter", "chro"]));
  });
});
