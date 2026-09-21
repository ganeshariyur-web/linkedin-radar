"use client";
import { useEffect, useMemo, useState } from "react";
import { useActivePreset, useApp } from "@/lib/store";
import { applyFilters, bucketOrder, emptyFilters, tierOrder, useScoredConnections, useScoredInvitations, type Filters as F, type ScoredRow } from "@/lib/derive";
import { connectionsCsv, downloadText, invitationsCsv } from "@/lib/export";
import { TIER_LABEL, BUCKET_LABEL } from "@/lib/tiers";
import type { ConnectionTier, InvitationBucket, Tab } from "@/lib/types";
import { UploadSlots } from "@/components/UploadSlots";
import { TopBar } from "@/components/TopBar";
import { AvatarGrid } from "@/components/AvatarGrid";
import { VerifyingProfile } from "@/components/VerifyingProfile";
import { Distributions } from "@/components/Distributions";
import { Filters } from "@/components/Filters";
import { TableView } from "@/components/TableView";
import { EnrichPanel } from "@/components/EnrichPanel";
import { Label, Pill, fmtInt } from "@/components/ui";

export default function RadarPage() {
  const hydrated = useApp((s) => s.hydrated);
  const connections = useApp((s) => s.connections);
  const invitations = useApp((s) => s.invitations);
  const activeTab = useApp((s) => s.activeTab);
  const setActiveTab = useApp((s) => s.setActiveTab);
  const preset = useActivePreset();
  const scoredC = useScoredConnections();
  const scoredI = useScoredInvitations();
  const [view, setView] = useState<"grid" | "table">("grid");
  const [filters, setFilters] = useState<F>(emptyFilters);
  const [selectedForEnrich, setSelectedForEnrich] = useState<string[]>([]);
  // The upload screen stays open after the first file loads (so the parse stats can be read) until the user continues.
  const uploadsOnly = !connections && !invitations;
  const [stayOnUploads, setStayOnUploads] = useState(false);
  useEffect(() => {
    if (hydrated && uploadsOnly) setStayOnUploads(true);
  }, [hydrated, uploadsOnly]);

  const tab: Tab = activeTab === "invitations" && invitations ? "invitations" : connections ? "connections" : invitations ? "invitations" : "connections";
  const rows: ScoredRow[] = useMemo(() => {
    if (tab === "connections") return [...scoredC].sort((a, b) => tierOrder(a.tier) - tierOrder(b.tier) || (b.rank.geoFirst - a.rank.geoFirst) || (b.rank.score - a.rank.score));
    return [...scoredI].sort((a, b) => bucketOrder(a.bucket) - bucketOrder(b.bucket) || (b.row.sentAt ?? "").localeCompare(a.row.sentAt ?? ""));
  }, [tab, scoredC, scoredI]);
  const filtered = useMemo(() => applyFilters(rows, filters, preset.thresholds.t2PrivateFamilyMin), [rows, filters, preset.thresholds.t2PrivateFamilyMin]);
  const questions = preset.questions.filter((q) => q.tab === tab);
  const tier1 = scoredC.filter((r) => r.tier === "tier1");
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) { const k = r.kind === "connection" ? r.tier : r.bucket; m.set(k, (m.get(k) ?? 0) + 1); }
    return m;
  }, [rows]);

  if (!hydrated) return <div className="mt-16 label">Loading…</div>;
  if (uploadsOnly || stayOnUploads) return <UploadSlots onContinue={() => setStayOnUploads(false)} />;

  const download = (key?: string) => {
    const subset = key ? rows.filter((r) => (r.kind === "connection" ? r.tier : r.bucket) === key) : filtered;
    const name = `linkedin-radar-${tab}-${key ?? "filtered"}-${new Date().toISOString().slice(0, 10)}.csv`;
    if (tab === "connections") downloadText(name, connectionsCsv(subset.filter((r) => r.kind === "connection").map((r) => (r.kind === "connection" ? { row: r.row, tier: r.tier, pre: r.pre, post: r.post, enrichment: r.enrichment } : null)).filter(Boolean) as never));
    else downloadText(name, invitationsCsv(subset.filter((r) => r.kind === "invitation").map((r) => (r.kind === "invitation" ? { row: r.row, bucket: r.bucket, pre: r.pre } : null)).filter(Boolean) as never));
  };

  const tierKeys = tab === "connections" ? (["tier1", "tier2", "tier3", "rejected"] as ConnectionTier[]) : (["accept", "review", "no_signal", "ignore", "outgoing"] as InvitationBucket[]);

  return (
    <div>
      <TopBar tab={tab} tier1Count={tier1.length} rowsRead={(connections?.rows.length ?? 0) + (invitations?.rows.length ?? 0)} questionCount={questions.filter((q) => q.enabled && q.pass === "pre").length} onOpenUploads={() => setStayOnUploads(true)} />

      <div className="flex flex-wrap items-center justify-between gap-3 mt-5">
        <div className="flex items-center gap-1" role="tablist">
          <button role="tab" aria-selected={tab === "connections"} disabled={!connections} className={`btn ${tab === "connections" ? "primary" : "ghost"}`} onClick={() => setActiveTab("connections")} data-testid="tab-connections">
            Connections {connections ? `· ${fmtInt(connections.rows.length)}` : "· not loaded"}
          </button>
          <button role="tab" aria-selected={tab === "invitations"} disabled={!invitations} className={`btn ${tab === "invitations" ? "primary" : "ghost"}`} onClick={() => setActiveTab("invitations")} data-testid="tab-invitations">
            Invitations {invitations ? `· ${fmtInt(invitations.rows.length)}` : "· not loaded"}
          </button>
        </div>
        <div className="flex items-center gap-1">
          <Pill active={view === "grid"} onClick={() => setView("grid")}>Grid</Pill>
          <Pill active={view === "table"} onClick={() => setView("table")}>Table</Pill>
          <span className="mx-2 text-line">|</span>
          <button className="btn ghost" onClick={() => download()} data-testid="download-filtered">Download {fmtInt(filtered.length)} rows</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 mt-4 text-xs" data-testid="tier-counts">
        {tierKeys.map((k) => (
          <button key={k} className="flex items-center gap-2 hover:text-accent" onClick={() => download(k)} title={`Download ${k} as CSV`} data-testid={`count-${k}`}>
            <span className={`inline-block w-2.5 h-2.5 tile ${k}`} />
            <span>{tab === "connections" ? TIER_LABEL[k as ConnectionTier] : BUCKET_LABEL[k as InvitationBucket]}</span>
            <span className="font-mono" data-count={counts.get(k) ?? 0}>{fmtInt(counts.get(k) ?? 0)}</span>
            <span className="label">csv ↓</span>
          </button>
        ))}
        {tab === "invitations" && connections && (
          <span className="text-muted">Outgoing accepted {fmtInt(scoredI.filter((r) => r.row.direction === "OUTGOING" && r.row.match === "accepted").length)} · pending {fmtInt(scoredI.filter((r) => r.row.direction === "OUTGOING" && r.row.match === "pending").length)}</span>
        )}
        {tab === "invitations" && !connections && <span className="text-muted">Load Connections.csv to see accepted / pending matching.</span>}
      </div>

      <div className="mt-5"><Filters tab={tab} rows={rows} filters={filters} onChange={setFilters} /></div>

      <div className="grid lg:grid-cols-12 gap-8 mt-6">
        <div className="lg:col-span-7">
          <div className="flex items-center justify-between mb-2">
            <Label>{fmtInt(filtered.length)} of {fmtInt(rows.length)} people</Label>
            {tab === "invitations" && (
              <button className="btn ghost" onClick={() => setSelectedForEnrich(filtered.filter((r) => r.kind === "invitation" && r.bucket === "no_signal").map((r) => r.id))}>
                Select “No signal” rows for enrichment
              </button>
            )}
          </div>
          {view === "grid" ? <AvatarGrid rows={filtered} /> : <TableView rows={filtered} />}
          <div className="mt-6">
            <EnrichPanel tab={tab} visible={filtered} selectedIds={selectedForEnrich} tier1Ids={tier1.map((r) => r.id)} />
            {selectedForEnrich.length > 0 && (
              <p className="text-xs text-muted mt-2">{fmtInt(selectedForEnrich.length)} rows selected for enrichment. <button className="underline" onClick={() => setSelectedForEnrich([])}>Clear</button></p>
            )}
          </div>
        </div>
        <div className="lg:col-span-5 space-y-8">
          <VerifyingProfile rows={rows} questions={questions} />
          <div className="hr" />
          <Distributions rows={rows} />
        </div>
      </div>
    </div>
  );
}
