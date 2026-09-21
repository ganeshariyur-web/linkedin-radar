"use client";
import { useApp } from "@/lib/store";
import type { ScoredRow } from "@/lib/derive";

export function AvatarGrid({ rows }: { rows: ScoredRow[] }) {
  const selected = useApp((s) => s.selectedRowId);
  const setSelected = useApp((s) => s.setSelected);
  const current = useApp((s) => s.run.currentRowId);
  const running = useApp((s) => s.run.status === "running");
  return (
    <div className="grid gap-[3px]" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(26px, 1fr))" }} data-testid="avatar-grid">
      {rows.map((r) => {
        const cls = r.kind === "connection" ? r.tier : r.bucket;
        const photo = r.enrichment?.photo;
        const isCurrent = running && current === r.id;
        return (
          <button
            key={r.id}
            type="button"
            className={`tile ${cls} ${selected === r.id ? "selected" : ""} ${isCurrent ? "scoring" : ""}`}
            data-tier={cls}
            data-row-id={r.id}
            title={`${r.name}${r.kind === "connection" ? ` · ${r.row.position || "(no position)"} · ${r.row.company || "(no company)"}` : ""}`}
            onClick={() => setSelected(selected === r.id ? null : r.id)}
          >
            {photo ? <img src={photo} alt="" loading="lazy" referrerPolicy="no-referrer" /> : r.initials}
          </button>
        );
      })}
    </div>
  );
}
