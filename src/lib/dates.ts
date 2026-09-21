// All date arithmetic lives here, in code. Jev never sees a date; it sees the
// bucket strings produced below.

import type { ConnectedFor, InvitationAge } from "./types";

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};

/** "18 Sep 2026" → ISO date string (UTC midnight) or null. */
export function parseConnectedOn(raw: string): string | null {
  const m = raw.trim().match(/^(\d{1,2})\s+([A-Za-z]{3,4})\.?\s+(\d{4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const mon = MONTHS[m[2].toLowerCase()];
  const year = Number(m[3]);
  if (mon === undefined || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, mon, day));
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/** "9/18/26, 1:20 AM" → ISO datetime (UTC) or null. Accepts 2- or 4-digit years. */
export function parseSentAt(raw: string): string | null {
  const m = raw
    .trim()
    .match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?$/);
  if (!m) return null;
  const month = Number(m[1]) - 1;
  const day = Number(m[2]);
  let year = Number(m[3]);
  if (year < 100) year += 2000;
  let hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = m[6] ? Number(m[6]) : 0;
  const ampm = m[7]?.toUpperCase();
  if (ampm === "PM" && hour < 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;
  if (month < 0 || month > 11 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  const d = new Date(Date.UTC(year, month, day, hour, minute, second));
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export function describeDateFormat(sample: string): string {
  if (parseConnectedOn(sample)) return 'Day Month Year ("18 Sep 2026")';
  if (parseSentAt(sample)) return 'M/D/YY, h:mm AM ("9/18/26, 1:20 AM")';
  return "unrecognised";
}

const DAY = 86_400_000;

export function connectedForBucket(iso: string | null, now: Date = new Date()): ConnectedFor | null {
  if (!iso) return null;
  const days = (now.getTime() - new Date(iso).getTime()) / DAY;
  if (days < 365) return "under 1 year";
  if (days < 365 * 3) return "1–3 years";
  return "3+ years";
}

export function invitationAgeBucket(iso: string | null, now: Date = new Date()): InvitationAge | null {
  if (!iso) return null;
  const days = (now.getTime() - new Date(iso).getTime()) / DAY;
  if (days <= 7) return "this week";
  if (days <= 31) return "this month";
  return "older";
}
