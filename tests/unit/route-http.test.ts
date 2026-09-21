// Calls the route handler directly with a Request to prove HTTP-level rejection.
import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/score/route";
import { buildDefaultQuestions } from "@/lib/questions";
import { DEFAULT_ICP } from "@/lib/icp";

const qs = buildDefaultQuestions(DEFAULT_ICP).filter((q) => q.tab === "connections" && q.pass === "pre");
const mk = (body: unknown) => new Request("http://localhost/api/score", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

describe("POST /api/score", () => {
  it("returns 422 for an invalid question spec", async () => {
    const bad = qs.map((q) => (q.id === "role" ? { ...q, options: [] } : q));
    const res = await POST(mk({ tab: "connections", pass: "pre", questions: bad, rows: [{ id: "c:1", state: { position: "CEO" } }] }) as never);
    expect(res.status).toBe(422);
    const j = await res.json();
    expect(j.error).toMatch(/validation/i);
  });
  it("returns 422 for a state field outside the contract", async () => {
    const res = await POST(mk({ tab: "connections", pass: "pre", questions: qs, rows: [{ id: "c:1", state: { position: "CEO", photo: "x" } }] }) as never);
    expect(res.status).toBe(422);
  });
  it("returns 400 for invalid JSON", async () => {
    const res = await POST(new Request("http://localhost/api/score", { method: "POST", body: "{nope" }) as never);
    expect(res.status).toBe(400);
  });
});
