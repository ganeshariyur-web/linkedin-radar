"use client";
import { countBy, type ScoredRow } from "@/lib/derive";
import { companySizeBand } from "@/lib/tiers";
import { Bar, Label, fmtInt } from "./ui";

function Dist({ title, data, accent = false }: { title: string; data: { label: string; count: number }[]; accent?: boolean }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  if (!data.length) return null;
  return (
    <div className="mt-5" data-testid={`dist-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`}>
      <Label>{title}</Label>
      <ul className="mt-2 space-y-1.5">
        {data.slice(0, 12).map((d) => (
          <li key={d.label} className="text-xs">
            <div className="flex justify-between gap-2"><span className="truncate">{d.label}</span><span className="font-mono text-muted">{fmtInt(d.count)}</span></div>
            <Bar value={d.count / max} accent={accent} className="mt-0.5" />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Distributions({ rows }: { rows: ScoredRow[] }) {
  const scored = rows.filter((r) => r.pre);
  const enriched = rows.filter((r) => r.enrichment);
  const isConnections = rows.length > 0 && rows[0].kind === "connection";
  const order = ["under 1 year", "1–3 years", "3+ years", "unknown"];
  const cf = isConnections
    ? countBy(rows.filter((r) => r.kind === "connection"), (r) => (r.kind === "connection" ? r.row.connectedFor ?? "unknown" : "")).sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label))
    : [];
  return (
    <div>
      <Label>Live distributions</Label>
      {isConnections ? (
        <>
          <Dist title="Role mix" data={countBy(scored, (r) => r.pre?.answers.role?.answer ?? "–")} accent />
          <Dist title="Company type mix" data={countBy(scored, (r) => r.pre?.answers.company_type?.answer ?? "–")} />
          <Dist title="Connected for" data={cf} />
        </>
      ) : (
        <>
          <Dist title="Message intent" data={countBy(scored, (r) => r.pre?.answers.message_intent?.answer ?? "–")} accent />
          <Dist title="Self-described seniority" data={countBy(scored, (r) => r.pre?.answers.self_described_seniority?.answer ?? "–")} />
          <Dist title="Invitation age" data={countBy(rows.filter((r) => r.kind === "invitation"), (r) => (r.kind === "invitation" ? r.row.invitationAge ?? "unknown" : ""))} />
        </>
      )}
      {enriched.length > 0 && (
        <>
          <Dist title="Country" data={countBy(enriched, (r) => r.enrichment?.country ?? "unknown")} />
          <Dist title="Company size" data={countBy(enriched, (r) => companySizeBand(r.enrichment))} />
          <Dist title="Activity" data={countBy(enriched, (r) => r.post?.answers.active_on_linkedin?.answer ?? "unknown")} />
        </>
      )}
      {scored.length === 0 && <p className="mt-2 text-xs text-muted">Distributions fill in as rows are scored.</p>}
    </div>
  );
}
