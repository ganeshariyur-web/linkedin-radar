"use client";
// Derived, memoised views over the store: scored rows with tiers, filters,
// distributions. All of it is code; none of it calls Jev.

import { useMemo } from "react";
import { resultKey, useActivePreset, useApp } from "./store";
import { BUCKET_LABEL, companySizeBand, connectionTier, invitationBucket, rankScore, TIER_LABEL } from "./tiers";
import type { ConnectionRow, ConnectionTier, Enrichment, InvitationBucket, InvitationRow, RowResult, Tab } from "./types";
import { initials, initialsFromFull } from "./names";
import { buildWatchlist } from "./watchlist";

export interface ScoredConnection {
  kind: "connection";
  id: string;
  row: ConnectionRow;
  pre?: RowResult;
  post?: RowResult;
  enrichment?: Enrichment;
  tier: ConnectionTier;
  name: string;
  initials: string;
  rank: { geoFirst: number; score: number };
  /** Matched watchlist entry, when the preset has one. */
  watchlisted: string | null;
}

export interface ScoredInvitation {
  kind: "invitation";
  id: string;
  row: InvitationRow;
  pre?: RowResult;
  post?: RowResult;
  enrichment?: Enrichment;
  bucket: InvitationBucket;
  name: string;
  initials: string;
}

export type ScoredRow = ScoredConnection | ScoredInvitation;

export function useScoredConnections(): ScoredConnection[] {
  const connections = useApp((s) => s.connections);
  const results = useApp((s) => s.results);
  const enrichment = useApp((s) => s.enrichment);
  const preset = useActivePreset();
  return useMemo(() => {
    const rows = connections?.rows ?? [];
    const wl = buildWatchlist(preset.watchlist);
    return rows.map((row) => {
      const pre = results[resultKey(row.id, "pre")];
      const post = results[resultKey(row.id, "post")];
      const e = enrichment[row.id];
      const watchlisted = wl.size ? wl.match(row.company) : null;
      return {
        kind: "connection" as const,
        id: row.id,
        row,
        pre,
        post,
        enrichment: e,
        tier: connectionTier(row, pre, preset.thresholds, preset.icp, !!watchlisted),
        name: `${row.firstName} ${row.lastNameClean}`.trim(),
        initials: initials(row.firstName, row.lastNameClean),
        rank: rankScore(post, preset.thresholds),
        watchlisted,
      };
    });
  }, [connections, results, enrichment, preset]);
}

export function useScoredInvitations(): ScoredInvitation[] {
  const invitations = useApp((s) => s.invitations);
  const results = useApp((s) => s.results);
  const enrichment = useApp((s) => s.enrichment);
  const preset = useActivePreset();
  return useMemo(() => {
    const rows = invitations?.rows ?? [];
    return rows.map((row) => {
      const pre = results[resultKey(row.id, "pre")];
      const post = results[resultKey(row.id, "post")];
      return {
        kind: "invitation" as const,
        id: row.id,
        row,
        pre,
        post,
        enrichment: enrichment[row.id],
        bucket: invitationBucket(row, pre, preset.thresholds),
        name: row.name,
        initials: initialsFromFull(row.name),
      };
    });
  }, [invitations, results, enrichment, preset]);
}

export interface Filters {
  tier: string[]; // tiers or buckets
  role: string[];
  companyType: string[];
  country: string[];
  sizeBand: string[];
  activity: string[];
  connectedFor: string[];
  hasEmail: "any" | "yes" | "no";
  privateFamily: "any" | "yes" | "no";
  watchlist: "any" | "yes" | "no";
  text: string;
}

export const emptyFilters: Filters = {
  tier: [], role: [], companyType: [], country: [], sizeBand: [], activity: [], connectedFor: [], hasEmail: "any", privateFamily: "any", watchlist: "any", text: "",
};

export function applyFilters(rows: ScoredRow[], f: Filters, privateMin: number): ScoredRow[] {
  const text = f.text.trim().toLowerCase();
  return rows.filter((r) => {
    const tierOrBucket = r.kind === "connection" ? r.tier : r.bucket;
    if (f.tier.length && !f.tier.includes(tierOrBucket)) return false;
    const role = r.pre?.answers.role?.answer ?? (r.kind === "connection" ? "unscored" : "");
    if (f.role.length && !f.role.includes(role)) return false;
    const ct = r.pre?.answers.company_type?.answer ?? "unscored";
    if (f.companyType.length && !f.companyType.includes(ct)) return false;
    const country = r.enrichment?.country ?? "unknown";
    if (f.country.length && !f.country.includes(country)) return false;
    const band = companySizeBand(r.enrichment);
    if (f.sizeBand.length && !f.sizeBand.includes(band)) return false;
    const act = r.post?.answers.active_on_linkedin?.answer ?? "unknown";
    if (f.activity.length && !f.activity.includes(act)) return false;
    if (r.kind === "connection") {
      if (f.connectedFor.length && !f.connectedFor.includes(r.row.connectedFor ?? "unknown")) return false;
      if (f.hasEmail === "yes" && !r.row.hasEmail) return false;
      if (f.hasEmail === "no" && r.row.hasEmail) return false;
      const pf = r.pre?.answers.likely_private_or_family?.noul ?? 0;
      if (f.privateFamily === "yes" && pf < privateMin) return false;
      if (f.privateFamily === "no" && pf >= privateMin) return false;
      if (f.watchlist === "yes" && !r.watchlisted) return false;
      if (f.watchlist === "no" && r.watchlisted) return false;
    }
    if (text) {
      const hay = r.kind === "connection"
        ? `${r.name} ${r.row.position} ${r.row.company} ${r.enrichment?.headline ?? ""}`.toLowerCase()
        : `${r.name} ${r.row.message} ${r.row.from} ${r.row.to}`.toLowerCase();
      if (!hay.includes(text)) return false;
    }
    return true;
  });
}

export function countBy<T>(rows: T[], key: (r: T) => string): { label: string; count: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = key(r);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return Array.from(m.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

export function labelFor(tab: Tab, key: string): string {
  if (tab === "connections") return TIER_LABEL[key as ConnectionTier] ?? key;
  return BUCKET_LABEL[key as InvitationBucket] ?? key;
}

export function tierOrder(t: ConnectionTier): number {
  return { tier1: 0, tier2: 1, tier3: 2, rejected: 3, unscored: 4 }[t];
}
export function bucketOrder(b: InvitationBucket): number {
  return { accept: 0, review: 1, no_signal: 2, ignore: 3, outgoing: 4, unscored: 5 }[b];
}
