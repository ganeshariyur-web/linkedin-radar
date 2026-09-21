// Assemble the Jev state for a row from contract fields only. This is the
// single place where row data becomes model input.

import { contractFieldNames } from "./contract";
import type { ConnectionRow, Enrichment, InvitationRow, Pass, QuestionSpec, Tab } from "./types";

export type JevState = Record<string, string | number | boolean | null>;

/** Contract fields available for a tab given the current upload and enrichment. */
export function availableFields(tab: Tab, pass: Pass, uploaded: boolean, enriched: boolean): string[] {
  if (pass === "pre") return uploaded ? contractFieldNames(tab, "pre") : [];
  return enriched ? contractFieldNames(tab, "post") : [];
}

export function fieldsForQuestions(qs: QuestionSpec[]): string[] {
  const s = new Set<string>();
  for (const q of qs) if (q.enabled) for (const f of q.fields) s.add(f);
  return Array.from(s);
}

export function connectionPreState(row: ConnectionRow, fields: string[]): JevState {
  const all: JevState = {
    position: row.position,
    company: row.company,
    connected_for: row.connectedFor ?? "unknown",
  };
  if (row.nameSuffixes) all.name_suffixes = row.nameSuffixes;
  return pick(all, fields);
}

export function invitationPreState(row: InvitationRow, fields: string[]): JevState {
  const all: JevState = {
    name: row.name,
    message: row.message,
    invitation_age: row.invitationAge ?? "unknown",
  };
  return pick(all, fields);
}

export function postState(e: Enrichment, fields: string[]): JevState {
  const all: JevState = {
    headline: e.headline,
    about: e.about ? e.about.slice(0, 600) : null,
    location: e.location,
    country: e.country,
    current_company: e.currentCompany,
    current_title: e.currentTitle,
    company_size: e.companySize,
    company_size_range: e.companySizeRange,
    company_industry: e.companyIndustry,
    follower_count: e.followerCount,
    connections_count: e.connectionsCount,
    open_to_work: e.openToWork,
    last_post_date: e.lastPostDate,
    posts_last_30_days: e.postsLast30Days,
  };
  return pick(all, fields);
}

function pick(all: JevState, fields: string[]): JevState {
  const out: JevState = {};
  for (const f of fields) {
    if (f in all) {
      // name_suffixes is passed only when present; other fields pass as-is (null allowed post-enrichment).
      if (f === "name_suffixes" && (all[f] === null || all[f] === undefined)) continue;
      out[f] = all[f] ?? null;
    }
  }
  return out;
}
