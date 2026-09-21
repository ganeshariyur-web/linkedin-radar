import { describe, expect, it } from "vitest";
import { connectedForBucket, invitationAgeBucket, parseConnectedOn, parseSentAt } from "@/lib/dates";

const NOW = new Date(Date.UTC(2026, 8, 21, 12));

describe("dates", () => {
  it("parses '18 Sep 2026'", () => {
    expect(parseConnectedOn("18 Sep 2026")).toBe("2026-09-18T00:00:00.000Z");
    expect(parseConnectedOn("1 Jan 2020")).toBe("2020-01-01T00:00:00.000Z");
    expect(parseConnectedOn("2026-09-18")).toBeNull();
  });
  it("parses '9/18/26, 1:20 AM' and PM", () => {
    expect(parseSentAt("9/18/26, 1:20 AM")).toBe("2026-09-18T01:20:00.000Z");
    expect(parseSentAt("12/3/25, 12:05 PM")).toBe("2025-12-03T12:05:00.000Z");
    expect(parseSentAt("1/2/26, 12:30 AM")).toBe("2026-01-02T00:30:00.000Z");
    expect(parseSentAt("18 Sep 2026")).toBeNull();
  });
  it("buckets connected_for", () => {
    expect(connectedForBucket("2026-01-01T00:00:00.000Z", NOW)).toBe("under 1 year");
    expect(connectedForBucket("2024-06-01T00:00:00.000Z", NOW)).toBe("1–3 years");
    expect(connectedForBucket("2019-06-01T00:00:00.000Z", NOW)).toBe("3+ years");
    expect(connectedForBucket(null, NOW)).toBeNull();
  });
  it("buckets invitation_age", () => {
    expect(invitationAgeBucket("2026-09-19T00:00:00.000Z", NOW)).toBe("this week");
    expect(invitationAgeBucket("2026-09-01T00:00:00.000Z", NOW)).toBe("this month");
    expect(invitationAgeBucket("2026-05-01T00:00:00.000Z", NOW)).toBe("older");
  });
});
