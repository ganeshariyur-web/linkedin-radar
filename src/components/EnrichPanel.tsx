"use client";
import { useRef, useState } from "react";
import { PROFILE_ACTOR, COMPANY_ACTOR } from "@/config/apify";
import { abortEnrichment, collectRun, enrichRows, estimateCompanyUsd, estimateProfileUsd, importEnrichmentJson, listRecentRuns, profileUrlsFor, type EnrichProgress, type RecentRun } from "@/lib/enrich-client";
import { startRun } from "@/lib/runner";
import { useApp } from "@/lib/store";
import type { ScoredRow } from "@/lib/derive";
import type { Tab } from "@/lib/types";
import { Bar, Label, SectionHead, fmtInt } from "./ui";
import { useEffect } from "react";

export function EnrichPanel({ tab, visible, selectedIds, tier1Ids }: { tab: Tab; visible: ScoredRow[]; selectedIds: string[]; tier1Ids: string[] }) {
  const [progress, setProgress] = useState<EnrichProgress | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentRun[] | null>(null);
  const [recentMsg, setRecentMsg] = useState<string | null>(null);
  const [collecting, setCollecting] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const enrichment = useApp((s) => s.enrichment);
  const hasRows = useApp((s) => !!s.connections || !!s.invitations);

  // Finished runs on the account whose results may not have been collected (e.g. the page was left mid-run).
  useEffect(() => {
    if (!hasRows) return;
    listRecentRuns().then(setRecent).catch(() => setRecent([]));
  }, [hasRows]);

  const collect = async (run: RecentRun) => {
    setCollecting(run.runId);
    try {
      const r = await collectRun(run);
      setRecentMsg(run.kind === "profile"
        ? `Collected ${r.attached} of ${r.returned} profiles from the run of ${new Date(run.startedAt).toLocaleString()}${r.empty ? ` · ${r.empty} empty` : ""}${r.unmatched ? ` · ${r.unmatched} unmatched` : ""}${r.attached ? " · post-enrichment questions are running" : ""}.`
        : `Attached company details from ${r.returned} companies.`);
    } catch (e) {
      setRecentMsg(`Could not collect: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setCollecting(null);
    }
  };

  const targetIds = selectedIds.length ? selectedIds : visible.map((r) => r.id);
  const targets = profileUrlsFor(targetIds).filter((t) => !enrichment[t.rowId]);
  const tier1Companies = tier1Ids.length;
  const estProfiles = estimateProfileUsd(targets.length);
  const estCompanies = estimateCompanyUsd(Math.min(tier1Companies, targets.length));
  const busy = progress && ["starting", "polling", "companies"].includes(progress.phase);
  const enrichedCount = Object.keys(enrichment).filter((k) => k.startsWith(tab === "connections" ? "c:" : "i:")).length;

  const go = async () => {
    setConfirm(false);
    await enrichRows(targets.map((t) => t.rowId), setProgress, tier1Ids);
  };

  const onImport = async (file: File) => {
    try {
      const r = importEnrichmentJson(await file.text());
      setImportMsg(`Imported ${r.attached} ${r.kind} record${r.attached === 1 ? "" : "s"}.`);
    } catch (e) {
      setImportMsg(`Import failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div className="card p-6" data-testid="enrich-panel">
      <SectionHead n="04" title="Enrichment · Apify" right={<span className="label">{fmtInt(enrichedCount)} enriched</span>} />
      <p className="text-xs text-muted mt-2 leading-relaxed">
        Sends only the selected profile URLs to <span className="font-mono">{PROFILE_ACTOR.slug}</span>. Company size and industry come from{" "}
        <span className="font-mono">{COMPANY_ACTOR.slug}</span> for distinct Tier 1 companies only.
      </p>
      <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
        <div><Label>Selected</Label><div className="font-mono mt-1">{fmtInt(targets.length)} profiles{selectedIds.length ? " (selection)" : " (visible, not yet enriched)"}</div></div>
        <div><Label>Estimated cost</Label><div className="font-mono mt-1">${(estProfiles + estCompanies).toFixed(3)} <span className="text-muted">(${estProfiles.toFixed(3)} profiles + up to ${estCompanies.toFixed(3)} companies)</span></div></div>
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        {!confirm ? (
          <button className="btn" disabled={!!busy || targets.length === 0} onClick={() => setConfirm(true)} data-testid="enrich-start">Enrich {fmtInt(targets.length)}</button>
        ) : (
          <>
            <span className="text-xs self-center">Start Apify runs for {fmtInt(targets.length)} profiles at about ${(estProfiles + estCompanies).toFixed(3)}?</span>
            <button className="btn accent" onClick={go} data-testid="enrich-confirm">Confirm</button>
            <button className="btn ghost" onClick={() => setConfirm(false)}>Cancel</button>
          </>
        )}
        {busy && <button className="btn ghost" onClick={abortEnrichment}>Stop</button>}
        {enrichedCount > 0 && (
          <button className="btn ghost" onClick={() => startRun({ tab, pass: "post" })} data-testid="run-post">Run post-enrichment questions</button>
        )}
        <button className="btn ghost" onClick={() => fileRef.current?.click()}>Import enrichment JSON</button>
        <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.currentTarget.value = ""; }} />
      </div>
      <div
        className="dropzone mt-3 p-3 text-xs text-muted text-center"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onImport(f); }}
      >
        Or drop an enrichment JSON file here (raw actor items or a previous export). Fallback when Apify is unavailable.
      </div>
      {progress && (
        <div className="mt-4" data-testid="enrich-progress">
          {busy && <Bar value={progress.total ? progress.received / progress.total : 0.05} accent className="mb-2" />}
          <div className={`text-xs ${progress.phase === "error" ? "text-accent" : progress.phase === "done" ? "text-fg" : "text-muted"}`}>
            {busy && <span className="label text-accent mr-2">● Working</span>}
            {progress.message}{progress.usdSpent ? ` · $${progress.usdSpent.toFixed(3)} spent` : ""}
          </div>
          {busy && <div className="text-[11px] text-muted mt-1">Apify runs take 10 to 60 seconds. Results attach only while this page stays open; if you leave, collect them below afterwards.</div>}
        </div>
      )}
      {importMsg && <div className="mt-2 text-xs">{importMsg}</div>}
      {recent && recent.length > 0 && (
        <div className="mt-5 rule pt-4" data-testid="recover-runs">
          <Label>Finished Apify runs on your account · collect without paying again</Label>
          <ul className="mt-2 space-y-1.5 text-xs">
            {recent.slice(0, 6).map((r) => (
              <li key={r.runId} className="flex flex-wrap items-center gap-3">
                <span className="num">{new Date(r.startedAt).toLocaleString()}</span>
                <span className="text-muted">{r.kind} · {fmtInt(r.itemCount ?? 0)} result{(r.itemCount ?? 0) === 1 ? "" : "s"}{r.usd ? ` · $${r.usd.toFixed(3)}` : ""}</span>
                <button className="btn ghost !py-1 !px-2" disabled={!!collecting} onClick={() => collect(r)} data-testid={`collect-${r.runId}`}>{collecting === r.runId ? "Collecting…" : "Collect"}</button>
              </li>
            ))}
          </ul>
          {recentMsg && <div className="mt-2 text-xs">{recentMsg}</div>}
        </div>
      )}
    </div>
  );
}
