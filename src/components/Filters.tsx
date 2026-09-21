"use client";
import { countBy, labelFor, type Filters as F, type ScoredRow } from "@/lib/derive";
import { companySizeBand } from "@/lib/tiers";
import type { Tab } from "@/lib/types";
import { Label, Pill } from "./ui";

function Multi({ title, values, selected, onChange, tab }: { title: string; values: string[]; selected: string[]; onChange: (v: string[]) => void; tab?: Tab }) {
  if (values.length === 0) return null;
  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  return (
    <div>
      <Label>{title}</Label>
      <div className="flex flex-wrap gap-1 mt-1">
        {values.map((v) => (
          <Pill key={v} active={selected.includes(v)} onClick={() => toggle(v)}>{tab ? labelFor(tab, v) : v}</Pill>
        ))}
      </div>
    </div>
  );
}

function Tri({ title, value, onChange }: { title: string; value: "any" | "yes" | "no"; onChange: (v: "any" | "yes" | "no") => void }) {
  return (
    <div>
      <Label>{title}</Label>
      <div className="flex gap-1 mt-1">
        {(["any", "yes", "no"] as const).map((v) => <Pill key={v} active={value === v} onClick={() => onChange(v)}>{v}</Pill>)}
      </div>
    </div>
  );
}

export function Filters({ tab, rows, filters, onChange }: { tab: Tab; rows: ScoredRow[]; filters: F; onChange: (f: F) => void }) {
  const set = <K extends keyof F>(k: K, v: F[K]) => onChange({ ...filters, [k]: v });
  const tiers = tab === "connections" ? ["tier1", "tier2", "tier3", "rejected", "unscored"] : ["accept", "review", "no_signal", "ignore", "outgoing", "unscored"];
  const present = new Set(rows.map((r) => (r.kind === "connection" ? r.tier : r.bucket)));
  const roles = countBy(rows.filter((r) => r.pre?.answers.role), (r) => r.pre!.answers.role.answer).map((d) => d.label);
  const types = countBy(rows.filter((r) => r.pre?.answers.company_type), (r) => r.pre!.answers.company_type.answer).map((d) => d.label);
  const countries = countBy(rows.filter((r) => r.enrichment), (r) => r.enrichment?.country ?? "unknown").map((d) => d.label);
  const bands = countBy(rows.filter((r) => r.enrichment), (r) => companySizeBand(r.enrichment)).map((d) => d.label);
  const activity = countBy(rows.filter((r) => r.post?.answers.active_on_linkedin), (r) => r.post!.answers.active_on_linkedin.answer).map((d) => d.label);
  const active = filters.tier.length + filters.role.length + filters.companyType.length + filters.country.length + filters.sizeBand.length + filters.activity.length + filters.connectedFor.length + (filters.hasEmail !== "any" ? 1 : 0) + (filters.privateFamily !== "any" ? 1 : 0) + (filters.watchlist !== "any" ? 1 : 0) + (filters.text ? 1 : 0);
  return (
    <div className="space-y-3" data-testid="filters">
      <div className="flex items-center gap-3">
        <input className="input !w-80" placeholder="Search name, position, company, message" value={filters.text} onChange={(e) => set("text", e.target.value)} data-testid="filter-text" />
        {active > 0 && <button className="btn ghost" onClick={() => onChange({ ...filters, tier: [], role: [], companyType: [], country: [], sizeBand: [], activity: [], connectedFor: [], hasEmail: "any", privateFamily: "any", watchlist: "any", text: "" })}>Clear {active}</button>}
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Multi title={tab === "connections" ? "Tier" : "Bucket"} values={tiers.filter((t) => present.has(t as never) || filters.tier.includes(t))} selected={filters.tier} onChange={(v) => set("tier", v)} tab={tab} />
        {tab === "connections" && <Multi title="Role" values={roles} selected={filters.role} onChange={(v) => set("role", v)} />}
        {tab === "connections" && <Multi title="Company type" values={types} selected={filters.companyType} onChange={(v) => set("companyType", v)} />}
        {tab === "connections" && <Multi title="Connected for" values={["under 1 year", "1–3 years", "3+ years"]} selected={filters.connectedFor} onChange={(v) => set("connectedFor", v)} />}
        {tab === "connections" && <Tri title="Has email" value={filters.hasEmail} onChange={(v) => set("hasEmail", v)} />}
        {tab === "connections" && <Tri title="Private / family flag" value={filters.privateFamily} onChange={(v) => set("privateFamily", v)} />}
        {tab === "connections" && rows.some((r) => r.kind === "connection" && r.watchlisted) && <Tri title="On company watchlist" value={filters.watchlist} onChange={(v) => set("watchlist", v)} />}
        <Multi title="Country" values={countries} selected={filters.country} onChange={(v) => set("country", v)} />
        <Multi title="Company size" values={bands} selected={filters.sizeBand} onChange={(v) => set("sizeBand", v)} />
        <Multi title="Activity" values={activity} selected={filters.activity} onChange={(v) => set("activity", v)} />
      </div>
    </div>
  );
}
