"use client";
import { useApp } from "@/lib/store";
import type { ScoredRow } from "@/lib/derive";
import { TIER_LABEL, BUCKET_LABEL } from "@/lib/tiers";
import { pct } from "./ui";

export function TableView({ rows }: { rows: ScoredRow[] }) {
  const flags = useApp((s) => s.flags);
  const setFlag = useApp((s) => s.setFlag);
  const setSelected = useApp((s) => s.setSelected);
  const isConn = rows.length > 0 && rows[0].kind === "connection";
  return (
    <div className="overflow-x-auto" data-testid="table">
      <table className="data">
        <thead>
          <tr>
            <th>Name</th>
            {isConn ? (<><th>Position</th><th>Company</th><th>Tier</th><th>Role</th><th>Conf.</th><th>Type</th><th>Private</th><th>Connected</th><th>Email</th></>) : (<><th>Direction</th><th>Bucket</th><th>Intent</th><th>Seniority</th><th>Age</th><th>Match</th><th>Message</th></>)}
            <th>Country</th>
            <th>DM sent</th>
            <th>Accepted</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 500).map((r) => {
            const f = flags[r.id] ?? { dmSent: false, accepted: false };
            const url = r.kind === "connection" ? r.row.url : r.row.profileUrl;
            return (
              <tr key={r.id} data-row-id={r.id} data-tier={r.kind === "connection" ? r.tier : r.bucket}>
                <td>
                  <button className="text-left hover:text-accent" onClick={() => setSelected(r.id)}>{r.name}</button>
                  {url && <a href={url} target="_blank" rel="noreferrer noopener" className="ml-1 text-muted hover:text-fg" title="Open profile">↗</a>}
                </td>
                {r.kind === "connection" ? (
                  <>
                    <td className="max-w-[16rem] truncate" title={r.row.position}>{r.row.position || <em className="text-muted">empty</em>}</td>
                    <td className="max-w-[12rem] truncate" title={r.row.company}>{r.row.company || <em className="text-muted">empty</em>}</td>
                    <td className={r.tier === "tier1" ? "text-accent" : ""}>{TIER_LABEL[r.tier]}</td>
                    <td className="font-mono">{r.pre?.answers.role?.answer ?? "–"}</td>
                    <td className="font-mono">{pct(r.pre?.answers.role?.confidence)}</td>
                    <td className="font-mono">{r.pre?.answers.company_type?.answer ?? "–"}</td>
                    <td className="font-mono">{pct(r.pre?.answers.likely_private_or_family?.noul)}</td>
                    <td>{r.row.connectedFor ?? "–"}</td>
                    <td>{r.row.hasEmail ? "yes" : ""}</td>
                  </>
                ) : (
                  <>
                    <td>{r.row.direction}</td>
                    <td className={r.bucket === "accept" ? "text-accent" : ""}>{BUCKET_LABEL[r.bucket]}</td>
                    <td className="font-mono">{r.pre?.answers.message_intent?.answer ?? "–"}</td>
                    <td className="font-mono">{r.pre?.answers.self_described_seniority?.answer ?? "–"}</td>
                    <td>{r.row.invitationAge ?? "–"}</td>
                    <td>{r.row.match ?? "–"}</td>
                    <td className="max-w-[20rem] truncate" title={r.row.message}>{r.row.message}</td>
                  </>
                )}
                <td>{r.enrichment?.country ?? ""}</td>
                <td><input type="checkbox" checked={f.dmSent} onChange={(e) => setFlag(r.id, { dmSent: e.target.checked })} aria-label="DM sent" /></td>
                <td><input type="checkbox" checked={f.accepted} onChange={(e) => setFlag(r.id, { accepted: e.target.checked })} aria-label="Accepted" /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length > 500 && <p className="text-xs text-muted mt-2">Showing the first 500 of {rows.length}. Narrow the filters or download the CSV.</p>}
    </div>
  );
}
