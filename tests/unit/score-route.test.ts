import { describe, expect, it } from "vitest";
import { validateScoreRequest } from "@/lib/score-validate";
import { buildDefaultQuestions } from "@/lib/questions";
import { DEFAULT_ICP } from "@/lib/icp";
import { toJevQuestion } from "@/lib/jev";

const qs = buildDefaultQuestions(DEFAULT_ICP);
const connQs = qs.filter((q) => q.tab === "connections" && q.pass === "pre");
const row = { id: "c:1", state: { position: "CEO", company: "Kessler Group", connected_for: "1–3 years" } };

describe("validateScoreRequest", () => {
  it("accepts a valid request", () => {
    const v = validateScoreRequest({ tab: "connections", pass: "pre", questions: connQs, rows: [row] });
    expect(v.ok).toBe(true);
  });
  it("rejects more than 50 rows", () => {
    const v = validateScoreRequest({ tab: "connections", pass: "pre", questions: connQs, rows: Array(51).fill(row) });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.status).toBe(413);
  });
  it("rejects an invalid question spec (choice with one option)", () => {
    const bad = connQs.map((q) => (q.id === "role" ? { ...q, options: [{ key: "only", description: "x" }] } : q));
    const v = validateScoreRequest({ tab: "connections", pass: "pre", questions: bad, rows: [row] });
    expect(v.ok).toBe(false);
    if (!v.ok) { expect(v.status).toBe(422); expect(JSON.stringify(v.details)).toMatch(/at least 2 options/); }
  });
  it("rejects a question naming a field outside the contract", () => {
    const bad = connQs.map((q) => (q.id === "role" ? { ...q, fields: ["position", "location"] } : q));
    const v = validateScoreRequest({ tab: "connections", pass: "pre", questions: bad, rows: [row] });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.status).toBe(422);
  });
  it("rejects state carrying a non-contract or forbidden field", () => {
    const v = validateScoreRequest({ tab: "connections", pass: "pre", questions: connQs, rows: [{ id: "c:1", state: { ...row.state, location: "Ohio" } }] });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error).toMatch(/outside the connections pre-enrichment contract/);
    const v2 = validateScoreRequest({ tab: "connections", pass: "pre", questions: connQs, rows: [{ id: "c:1", state: { ...row.state, has_email: true } }] });
    expect(v2.ok).toBe(false);
  });
  it("rejects questions from another tab or pass", () => {
    const v = validateScoreRequest({ tab: "connections", pass: "pre", questions: qs.filter((q) => q.tab === "invitations"), rows: [row] });
    expect(v.ok).toBe(false);
  });
  it("rejects malformed bodies", () => {
    expect(validateScoreRequest(null).ok).toBe(false);
    expect(validateScoreRequest({ tab: "x" }).ok).toBe(false);
    expect(validateScoreRequest({ tab: "connections", pass: "pre", questions: connQs, rows: [] }).ok).toBe(false);
  });
});

describe("toJevQuestion", () => {
  it("builds choice/score/noul with the declared fields in the instructions and no criteria on noul", () => {
    const role = toJevQuestion(qs.find((q) => q.id === "role")!);
    expect(role.type).toBe("choice");
    expect(Object.keys((role as { criteria: Record<string, string> }).criteria)).toContain("unknown");
    expect(JSON.stringify(role.instructions)).toMatch(/`position`/);
    const rev = toJevQuestion(qs.find((q) => q.id === "revenue_over_threshold")!);
    expect(rev.type).toBe("score");
    expect((rev as unknown as { criteria: unknown[] }).criteria.length).toBe(5);
    const n = toJevQuestion(qs.find((q) => q.id === "disqualified")!);
    expect(n.type).toBe("noul");
    expect("criteria" in n).toBe(false);
  });
});
