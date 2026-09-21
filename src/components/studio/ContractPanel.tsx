"use client";
import { CODE_OWNED, CONTRACT, FORBIDDEN_PRE_ENRICHMENT } from "@/lib/contract";
import { Label } from "../ui";

export function ContractPanel({ available }: { available: Record<string, boolean> }) {
  return (
    <aside className="card p-5 text-xs" data-testid="contract">
      <Label>Field contract · what Jev may read</Label>
      {(["connections", "invitations"] as const).map((tab) => (
        <div key={tab} className="mt-3">
          <div className="font-medium capitalize">{tab} · before enrichment</div>
          <ul className="mt-1 space-y-1">
            {CONTRACT[tab].pre.map((f) => (
              <li key={f.name} className={available[`${tab}:${f.name}`] ? "" : "text-muted"}>
                <span className="font-mono">{f.name}</span> <span className="text-muted">← {f.source}{f.presence === "when present" ? " · only when present" : ""}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="mt-3">
        <div className="font-medium">After enrichment (both tabs)</div>
        <ul className="mt-1 space-y-1">
          {CONTRACT.connections.post.map((f) => (
            <li key={f.name} className={available[`post:${f.name}`] ? "" : "text-muted"}><span className="font-mono">{f.name}</span> <span className="text-muted">← {f.source}</span></li>
          ))}
        </ul>
      </div>
      <div className="mt-3">
        <div className="font-medium">Computed in code, never asked of Jev</div>
        <ul className="mt-1 text-muted list-disc pl-4">{CODE_OWNED.map((c) => <li key={c}>{c}</li>)}</ul>
      </div>
      <div className="mt-3">
        <div className="font-medium">Forbidden before enrichment</div>
        <p className="mt-1 text-muted font-mono leading-relaxed">{FORBIDDEN_PRE_ENRICHMENT.join(", ")}</p>
      </div>
    </aside>
  );
}
