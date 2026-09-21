import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { detectFile, parseCsv } from "@/lib/csv";
import { buildConnections, buildInvitations } from "@/lib/rows";
import { matchInvitations } from "@/lib/join";

const expected = JSON.parse(readFileSync("fixtures/expected.json", "utf8"));
const connText = readFileSync("fixtures/Connections.csv", "utf8");
const invText = readFileSync("fixtures/Invitations.csv", "utf8");
const NOW = new Date(Date.UTC(2026, 8, 21, 12));

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, commas and embedded newlines", () => {
    const rows = parseCsv('a,"b, c","say ""hi""","line1\nline2"\r\n1,2,3,4\n');
    expect(rows).toEqual([["a", "b, c", 'say "hi"', "line1\nline2"], ["1", "2", "3", "4"]]);
  });
  it("strips a BOM", () => {
    expect(parseCsv("﻿From,To\n")[0]).toEqual(["From", "To"]);
  });
});

describe("detectFile", () => {
  it("skips the Notes: preamble and finds the Connections header", () => {
    const d = detectFile(connText)!;
    expect(d.schema).toBe("connections");
    expect(d.preambleLines).toBe(expected.connections.preambleLines);
    expect(d.dataRecords.length).toBe(expected.connections.rows);
    expect(d.rawDataLineCount).toBe(expected.connections.rawDataLines);
    // parsed count matches raw line count
    expect(d.dataRecords.length).toBe(d.rawDataLineCount);
  });
  it("detects Invitations regardless of filename", () => {
    const d = detectFile(invText)!;
    expect(d.schema).toBe("invitations");
    expect(d.dataRecords.length).toBe(expected.invitations.rows);
    expect(d.dataRecords.length).toBe(d.rawDataLineCount);
  });
  it("rejects a file matching neither schema", () => {
    expect(detectFile(readFileSync("fixtures/messages.csv", "utf8"))).toBeNull();
    expect(detectFile("hello,world\n1,2\n")).toBeNull();
  });
});

describe("buildConnections", () => {
  const { rows, stats } = buildConnections(detectFile(connText)!, "Connections.csv", NOW);
  it("counts empty Position, empty Company and emails", () => {
    expect(stats.parsedRowCount).toBe(expected.connections.rows);
    expect(stats.emptyPosition).toBe(expected.connections.emptyPosition);
    expect(stats.emptyCompany).toBe(expected.connections.emptyCompany);
    expect(stats.withEmail).toBe(expected.connections.withEmail);
    expect(stats.dateFormat).toMatch(/Day Month Year/);
  });
  it("parses every Connected On date and buckets it", () => {
    expect(rows.every((r) => r.connectedOn !== null)).toBe(true);
    const buckets = new Set(rows.map((r) => r.connectedFor));
    expect(buckets).toEqual(new Set(["under 1 year", "1–3 years", "3+ years"]));
  });
  it("extracts credentials after the last name as name_suffixes", () => {
    const withCreds = rows.filter((r) => r.nameSuffixes);
    expect(withCreds.length).toBe(expected.connections.withCreds);
    expect(withCreds[0].lastNameClean).not.toContain(",");
  });
  it("has_email is code-computed", () => {
    expect(rows.filter((r) => r.hasEmail).length).toBe(expected.connections.withEmail);
  });
});

describe("buildInvitations + matching", () => {
  const conns = buildConnections(detectFile(connText)!, "Connections.csv", NOW).rows;
  const { rows, stats } = buildInvitations(detectFile(invText)!, "Invitations.csv", NOW);
  it("parses M/D/YY, h:mm AM dates and counts", () => {
    expect(stats.dateFormat).toMatch(/M\/D\/YY/);
    expect(rows.every((r) => r.sentAt !== null)).toBe(true);
    expect(stats.incoming).toBe(expected.invitations.incoming);
    expect(stats.outgoing).toBe(expected.invitations.outgoing);
    expect(stats.withoutMessage).toBe(expected.invitations.withoutMessage);
  });
  it("buckets invitation age", () => {
    const b = new Set(rows.map((r) => r.invitationAge));
    expect(b.has("this week")).toBe(true);
    expect(b.has("this month")).toBe(true);
    expect(b.has("older")).toBe(true);
  });
  it("matches OUTGOING invitees and INCOMING inviters against Connections", () => {
    const matched = matchInvitations(rows, conns);
    const out = matched.filter((r) => r.direction === "OUTGOING");
    expect(out.filter((r) => r.match === "accepted").length).toBe(expected.invitations.outgoingAccepted);
    expect(out.filter((r) => r.match === "pending").length).toBe(expected.invitations.outgoingPending);
    const inc = matched.filter((r) => r.direction === "INCOMING");
    expect(inc.filter((r) => r.match === "accepted").length).toBe(expected.invitations.incomingAccepted);
    expect(inc.filter((r) => r.match === "pending").length).toBe(expected.invitations.incomingPending);
  });
});
