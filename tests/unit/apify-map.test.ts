import { describe, expect, it } from "vitest";
import { actorErrorOf, mapProfileItem, PROFILE_ACTOR, COMPANY_ACTOR, estimateUsd } from "@/config/apify";

describe("apify mapping", () => {
  it("detects an actor error record", () => {
    expect(actorErrorOf([{ error: "Free users are limited to 10 items per run." }])).toMatch(/10 items/);
    expect(actorErrorOf([{ linkedinUrl: "https://www.linkedin.com/in/x", headline: "y" }])).toBeNull();
    expect(actorErrorOf([])).toBeNull();
  });
  it("chunks runs at 10 on the free plan and estimates accordingly", () => {
    expect(PROFILE_ACTOR.maxItemsPerRun).toBe(10);
    expect(COMPANY_ACTOR.maxItemsPerRun).toBe(10);
    expect(estimateUsd(PROFILE_ACTOR, 99)).toBeCloseTo(99 * 0.004, 6);
  });
  it("maps a profile item", () => {
    const m = mapProfileItem({
      linkedinUrl: "https://www.linkedin.com/in/jane-doe", publicIdentifier: "jane-doe", headline: "COO", photo: "https://p/x.jpg",
      location: { linkedinText: "Atlanta, Georgia, United States", countryCode: "US", parsed: { country: "United States" } },
      currentPosition: [{ companyName: "Acme" }],
      experience: [{ position: "COO", companyName: "Acme", companyLinkedinUrl: "https://www.linkedin.com/company/acme/", endDate: { text: "Present" } }],
      followerCount: 10, connectionsCount: 500, openToWork: false,
    });
    expect(m.country).toBe("United States");
    expect(m.currentCompany).toBe("Acme");
    expect(m.companyLinkedinUrl).toMatch(/company\/acme/);
    expect(m.currentTitle).toBe("COO");
  });
});
