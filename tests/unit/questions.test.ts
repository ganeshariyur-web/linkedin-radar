import { describe, expect, it } from "vitest";
import { DEFAULT_ICP } from "@/lib/icp";
import { buildDefaultQuestions, hasErrors, validateQuestion, validateQuestions, questionsHash } from "@/lib/questions";
import { contractFieldNames, FORBIDDEN_PRE_ENRICHMENT } from "@/lib/contract";
import type { QuestionSpec } from "@/lib/types";

const qs = buildDefaultQuestions(DEFAULT_ICP);

describe("default questions", () => {
  it("reference only contract fields and no forbidden pre-enrichment field", () => {
    for (const q of qs) {
      const allowed = contractFieldNames(q.tab, q.pass);
      for (const f of q.fields) expect(allowed, `${q.id}.${f}`).toContain(f);
      if (q.pass === "pre") for (const f of q.fields) expect(FORBIDDEN_PRE_ENRICHMENT).not.toContain(f);
    }
  });
  it("all validate without errors", () => {
    const issues = validateQuestions(qs);
    for (const [id, v] of Object.entries(issues)) expect(hasErrors(v), `${id}: ${JSON.stringify(v)}`).toBe(false);
  });
  it("keep unknown / unclear / not_stated available and say when to use them", () => {
    const role = qs.find((q) => q.id === "role")!;
    expect(role.options!.map((o) => o.key)).toContain("unknown");
    expect(role.instructions).toMatch(/unknown/);
    const ct = qs.find((q) => q.id === "company_type")!;
    expect(ct.options!.map((o) => o.key)).toContain("unclear");
    expect(ct.instructions).toMatch(/unclear/);
    const sen = qs.find((q) => q.id === "self_described_seniority")!;
    expect(sen.options!.map((o) => o.key)).toContain("not_stated");
  });
  it("derive role and industry options from the ICP", () => {
    const role = qs.find((q) => q.id === "role")!;
    expect(role.options!.map((o) => o.key)).toEqual(expect.arrayContaining(["chief_of_staff", "coo", "ceo", "president_md_owner", "other_executive", "not_executive", "unknown"]));
    const ct = qs.find((q) => q.id === "company_type")!;
    expect(ct.options!.map((o) => o.key)).toEqual(expect.arrayContaining(["manufacturing", "industrial", "distribution", "construction", "logistics", "professional_services", "unclear"]));
  });
});

describe("validateQuestion rules", () => {
  const base: QuestionSpec = { id: "q", type: "choice", tab: "connections", pass: "pre", enabled: true, instructions: "x", fields: ["position"], options: [{ key: "a", description: "A" }, { key: "b", description: "B" }] };
  it("choice needs 2–255 options each with a criterion", () => {
    expect(hasErrors(validateQuestion({ ...base, options: [{ key: "a", description: "A" }] }))).toBe(true);
    expect(hasErrors(validateQuestion({ ...base, options: [{ key: "a", description: "A" }, { key: "b", description: "" }] }))).toBe(true);
    const many = Array.from({ length: 256 }, (_, i) => ({ key: `o${i}`, description: "d" }));
    expect(hasErrors(validateQuestion({ ...base, options: many }))).toBe(true);
    expect(hasErrors(validateQuestion({ ...base, options: many.slice(0, 255) }))).toBe(false);
  });
  it("score needs 2–10 ordered levels", () => {
    expect(hasErrors(validateQuestion({ ...base, type: "score", options: undefined, levels: ["only"] }))).toBe(true);
    expect(hasErrors(validateQuestion({ ...base, type: "score", options: undefined, levels: Array(11).fill("l") }))).toBe(true);
    expect(hasErrors(validateQuestion({ ...base, type: "score", options: undefined, levels: ["low", "high"] }))).toBe(false);
  });
  it("noul takes a statement and no criteria", () => {
    expect(hasErrors(validateQuestion({ ...base, type: "noul", options: undefined }))).toBe(false);
    expect(hasErrors(validateQuestion({ ...base, type: "noul" }))).toBe(true);
    expect(hasErrors(validateQuestion({ ...base, type: "noul", options: undefined, instructions: "" }))).toBe(true);
  });
  it("needs at least one field, inside the contract, not forbidden", () => {
    expect(hasErrors(validateQuestion({ ...base, fields: [] }))).toBe(true);
    expect(hasErrors(validateQuestion({ ...base, fields: ["location"] }))).toBe(true);
    expect(hasErrors(validateQuestion({ ...base, fields: ["headline"] }))).toBe(true);
    expect(hasErrors(validateQuestion({ ...base, fields: ["message"] }))).toBe(true); // invitations field on connections
  });
  it("warns when a field is missing from the current upload", () => {
    const issues = validateQuestion(base, { availableFields: ["company"] });
    expect(issues.some((i) => i.level === "warning" && /missing from the current upload/.test(i.message))).toBe(true);
  });
  it("warns when instructions mention an option that does not exist", () => {
    const issues = validateQuestion({ ...base, instructions: 'Choose "not_an_option" when unsure.' });
    expect(issues.some((i) => i.level === "warning" && /no option has that key/.test(i.message))).toBe(true);
  });
});

describe("questionsHash", () => {
  it("changes when instructions change and ignores disabled questions", () => {
    const a = questionsHash(qs, "pre", "connections");
    const edited = qs.map((q) => (q.id === "role" ? { ...q, instructions: q.instructions + " edited" } : q));
    expect(questionsHash(edited, "pre", "connections")).not.toBe(a);
    const disabledOther = qs.map((q) => (q.id === "message_intent" ? { ...q, enabled: false } : q));
    expect(questionsHash(disabledOther, "pre", "connections")).toBe(a);
  });
});
