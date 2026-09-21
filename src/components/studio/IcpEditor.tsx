"use client";
import type { IcpConfig } from "@/lib/types";
import { Label } from "../ui";

export function IcpEditor({ icp, onChange, onRebuild }: { icp: IcpConfig; onChange: (i: IcpConfig) => void; onRebuild: () => void }) {
  const set = <K extends keyof IcpConfig>(k: K, v: IcpConfig[K]) => onChange({ ...icp, [k]: v });
  const list = (s: string) => s.split(/[;\n]|,(?![^(]*\))/).map((x) => x.trim()).filter(Boolean);
  return (
    <div data-testid="icp-editor">
      <div className="flex items-center justify-between">
        <Label>ICP config · the default preset is derived from this block</Label>
        <button className="btn ghost" onClick={onRebuild} title="Rebuild the default questions from this ICP (replaces question edits)">Rebuild default questions from ICP</button>
      </div>
      <div className="grid md:grid-cols-2 gap-3 mt-3 text-xs">
        <Field label="Company (yours, and what it sells)"><input className="input" value={icp.company} onChange={(e) => set("company", e.target.value)} /></Field>
        <Field label="Target roles (one per line or separated by semicolons)"><textarea className="input" value={icp.targetRoles.join("\n")} onChange={(e) => set("targetRoles", list(e.target.value))} /></Field>
        <Field label="Geography"><input className="input" value={icp.geography} onChange={(e) => set("geography", e.target.value)} /></Field>
        <Field label="Primary country (used by in_geography)"><input className="input" value={icp.primaryCountry} onChange={(e) => set("primaryCountry", e.target.value)} /></Field>
        <Field label="Company profile"><textarea className="input" value={icp.companyProfile} onChange={(e) => set("companyProfile", e.target.value)} /></Field>
        <Field label="Preferred industries (comma separated; become company_type options)"><input className="input" value={icp.preferredIndustries.join(", ")} onChange={(e) => set("preferredIndustries", list(e.target.value))} /></Field>
        <Field label="Revenue threshold (used by revenue_over_threshold)"><input className="input" value={icp.revenueThreshold} onChange={(e) => set("revenueThreshold", e.target.value)} /></Field>
        <Field label="Disqualifiers"><textarea className="input" value={icp.disqualifiers} onChange={(e) => set("disqualifiers", e.target.value)} /></Field>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="label">{label}</span><div className="mt-1">{children}</div></label>;
}
