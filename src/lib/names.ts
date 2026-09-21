// Name helpers. Credentials after the last name ("Rahman, PharmD") become
// name_suffixes, a contract field passed to Jev only when present.

export function splitSuffixes(lastName: string): { clean: string; suffixes: string | null } {
  const raw = lastName.trim();
  const idx = raw.indexOf(",");
  if (idx < 0) return { clean: raw, suffixes: null };
  const clean = raw.slice(0, idx).trim();
  const suffixes = raw
    .slice(idx + 1)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");
  return { clean: clean || raw, suffixes: suffixes || null };
}

export function initials(first: string, last: string): string {
  const a = (first.trim()[0] ?? "").toUpperCase();
  const b = (last.trim()[0] ?? "").toUpperCase();
  return (a + b) || "?";
}

export function initialsFromFull(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
