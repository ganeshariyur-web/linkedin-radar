// Build typed rows from a detected CSV. Every derived value here is code-owned.

import type { DetectedFile } from "./csv";
import { connectedForBucket, describeDateFormat, invitationAgeBucket, parseConnectedOn, parseSentAt } from "./dates";
import { urlKey } from "./join";
import { splitSuffixes } from "./names";
import type { ConnectionRow, InvitationRow, UploadStats } from "./types";

export function buildConnections(file: DetectedFile, fileName: string, now = new Date()): { rows: ConnectionRow[]; stats: UploadStats } {
  const idx = Object.fromEntries(file.header.map((h, i) => [h.toLowerCase(), i]));
  const col = (r: string[], name: string) => (r[idx[name.toLowerCase()]] ?? "").trim();
  const rows: ConnectionRow[] = [];
  let emptyPosition = 0, emptyCompany = 0, withEmail = 0;
  let sampleDate = "";
  const seen = new Map<string, number>();
  file.dataRecords.forEach((r, i) => {
    const firstName = col(r, "First Name");
    const lastNameRaw = col(r, "Last Name");
    const { clean, suffixes } = splitSuffixes(lastNameRaw);
    const url = col(r, "URL");
    const email = col(r, "Email Address");
    const company = col(r, "Company");
    const position = col(r, "Position");
    const connectedOnRaw = col(r, "Connected On");
    if (!sampleDate && connectedOnRaw) sampleDate = connectedOnRaw;
    const connectedOn = parseConnectedOn(connectedOnRaw);
    if (!position) emptyPosition++;
    if (!company) emptyCompany++;
    if (email) withEmail++;
    const key = urlKey(url);
    let id = key ? `c:${key}` : `c:row${i}`;
    const dup = seen.get(id) ?? 0;
    if (dup) id = `${id}#${dup}`;
    seen.set(key ? `c:${key}` : id, dup + 1);
    rows.push({
      id,
      firstName,
      lastName: lastNameRaw,
      lastNameClean: clean,
      nameSuffixes: suffixes,
      url,
      urlKey: key,
      email,
      hasEmail: !!email,
      company,
      position,
      connectedOnRaw,
      connectedOn,
      connectedFor: connectedForBucket(connectedOn, now),
    });
  });
  const stats: UploadStats = {
    fileName,
    schema: "connections",
    rawLineCount: file.rawLineCount,
    rawDataLineCount: file.rawDataLineCount,
    parsedRowCount: rows.length,
    dateFormat: describeDateFormat(sampleDate),
    emptyPosition,
    emptyCompany,
    withEmail,
    preambleLines: file.preambleLines,
    columns: file.header,
  };
  return { rows, stats };
}

export function buildInvitations(file: DetectedFile, fileName: string, now = new Date()): { rows: InvitationRow[]; stats: UploadStats } {
  const idx = Object.fromEntries(file.header.map((h, i) => [h.toLowerCase(), i]));
  const col = (r: string[], name: string) => (r[idx[name.toLowerCase()]] ?? "").trim();
  const rows: InvitationRow[] = [];
  let withoutMessage = 0, incoming = 0, outgoing = 0;
  let sampleDate = "";
  file.dataRecords.forEach((r, i) => {
    const from = col(r, "From");
    const to = col(r, "To");
    const sentAtRaw = col(r, "Sent At");
    if (!sampleDate && sentAtRaw) sampleDate = sentAtRaw;
    const message = col(r, "Message");
    const dirRaw = col(r, "Direction").toUpperCase();
    const direction = dirRaw === "OUTGOING" ? "OUTGOING" : "INCOMING";
    const inviterProfileUrl = col(r, "inviterProfileUrl");
    const inviteeProfileUrl = col(r, "inviteeProfileUrl");
    const profileUrl = direction === "INCOMING" ? inviterProfileUrl : inviteeProfileUrl;
    const key = urlKey(profileUrl);
    const sentAt = parseSentAt(sentAtRaw);
    if (!message) withoutMessage++;
    if (direction === "INCOMING") incoming++; else outgoing++;
    rows.push({
      id: `i:${direction.toLowerCase()}:${key || "row" + i}:${sentAt ?? sentAtRaw}`,
      from,
      to,
      name: direction === "INCOMING" ? from : to,
      sentAtRaw,
      sentAt,
      invitationAge: invitationAgeBucket(sentAt, now),
      message,
      hasMessage: !!message,
      direction,
      inviterProfileUrl,
      inviteeProfileUrl,
      profileUrl,
      urlKey: key,
      match: null,
    });
  });
  const stats: UploadStats = {
    fileName,
    schema: "invitations",
    rawLineCount: file.rawLineCount,
    rawDataLineCount: file.rawDataLineCount,
    parsedRowCount: rows.length,
    dateFormat: describeDateFormat(sampleDate),
    withoutMessage,
    incoming,
    outgoing,
    preambleLines: file.preambleLines,
    columns: file.header,
  };
  return { rows, stats };
}
