// Company watchlist matching. Pure code: normalises names and matches the
// exported Company text against a preset's list. Jev never sees the list.

const SUFFIX = /\b(inc|incorporated|corp|corporation|co|company|ltd|limited|llc|llp|plc|lp|holdings?|group|the|sa|ag|nv|se|gmbh)\b/g;

export function normalizeCompany(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(SUFFIX, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface WatchlistMatcher {
  size: number;
  match: (company: string) => string | null;
}

export function buildWatchlist(list: string[] | undefined): WatchlistMatcher {
  const entries = (list ?? []).map((raw) => ({ raw: raw.trim(), key: normalizeCompany(raw) })).filter((e) => e.key.length >= 2);
  const exact = new Map(entries.map((e) => [e.key, e.raw]));
  const multi = entries.filter((e) => e.key.includes(" ") || e.key.length >= 6);
  return {
    size: entries.length,
    match: (company: string) => {
      const k = normalizeCompany(company);
      if (!k) return null;
      const hit = exact.get(k);
      if (hit) return hit;
      // A longer exported name that starts with, or contains as a whole word, a distinctive list entry.
      for (const e of multi) {
        if (k.startsWith(e.key + " ") || k.endsWith(" " + e.key) || k.includes(" " + e.key + " ")) return e.raw;
      }
      return null;
    },
  };
}

export function parseWatchlistText(text: string): string[] {
  return Array.from(new Set(text.split(/\r?\n|,|;/).map((s) => s.trim()).filter(Boolean)));
}
