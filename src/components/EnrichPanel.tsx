"use client";
import { useRef, useState } from "react";
import { PROFILE_ACTOR, COMPANY_ACTOR } from "@/config/apify";
import { abortEnrichment, enrichRows, estimateCompanyUsd, estimateProfileUsd, importEnrichmentJson, profileUrlsFor, type EnrichProgress } from "@/lib/enrich-client";
import { startRun } from "@/lib/runner";
import { useApp } from "@/lib/store";
import type { ScoredRow } from "@/lib/derive";
import type { Tab } from "@/lib/types";
import { Label, fmtInt } from "./ui";

export function EnrichPanel({ tab, visible, selectedIds, tier1Ids }: { tab: Tab; visible: ScoredRow[]; selectedIds: string[]; tier1Ids: string[] }) {
  const [progress, setProgress] = useState<EnrichProgress | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const enrichment = useApp((s) => s.enrichment);

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
    <div className="border border-line p-4" data-testid="enrich-panel">
      <div className="flex items-center justify-between">
        <Label>Enrichment · Apify</Label>
        <span className="label">{fmtInt(enrichedCount)} enriched</span>
      </div>
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
      {progress && <div className={`mt-3 text-xs ${progress.phase === "error" ? "text-accent" : ""}`} data-testid="enrich-progress">{progress.message}{progress.usdSpent ? ` · $${progress.usdSpent.toFixed(3)} spent` : ""}</div>}
      {importMsg && <div className="mt-2 text-xs">{importMsg}</div>}
    </div>
  );
}
