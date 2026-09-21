"use client";
import { useActivePreset, useApp } from "@/lib/store";
import { CONTRACT, CODE_OWNED, FORBIDDEN_PRE_ENRICHMENT } from "@/lib/contract";
import { PROFILE_ACTOR, COMPANY_ACTOR, POSTS_ACTOR } from "@/config/apify";
import { JEV_USD_PER_MILLION_INPUT_TOKENS } from "@/lib/cost";
import { Label } from "@/components/ui";

export default function MethodsPage() {
  const hydrated = useApp((s) => s.hydrated);
  const p = useActivePreset();
  if (!hydrated) return <div className="mt-16 label">Loading…</div>;
  const th = p.thresholds;
  return (
    <div className="mt-8 max-w-4xl" data-testid="methods">
      <h1 className="headline text-4xl md:text-5xl">Methods</h1>
      <p className="text-sm text-muted mt-2">The active preset “{p.name}”, rendered verbatim. Jev (model <span className="font-mono">jev-latest</span>, TypeSafe) judges meaning from the contract fields only; code owns everything else.</p>

      <section className="mt-10">
        <Label>ICP config</Label>
        <dl className="mt-2 text-sm grid grid-cols-[10rem_1fr] gap-y-1">
          <dt className="text-muted">Company</dt><dd>{p.icp.company}</dd>
          <dt className="text-muted">Target roles</dt><dd>{p.icp.targetRoles.join("; ")}</dd>
          <dt className="text-muted">Geography</dt><dd>{p.icp.geography}</dd>
          <dt className="text-muted">Company profile</dt><dd>{p.icp.companyProfile}</dd>
          <dt className="text-muted">Disqualifiers</dt><dd>{p.icp.disqualifiers}</dd>
          <dt className="text-muted">Preferred industries</dt><dd>{p.icp.preferredIndustries.join(", ")}</dd>
          <dt className="text-muted">Revenue threshold</dt><dd>{p.icp.revenueThreshold}</dd>
          {p.icp.decisionAuthority && <><dt className="text-muted">Decision authority</dt><dd>{p.icp.decisionAuthority}</dd></>}
        </dl>
      </section>

      <section className="mt-10">
        <Label>Questions ({p.questions.filter((q) => q.enabled).length} enabled)</Label>
        <div className="mt-3 space-y-6">
          {p.questions.map((q) => (
            <article key={q.id} className={`text-sm ${q.enabled ? "" : "opacity-50"}`}>
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="font-mono">{q.id}</span>
                <span className="label">{q.type} · {q.tab} · {q.pass}-enrichment · reads {q.fields.join(", ")}{q.enabled ? "" : " · disabled"}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap">{q.instructions}</p>
              {q.type === "choice" && (
                <ul className="mt-2 pl-4 list-disc text-xs space-y-0.5">{q.options?.map((o) => <li key={o.key}><span className="font-mono">{o.key}</span>: {o.description}</li>)}</ul>
              )}
              {q.type === "score" && (
                <ol className="mt-2 pl-4 list-decimal text-xs space-y-0.5" start={0}>{q.levels?.map((l, i) => <li key={i}>{l}</li>)}</ol>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <Label>Tier rules · thresholds</Label>
        <ul className="mt-2 text-sm space-y-1">
          <li><b>Tier 1</b>: role in target roles with confidence ≥ {th.t1RoleConfidence}, disqualified &lt; {th.t1DisqualifiedMax}, is_big_public_brand &lt; {th.t1BigBrandMax}{th.t1BigBrandMin > 0 ? ` and ≥ ${th.t1BigBrandMin}` : ""}{th.watchlistTier1Only ? ", and the company is on the watchlist" : ""}.</li>
          <li><b>Tier 2</b>: target role with confidence {th.t2RoleConfidenceMin}–{th.t1RoleConfidence}, or role “unknown” with company_type in the preferred industries, or likely_private_or_family ≥ {th.t2PrivateFamilyMin} with any executive role. Rows with an empty Position always land here.</li>
          <li><b>Tier 3</b>: remainder, not disqualified.</li>
          <li><b>Rejected</b>: disqualified ≥ {th.rejectedDisqualifiedMin}.</li>
          <li><b>Invitations Accept</b>: message_intent in {th.acceptIntents.join(", ")} with self_described_seniority in {th.seniorBuckets.join(", ")}.</li>
          <li><b>Ignore</b>: {th.ignoreIntents.join(" or ")} ≥ {th.invIgnoreMin}. <b>Review</b>: remainder. <b>No signal</b>: message-less rows, never sent to Jev. <b>Outgoing</b>: matched against Connections in code.</li>
          <li><b>Final ranking after enrichment</b>: decision_maker × normalised revenue score, rows with in_geography ≥ {th.geographyMin} first.</li>
          <li><b>Cost</b>: input tokens × ${JEV_USD_PER_MILLION_INPUT_TOKENS} per million.</li>
        </ul>
      </section>

      {(p.watchlist?.length ?? 0) > 0 && (
        <section className="mt-10">
          <Label>Company watchlist · {p.watchlist!.length} names, matched in code</Label>
          <p className="mt-2 text-xs font-mono leading-relaxed">{p.watchlist!.slice(0, 60).join(" · ")}{p.watchlist!.length > 60 ? " · …" : ""}</p>
        </section>
      )}

      <section className="mt-10">
        <Label>Field contract</Label>
        {(["connections", "invitations"] as const).map((tab) => (
          <div key={tab} className="mt-3 text-sm">
            <div className="capitalize font-medium">{tab}, before enrichment</div>
            <ul className="mt-1 text-xs space-y-0.5">{CONTRACT[tab].pre.map((f) => <li key={f.name}><span className="font-mono">{f.name}</span> ← {f.source}. {f.description}{f.presence === "when present" ? " Passed only when present." : ""}</li>)}</ul>
          </div>
        ))}
        <div className="mt-3 text-sm">
          <div className="font-medium">After enrichment</div>
          <ul className="mt-1 text-xs space-y-0.5">{CONTRACT.connections.post.map((f) => <li key={f.name}><span className="font-mono">{f.name}</span> ← {f.source}. {f.description}</li>)}</ul>
        </div>
        <div className="mt-3 text-sm"><div className="font-medium">Computed in code, never asked of Jev</div><ul className="mt-1 text-xs list-disc pl-4">{CODE_OWNED.map((c) => <li key={c}>{c}</li>)}</ul></div>
        <div className="mt-3 text-sm"><div className="font-medium">Forbidden in any pre-enrichment question</div><p className="text-xs font-mono mt-1">{FORBIDDEN_PRE_ENRICHMENT.join(", ")}</p></div>
      </section>

      <section className="mt-10">
        <Label>Enrichment · Apify actors</Label>
        <ul className="mt-2 text-sm space-y-1">
          <li>Profiles: <span className="font-mono">{PROFILE_ACTOR.slug}</span> (id {PROFILE_ACTOR.actorId}) · ${PROFILE_ACTOR.usdPerItem} per profile · up to {PROFILE_ACTOR.maxItemsPerRun} URLs per run · no LinkedIn cookies.</li>
          <li>Companies: <span className="font-mono">{COMPANY_ACTOR.slug}</span> (id {COMPANY_ACTOR.actorId}) · ${COMPANY_ACTOR.usdPerItem} per company · run only for distinct Tier 1 companies whose profile returned a company URL without size.</li>
          <li>Posts / activity: {POSTS_ACTOR ? <span className="font-mono">{POSTS_ACTOR.slug}</span> : "not configured; active_on_linkedin resolves to “unknown”."}</li>
          <li>Only the selected profile URLs leave the browser. Nothing is stored server-side.</li>
        </ul>
      </section>
    </div>
  );
}
