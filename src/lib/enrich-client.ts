"use client";
// Browser-side enrichment orchestration: start Apify runs in chunks of 100,
// poll every few seconds, map items to rows by profile URL, then run the
// company actor for distinct Tier 1 companies without size.

import { COMPANY_ACTOR, PROFILE_ACTOR, estimateUsd, mapCompanyItem, mapProfileItem, type MappedCompany, type MappedProfile } from "@/config/apify";
import { urlKey } from "./join";
import { useApp } from "./store";
import { startRun as startScoring } from "./runner";
import type { Enrichment } from "./types";

export interface EnrichProgress {
  phase: "idle" | "starting" | "polling" | "companies" | "done" | "error" | "aborted";
  runId: string | null;
  received: number;
  total: number;
  message: string;
  usdSpent: number | null;
  /** Items the actor returned that could not be attached to any row (URL changed, private, or not in the upload). */
  unmatched?: number;
  /** Items the actor returned with no profile at all (private or missing). */
  empty?: number;
}

export interface AttachReport {
  returned: number;
  attached: number;
  unmatched: number;
  empty: number;
}

export function estimateProfileUsd(count: number) {
  return estimateUsd(PROFILE_ACTOR, count);
}
export function estimateCompanyUsd(count: number) {
  return estimateUsd(COMPANY_ACTOR, count);
}

let abortFlag = false;
export function abortEnrichment() {
  abortFlag = true;
}

async function startRun(kind: "profile" | "company", urls: string[]) {
  const res = await fetch("/api/enrich", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "start", kind, urls }) });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
  return j as { runId: string; datasetId: string; status: string; estimateUsd: number };
}

async function poll<T>(kind: "profile" | "company", runId: string, datasetId: string, onItems: (items: T[]) => void, onTick?: (status: string) => void): Promise<number | null> {
  let offset = 0;
  let usd: number | null = null;
  for (;;) {
    if (abortFlag) {
      await fetch("/api/enrich", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "abort", runId }) }).catch(() => {});
      throw new Error("aborted");
    }
    const res = await fetch(`/api/enrich?runId=${encodeURIComponent(runId)}&datasetId=${encodeURIComponent(datasetId)}&offset=${offset}&kind=${kind}`);
    const j = await res.json();
    if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
    if (j.items?.length) {
      onItems(j.items as T[]);
      offset = j.nextOffset;
    }
    usd = j.usageTotalUsd ?? usd;
    onTick?.(j.status);
    if (j.finished && (!j.items || j.items.length === 0)) {
      // One final fetch to drain remaining items after the run finished.
      const res2 = await fetch(`/api/enrich?runId=${encodeURIComponent(runId)}&datasetId=${encodeURIComponent(datasetId)}&offset=${offset}&kind=${kind}`);
      const j2 = await res2.json();
      if (res2.ok && j2.items?.length) onItems(j2.items as T[]);
      return usd;
    }
    if (j.finished) continue;
    await new Promise((r) => setTimeout(r, 3000));
  }
}

function toEnrichment(rowId: string, p: MappedProfile, source: Enrichment["source"]): Enrichment {
  return {
    rowId,
    source,
    fetchedAt: new Date().toISOString(),
    photo: p.photo,
    headline: p.headline,
    about: p.about,
    location: p.location,
    country: p.country,
    countryCode: p.countryCode,
    currentCompany: p.currentCompany,
    currentTitle: p.currentTitle,
    companyLinkedinUrl: p.companyLinkedinUrl,
    companySize: null,
    companySizeRange: null,
    companyIndustry: null,
    companyOwnership: null,
    followerCount: p.followerCount,
    connectionsCount: p.connectionsCount,
    openToWork: p.openToWork,
    lastPostDate: null,
    postsLast30Days: null,
  };
}

/** Map of urlKey → rowId for every known row, so actor items attach to the right person. */
export function urlIndex(): Map<string, string> {
  const s = useApp.getState();
  const m = new Map<string, string>();
  for (const r of s.connections?.rows ?? []) if (r.urlKey) m.set(r.urlKey, r.id);
  for (const r of s.invitations?.rows ?? []) if (r.urlKey && !m.has(r.urlKey)) m.set(r.urlKey, r.id);
  return m;
}

export function attachProfiles(items: MappedProfile[], source: Enrichment["source"]): AttachReport {
  const idx = urlIndex();
  const out: Enrichment[] = [];
  let unmatched = 0;
  let empty = 0;
  for (const p of items) {
    const keys = [p.linkedinUrl ? urlKey(p.linkedinUrl) : "", p.publicIdentifier ? `linkedin.com/in/${p.publicIdentifier.toLowerCase()}` : ""].filter(Boolean);
    if (keys.length === 0) { empty++; continue; }
    const rowId = keys.map((k) => idx.get(k)).find(Boolean);
    if (!rowId) { unmatched++; continue; }
    const existing = useApp.getState().enrichment[rowId];
    const e = toEnrichment(rowId, p, source);
    if (existing) {
      e.companySize = existing.companySize;
      e.companySizeRange = existing.companySizeRange;
      e.companyIndustry = existing.companyIndustry;
      e.companyOwnership = existing.companyOwnership;
    }
    out.push(e);
  }
  if (out.length) useApp.getState().setEnrichment(out);
  return { returned: items.length, attached: out.length, unmatched, empty };
}

export function attachCompanies(items: MappedCompany[]): number {
  const s = useApp.getState();
  const byKey = new Map<string, MappedCompany>();
  for (const c of items) {
    if (c.linkedinUrl) byKey.set(urlKey(c.linkedinUrl), c);
    if (c.universalName) byKey.set(`linkedin.com/company/${c.universalName.toLowerCase()}`, c);
  }
  const out: Enrichment[] = [];
  for (const e of Object.values(s.enrichment)) {
    if (!e.companyLinkedinUrl) continue;
    const c = byKey.get(urlKey(e.companyLinkedinUrl));
    if (!c) continue;
    out.push({ ...e, companySize: c.employeeCount, companySizeRange: c.employeeCountRange, companyIndustry: c.industry, companyOwnership: c.companyType });
  }
  useApp.getState().setEnrichment(out);
  return out.length;
}

/** Profile URLs for the given row ids. Only LinkedIn URLs leave the browser. */
export function profileUrlsFor(rowIds: string[]): { rowId: string; url: string }[] {
  const s = useApp.getState();
  const out: { rowId: string; url: string }[] = [];
  const byId = new Map<string, string>();
  for (const r of s.connections?.rows ?? []) byId.set(r.id, r.url);
  for (const r of s.invitations?.rows ?? []) byId.set(r.id, r.profileUrl);
  for (const id of rowIds) {
    const u = byId.get(id);
    if (u && /linkedin\.com\/in\//i.test(u)) out.push({ rowId: id, url: normalizeForActor(u) });
  }
  return out;
}

function normalizeForActor(u: string): string {
  let x = u.trim();
  if (!/^https?:\/\//i.test(x)) x = "https://" + x;
  return x.replace(/[?#].*$/, "").replace(/\/+$/, "");
}

export async function enrichRows(rowIds: string[], onProgress: (p: EnrichProgress) => void, companyRowIds: string[] = []): Promise<void> {
  abortFlag = false;
  const targets = profileUrlsFor(rowIds);
  const total = targets.length;
  let received = 0;
  let unmatched = 0;
  let empty = 0;
  let usd = 0;
  const prog = (patch: Partial<EnrichProgress>) => onProgress({ phase: "polling", runId: null, received, total, message: "", usdSpent: usd, unmatched, empty, ...patch });
  try {
    for (let i = 0; i < targets.length; i += PROFILE_ACTOR.maxItemsPerRun) {
      const chunk = targets.slice(i, i + PROFILE_ACTOR.maxItemsPerRun).map((t) => t.url);
      prog({ phase: "starting", message: `Starting profile run ${Math.floor(i / PROFILE_ACTOR.maxItemsPerRun) + 1} (${chunk.length} URLs)` });
      const run = await startRun("profile", chunk);
      const u = await poll<MappedProfile>(
        "profile",
        run.runId,
        run.datasetId,
        (items) => {
          const r = attachProfiles(items, "apify");
          received += r.attached;
          unmatched += r.unmatched;
          empty += r.empty;
          prog({ phase: "polling", runId: run.runId, message: `Received ${received} of ${total} profiles` });
        },
        (status) => prog({ phase: "polling", runId: run.runId, message: `Apify run ${status.toLowerCase()} · ${received} of ${total} profiles so far · keep this page open` }),
      );
      if (u !== null) usd += u;
    }
    // Company pass for the requested rows (Tier 1) whose company URL lacks size.
    const s = useApp.getState();
    const companyUrls = new Set<string>();
    for (const id of companyRowIds) {
      const e = s.enrichment[id];
      if (e?.companyLinkedinUrl && e.companySize === null && /linkedin\.com\/company\//i.test(e.companyLinkedinUrl)) companyUrls.add(normalizeForActor(e.companyLinkedinUrl));
    }
    const companies = Array.from(companyUrls);
    for (let i = 0; i < companies.length; i += COMPANY_ACTOR.maxItemsPerRun) {
      const chunk = companies.slice(i, i + COMPANY_ACTOR.maxItemsPerRun);
      prog({ phase: "companies", message: `Looking up ${chunk.length} distinct Tier 1 companies` });
      const run = await startRun("company", chunk);
      const u = await poll<MappedCompany>("company", run.runId, run.datasetId, (items) => {
        attachCompanies(items);
        prog({ phase: "companies", runId: run.runId, message: `Company details attached` });
      });
      if (u !== null) usd += u;
    }
    onProgress({ phase: "done", runId: null, received, total, unmatched, empty, usdSpent: usd, message: summaryMessage(received, total, unmatched, empty, companies.length) });
    if (received > 0) startScoring({ tab: "connections", pass: "post" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    onProgress({ phase: msg === "aborted" ? "aborted" : "error", runId: null, received, total, unmatched, empty, message: msg === "aborted" ? "Enrichment stopped." : msg, usdSpent: usd });
  }
}

export function summaryMessage(attached: number, total: number, unmatched: number, empty: number, companies: number): string {
  const parts = [`Enriched ${attached} of ${total} profiles`];
  if (companies) parts.push(`${companies} companies looked up`);
  if (empty) parts.push(`${empty} returned empty (private or missing profile)`);
  if (unmatched) parts.push(`${unmatched} could not be matched to a row (the profile URL has changed since the export)`);
  if (attached > 0) parts.push("post-enrichment questions are running now");
  return parts.join(" · ") + ".";
}

export interface RecentRun {
  runId: string;
  datasetId: string;
  kind: "profile" | "company";
  status: string;
  startedAt: string;
  finishedAt: string | null;
  usd: number | null;
  itemCount: number | null;
}

/** Finished Apify runs on the account, so results paid for earlier can be collected without a new run. */
export async function listRecentRuns(): Promise<RecentRun[]> {
  const res = await fetch("/api/enrich?action=recent");
  const j = await res.json();
  if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
  return (j.runs as RecentRun[]).filter((r) => r.status === "SUCCEEDED" && (r.itemCount ?? 0) > 0);
}

/** Collect a finished run's items and attach them. Free: reads the dataset only. */
export async function collectRun(run: RecentRun): Promise<AttachReport & { companies: number }> {
  let offset = 0;
  const report = { returned: 0, attached: 0, unmatched: 0, empty: 0, companies: 0 };
  for (;;) {
    const res = await fetch(`/api/enrich?runId=${encodeURIComponent(run.runId)}&datasetId=${encodeURIComponent(run.datasetId)}&offset=${offset}&kind=${run.kind}`);
    const j = await res.json();
    if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
    const items = (j.items ?? []) as unknown[];
    if (items.length === 0) break;
    if (run.kind === "profile") {
      const r = attachProfiles(items as MappedProfile[], "apify");
      report.returned += r.returned; report.attached += r.attached; report.unmatched += r.unmatched; report.empty += r.empty;
    } else {
      report.companies += attachCompanies(items as MappedCompany[]);
      report.returned += items.length;
    }
    offset = j.nextOffset;
  }
  if (report.attached > 0) startScoring({ tab: "connections", pass: "post" });
  return report;
}

/** Import an enrichment JSON export (raw actor items or mapped records). */
export function importEnrichmentJson(text: string): { attached: number; kind: string } {
  const parsed = JSON.parse(text);
  const arr: unknown[] = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.items) ? parsed.items : [parsed];
  const recs = arr.filter((x) => x && typeof x === "object") as Record<string, unknown>[];
  if (recs.length === 0) return { attached: 0, kind: "empty" };
  // Already-mapped app records carry rowId.
  if (recs.every((r) => typeof r.rowId === "string")) {
    useApp.getState().setEnrichment(recs as unknown as Enrichment[]);
    return { attached: recs.length, kind: "mapped" };
  }
  if (recs.some((r) => "employeeCount" in r || "universalName" in r)) {
    // Company items
    return { attached: attachCompanies(recs.map(mapCompanyItem)), kind: "company" };
  }
  const r = attachProfiles(recs.map(mapProfileItem), "import");
  if (r.attached > 0) startScoring({ tab: "connections", pass: "post" });
  return { attached: r.attached, kind: `profile (${r.unmatched} unmatched, ${r.empty} empty)` };
}
