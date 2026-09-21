// RFC 4180 CSV parsing with LinkedIn-specific schema detection. Runs only in
// the browser (and in tests); uploaded bytes never reach the server.

import type { Tab } from "./types";

export const CONNECTIONS_HEADER = [
  "First Name",
  "Last Name",
  "URL",
  "Email Address",
  "Company",
  "Position",
  "Connected On",
];

export const INVITATIONS_HEADER = [
  "From",
  "To",
  "Sent At",
  "Message",
  "Direction",
  "inviterProfileUrl",
  "inviteeProfileUrl",
];

/** Parse CSV text into records. Handles quotes, escaped quotes, embedded newlines, CRLF. */
export function parseCsv(text: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  // Strip BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (c === "\r") {
      i++;
      continue;
    }
    if (c === "\n") {
      row.push(field);
      records.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += c;
    i++;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    records.push(row);
  }
  return records;
}

function normHeader(cells: string[]): string[] {
  return cells.map((c) => c.replace(/^﻿/, "").trim());
}

function headerMatches(cells: string[], expected: string[]): boolean {
  const h = normHeader(cells);
  if (h.length < expected.length) return false;
  for (let i = 0; i < expected.length; i++) {
    if (h[i].toLowerCase() !== expected[i].toLowerCase()) return false;
  }
  return true;
}

export interface DetectedFile {
  schema: Tab;
  headerIndex: number;
  header: string[];
  dataRecords: string[][];
  rawLineCount: number;
  rawDataLineCount: number;
  preambleLines: number;
}

/**
 * Detect which LinkedIn export a CSV is, skipping any "Notes:" preamble. Returns
 * null when the header matches neither schema.
 */
export function detectFile(text: string): DetectedFile | null {
  const records = parseCsv(text);
  const physicalLines = text.split(/\r\n|\n|\r/);
  // Trailing empty physical line from a final newline is not a data line.
  let rawLineCount = physicalLines.length;
  if (rawLineCount > 0 && physicalLines[rawLineCount - 1] === "") rawLineCount--;

  let headerIndex = -1;
  let schema: Tab | null = null;
  const limit = Math.min(records.length, 50);
  for (let i = 0; i < limit; i++) {
    if (headerMatches(records[i], CONNECTIONS_HEADER)) {
      headerIndex = i;
      schema = "connections";
      break;
    }
    if (headerMatches(records[i], INVITATIONS_HEADER)) {
      headerIndex = i;
      schema = "invitations";
      break;
    }
  }
  if (schema === null || headerIndex < 0) return null;

  const header = normHeader(records[headerIndex]);
  const dataRecords = records
    .slice(headerIndex + 1)
    .filter((r) => !(r.length === 1 && r[0].trim() === ""));

  // Physical line index of the header: count newlines consumed by records before it.
  // Recompute by locating the header line text in the physical lines.
  let headerLine = -1;
  for (let i = 0; i < physicalLines.length; i++) {
    const cells = parseCsv(physicalLines[i])[0] ?? [];
    if (schema === "connections" ? headerMatches(cells, CONNECTIONS_HEADER) : headerMatches(cells, INVITATIONS_HEADER)) {
      headerLine = i;
      break;
    }
  }
  const preambleLines = Math.max(0, headerLine);
  let rawDataLineCount = rawLineCount - (headerLine + 1);
  if (rawDataLineCount < 0) rawDataLineCount = 0;

  return { schema, headerIndex, header, dataRecords, rawLineCount, rawDataLineCount, preambleLines };
}

export function expectedColumnsMessage(): string {
  return (
    `Connections.csv needs the columns: ${CONNECTIONS_HEADER.join(", ")}. ` +
    `Invitations.csv needs the columns: ${INVITATIONS_HEADER.join(", ")}.`
  );
}

/** Serialize rows to CSV for download. */
export function toCsv(header: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const esc = (v: string | number | boolean | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [header.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n") + "\n";
}
