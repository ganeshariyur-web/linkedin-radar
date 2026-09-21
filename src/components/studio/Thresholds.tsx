"use client";
import type { Thresholds } from "@/lib/types";
import { Label, fmtInt } from "../ui";

const SLIDERS: { key: keyof Thresholds; label: string; hint: string }[] = [
  { key: "t1RoleConfidence", label: "Tier 1: target-role confidence ≥", hint: "Also the upper bound of the Tier 2 band." },
  { key: "t1DisqualifiedMax", label: "Tier 1: disqualified probability <", hint: "" },
  { key: "t1BigBrandMax", label: "Tier 1: big public brand probability <", hint: "" },
  { key: "t2RoleConfidenceMin", label: "Tier 2: target-role confidence ≥", hint: "Band runs up to the Tier 1 threshold." },
  { key: "t2PrivateFamilyMin", label: "Tier 2: private/family probability ≥ (any executive role)", hint: "" },
  { key: "rejectedDisqualifiedMin", label: "Rejected: disqualified probability ≥", hint: "Empty-position rows are exempt and land in Tier 2." },
  { key: "invIgnoreMin", label: "Invitations Ignore: spam or sales probability ≥", hint: "" },
  { key: "geographyMin", label: "Ranking: in-geography probability ≥ counts as ICP geography", hint: "" },
];

const SENIOR = ["c_level_or_owner", "director_or_vp", "manager_or_ic", "student_or_junior", "not_stated"];

export function ThresholdSliders({ th, onChange, tierCounts, bucketCounts, jevCalls }: {
  th: Thresholds;
  onChange: (t: Thresholds) => void;
  tierCounts: Record<string, number>;
  bucketCounts: Record<string, number>;
  jevCalls: number;
}) {
  return (
    <div data-testid="thresholds">
      <div className="flex items-center justify-between">
        <Label>Tier thresholds</Label>
        <span className="label">Recomputed locally from stored probabilities · no Jev calls (session calls: {jevCalls})</span>
      </div>
      <div className="grid md:grid-cols-2 gap-x-8 gap-y-4 mt-3">
        {SLIDERS.map((s) => (
          <div key={s.key}>
            <div className="flex justify-between text-xs"><span>{s.label}</span><span className="font-mono" data-testid={`th-${s.key}`}>{(th[s.key] as number).toFixed(2)}</span></div>
            <input type="range" min={0} max={1} step={0.01} value={th[s.key] as number} onChange={(e) => onChange({ ...th, [s.key]: Number(e.target.value) })} aria-label={s.label} data-testid={`slider-${s.key}`} className="mt-1" />
            {s.hint && <div className="text-[10px] text-muted mt-0.5">{s.hint}</div>}
          </div>
        ))}
      </div>
      <div className="mt-4">
        <Label>Senior buckets (Invitations Accept)</Label>
        <div className="flex flex-wrap gap-3 mt-1">
          {SENIOR.map((b) => (
            <label key={b} className="text-xs flex items-center gap-1">
              <input type="checkbox" checked={th.seniorBuckets.includes(b)} onChange={(e) => onChange({ ...th, seniorBuckets: e.target.checked ? [...th.seniorBuckets, b] : th.seniorBuckets.filter((x) => x !== b) })} />
              <span className="font-mono">{b}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 text-xs" data-testid="live-counts">
        {["tier1", "tier2", "tier3", "rejected"].map((k) => (
          <div key={k} className="border border-line p-2"><Label>{k}</Label><div className="font-mono text-lg mt-1" data-testid={`live-${k}`}>{fmtInt(tierCounts[k] ?? 0)}</div></div>
        ))}
        {["accept", "review", "ignore", "no_signal"].map((k) => (
          <div key={k} className="border border-line p-2"><Label>{k}</Label><div className="font-mono text-lg mt-1" data-testid={`live-${k}`}>{fmtInt(bucketCounts[k] ?? 0)}</div></div>
        ))}
      </div>
    </div>
  );
}
