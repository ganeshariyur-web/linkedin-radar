"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useActivePreset, useApp, resultKey } from "@/lib/store";
import { buildDefaultQuestions, hasErrors, validateQuestions, type ValidationIssue } from "@/lib/questions";
import { CONTRACT } from "@/lib/contract";
import { BUILTIN_PRESET_NAMES, isPreset, normalizePreset } from "@/lib/presets";
import { connectionTier, invitationBucket } from "@/lib/tiers";
import { buildWatchlist, parseWatchlistText } from "@/lib/watchlist";
import { estimateRun } from "@/lib/cost";
import { downloadText } from "@/lib/export";
import { allRowsFor, startRun } from "@/lib/runner";
import type { Pass, Preset, QuestionSpec, Tab, RowResult } from "@/lib/types";
import { QuestionCard, type FieldOption } from "@/components/studio/QuestionCard";
import { ThresholdSliders } from "@/components/studio/Thresholds";
import { IcpEditor } from "@/components/studio/IcpEditor";
import { ContractPanel } from "@/components/studio/ContractPanel";
import { Label, fmtInt, pct } from "@/components/ui";

export default function StudioPage() {
  const hydrated = useApp((s) => s.hydrated);
  const presets = useApp((s) => s.presets);
  const active = useActivePreset();
  const savePreset = useApp((s) => s.savePreset);
  const setActivePreset = useApp((s) => s.setActivePreset);
  const deletePreset = useApp((s) => s.deletePreset);
  const resetDefaults = useApp((s) => s.resetDefaults);
  const clearResults = useApp((s) => s.clearResults);
  const connections = useApp((s) => s.connections);
  const invitations = useApp((s) => s.invitations);
  const enrichment = useApp((s) => s.enrichment);
  const results = useApp((s) => s.results);
  const jevCalls = useApp((s) => s.jevCalls);

  const [draft, setDraft] = useState<Preset | null>(null);
  const [saveAs, setSaveAs] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load the active preset into the draft whenever it changes identity.
  useEffect(() => {
    if (!hydrated) return;
    setDraft(JSON.parse(JSON.stringify(active)));
  }, [hydrated, active.name, active.createdAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to a question when arriving via /studio#id
  useEffect(() => {
    if (!draft || typeof window === "undefined" || !window.location.hash) return;
    const el = document.getElementById(window.location.hash.slice(1));
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [draft]);

  const hasEnrichment = Object.keys(enrichment).length > 0;
  const availableMap: Record<string, boolean> = useMemo(() => {
    const m: Record<string, boolean> = {};
    const cCols = new Set((connections?.stats.columns ?? []).map((c) => c.toLowerCase()));
    const iCols = new Set((invitations?.stats.columns ?? []).map((c) => c.toLowerCase()));
    for (const f of CONTRACT.connections.pre) m[`connections:${f.name}`] = !!connections && sourceColumnsPresent(f.source, cCols);
    for (const f of CONTRACT.invitations.pre) m[`invitations:${f.name}`] = !!invitations && sourceColumnsPresent(f.source, iCols);
    for (const f of CONTRACT.connections.post) m[`post:${f.name}`] = hasEnrichment;
    return m;
  }, [connections, invitations, hasEnrichment]);

  const fieldOptionsFor = (q: QuestionSpec): FieldOption[] => {
    const list = CONTRACT[q.tab][q.pass];
    return list
      .map((f) => ({ name: f.name, source: f.source, available: q.pass === "pre" ? !!availableMap[`${q.tab}:${f.name}`] : hasEnrichment }))
      // Pre-enrichment checkboxes are built from the uploaded file's actual columns only.
      .filter((f) => (q.pass === "pre" ? (q.tab === "connections" ? !!connections : !!invitations) : true));
  };

  const issues: Record<string, ValidationIssue[]> = useMemo(() => {
    if (!draft) return {};
    const out: Record<string, ValidationIssue[]> = {};
    for (const q of draft.questions) {
      const avail = q.pass === "pre" ? Object.entries(availableMap).filter(([k, v]) => v && k.startsWith(q.tab + ":")).map(([k]) => k.split(":")[1]) : hasEnrichment ? CONTRACT.connections.post.map((f) => f.name) : [];
      out[q.id] = validateQuestions([q], avail)[q.id] ?? [];
    }
    // duplicate ids across the whole draft
    const ids = draft.questions.map((q) => q.id);
    for (const q of draft.questions) if (ids.filter((x) => x === q.id).length > 1) out[q.id] = [...(out[q.id] ?? []), { level: "error", field: "id", message: "ID must be unique." }];
    return out;
  }, [draft, availableMap, hasEnrichment]);
  const anyErrors = Object.values(issues).some(hasErrors);

  // Live tier counts from the draft thresholds and stored probabilities. No Jev calls.
  const tierCounts = useMemo(() => {
    const m: Record<string, number> = {};
    if (!draft) return m;
    const wl = buildWatchlist(draft.watchlist);
    for (const row of connections?.rows ?? []) {
      const t = connectionTier(row, results[resultKey(row.id, "pre")], draft.thresholds, draft.icp, wl.size ? !!wl.match(row.company) : false);
      m[t] = (m[t] ?? 0) + 1;
    }
    return m;
  }, [draft, connections, results]);
  const watchlistHits = useMemo(() => {
    if (!draft?.watchlist?.length) return 0;
    const wl = buildWatchlist(draft.watchlist);
    return (connections?.rows ?? []).filter((r) => wl.match(r.company)).length;
  }, [draft, connections]);
  const bucketCounts = useMemo(() => {
    const m: Record<string, number> = {};
    if (!draft) return m;
    for (const row of invitations?.rows ?? []) {
      const b = invitationBucket(row, results[resultKey(row.id, "pre")], draft.thresholds);
      m[b] = (m[b] ?? 0) + 1;
    }
    return m;
  }, [draft, invitations, results]);

  if (!hydrated || !draft) return <div className="mt-16 label">Loading…</div>;

  const updateQ = (i: number, q: QuestionSpec) => setDraft({ ...draft, questions: draft.questions.map((x, j) => (j === i ? q : x)) });
  const moveQ = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= draft.questions.length) return;
    const qs = [...draft.questions];
    [qs[i], qs[j]] = [qs[j], qs[i]];
    setDraft({ ...draft, questions: qs });
  };
  const addQ = (tab: Tab, pass: Pass) => setDraft({
    ...draft,
    questions: [...draft.questions, { id: `new_question_${draft.questions.length + 1}`, type: "noul", tab, pass, enabled: true, instructions: "", fields: [] }],
  });

  const applyThresholds = (t: Preset["thresholds"]) => {
    const next = { ...draft, thresholds: t };
    setDraft(next);
    // Thresholds cost nothing to apply: persist immediately to the active preset.
    savePreset({ ...active, thresholds: t });
  };

  const save = () => {
    if (anyErrors) return setStatus("Fix the errors above before saving.");
    savePreset({ ...draft, createdAt: new Date().toISOString() });
    setStatus(`Saved “${draft.name}”. Rows scored with the previous questions are now pending on the Radar page.`);
  };
  const saveAsNew = () => {
    const name = saveAs.trim();
    if (!name) return;
    if (anyErrors) return setStatus("Fix the errors above before saving.");
    savePreset({ ...draft, name, createdAt: new Date().toISOString() });
    setSaveAs("");
    setStatus(`Saved as “${name}” and made active.`);
  };
  const download = () => downloadText(`linkedin-radar-preset-${draft.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.json`, JSON.stringify(draft, null, 2), "application/json");
  const upload = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text());
      if (!isPreset(parsed)) throw new Error("Not a LinkedIn Radar preset file.");
      const p = normalizePreset(parsed);
      savePreset({ ...p, createdAt: new Date().toISOString() });
      setStatus(`Loaded preset “${p.name}”.`);
    } catch (e) {
      setStatus(`Upload failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  const rebuild = () => setDraft({ ...draft, questions: buildDefaultQuestions(draft.icp) });

  const groups: { title: string; tab: Tab; pass: Pass }[] = [
    { title: "Connections · one request per row · state = {position, company, connected_for, name_suffixes?}", tab: "connections", pass: "pre" },
    { title: "Invitations · rows with a message only · state = {name, message, invitation_age}", tab: "invitations", pass: "pre" },
    { title: "Post-enrichment · second pass · state = enriched fields", tab: "connections", pass: "post" },
  ];

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="headline text-[40px] md:text-[56px]">Classifier <em>Studio</em></h1>
          <p className="text-sm text-muted mt-2 max-w-2xl">Every question Jev is asked, editable. Code owns counting, dates, matching and tiers; Jev judges meaning from the contract fields only.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2" data-testid="preset-bar">
          <select className="input !w-56" value={active.name} onChange={(e) => setActivePreset(e.target.value)} aria-label="Preset">
            {presets.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
          </select>
          <button className="btn primary" onClick={save} disabled={anyErrors} data-testid="save-preset">Save changes</button>
          <input className="input !w-44" placeholder="Save as new preset…" value={saveAs} onChange={(e) => setSaveAs(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveAsNew()} />
          <button className="btn ghost" onClick={saveAsNew} disabled={!saveAs.trim() || anyErrors}>Save as</button>
          <button className="btn ghost" onClick={download}>Download JSON</button>
          <button className="btn ghost" onClick={() => fileRef.current?.click()}>Upload JSON</button>
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.currentTarget.value = ""; }} />
          {!BUILTIN_PRESET_NAMES.includes(active.name) && <button className="btn ghost" onClick={() => deletePreset(active.name)}>Delete preset</button>}
          <button className="btn ghost" onClick={() => { resetDefaults(); setStatus("Built-in presets restored (Default ICP and Job Search (CIO)). Your own saved presets are untouched."); }} data-testid="reset-defaults">Reset to defaults</button>
        </div>
      </div>
      {status && <p className="mt-3 text-xs text-accent" data-testid="studio-status">{status}</p>}

      <div className="grid lg:grid-cols-12 gap-8 mt-8">
        <div className="lg:col-span-8 space-y-10">
          <IcpEditor icp={draft.icp} onChange={(icp) => setDraft({ ...draft, icp })} onRebuild={rebuild} />

          <section data-testid="watchlist-editor">
            <div className="flex items-center justify-between">
              <Label>Company watchlist · matched in code by name, never sent to Jev · {draft.watchlist?.length ?? 0} names · {watchlistHits} connections match</Label>
              <button className="btn ghost" onClick={() => setDraft({ ...draft, watchlist: [] })} disabled={!draft.watchlist?.length}>Clear</button>
            </div>
            <textarea
              className="input mt-2 font-mono text-xs"
              rows={5}
              placeholder={"One company per line (or comma separated). Example:\nStryker\nMcKesson\nAGCO Corporation"}
              value={(draft.watchlist ?? []).join("\n")}
              onChange={(e) => setDraft({ ...draft, watchlist: parseWatchlistText(e.target.value) })}
              data-testid="watchlist-text"
            />
            <p className="text-[11px] text-muted mt-1">Names are normalised (case, punctuation, Inc/Corp/LLC suffixes) and matched against the exported Company column. Watchlisted people show ★ and can be filtered on the Radar page. Save changes to apply.</p>
          </section>

          <ThresholdSliders th={draft.thresholds} onChange={applyThresholds} tierCounts={tierCounts} bucketCounts={bucketCounts} jevCalls={jevCalls} intentKeys={(draft.questions.find((q) => q.id === "message_intent")?.options ?? []).map((o) => o.key)} />

          {groups.map((g) => (
            <section key={g.title}>
              <div className="flex items-center justify-between">
                <Label>{g.title}</Label>
                <button className="btn ghost" onClick={() => addQ(g.tab, g.pass)}>Add question</button>
              </div>
              <div className="space-y-4 mt-3">
                {draft.questions.map((q, i) => (q.tab === g.tab && q.pass === g.pass) || (g.pass === "post" && q.pass === "post") ? (
                  <QuestionCard
                    key={`${i}-${q.id}`}
                    q={q}
                    issues={issues[q.id] ?? []}
                    fieldOptions={fieldOptionsFor(q)}
                    onChange={(nq) => updateQ(i, nq)}
                    onDelete={() => setDraft({ ...draft, questions: draft.questions.filter((_, j) => j !== i) })}
                    onDuplicate={() => setDraft({ ...draft, questions: [...draft.questions.slice(0, i + 1), { ...q, id: `${q.id}_copy` }, ...draft.questions.slice(i + 1)] })}
                    onMove={(d) => moveQ(i, d)}
                  />
                ) : null)}
              </div>
            </section>
          ))}

          <TestSample draft={draft} disabled={anyErrors} />
          <RerunAll draft={draft} disabled={anyErrors} onRun={(tab) => { savePreset({ ...draft, createdAt: new Date().toISOString() }); clearResults(tab, "pre"); startRun({ tab, pass: "pre" }); setStatus(`Re-running ${tab} with “${draft.name}”. Watch progress on the Radar page.`); }} />
        </div>
        <div className="lg:col-span-4">
          <div className="sticky top-4"><ContractPanel available={availableMap} /></div>
        </div>
      </div>
    </div>
  );
}

function sourceColumnsPresent(source: string, cols: Set<string>): boolean {
  const first = source.split("(")[0].trim();
  return first.split(/\s+or\s+|\s*\/\s*/).some((c) => cols.has(c.trim().toLowerCase()));
}

// ---------- Test on 25 rows ----------

function TestSample({ draft, disabled }: { draft: Preset; disabled: boolean }) {
  const results = useApp((s) => s.results);
  const [tab, setTab] = useState<Tab>("connections");
  const [running, setRunning] = useState(false);
  const [out, setOut] = useState<{ id: string; name: string; prev?: RowResult; next: RowResult }[]>([]);
  const connections = useApp((s) => s.connections);
  const invitations = useApp((s) => s.invitations);

  const nameOf = (id: string) => {
    const c = connections?.rows.find((r) => r.id === id);
    if (c) return `${c.firstName} ${c.lastNameClean}`;
    const i = invitations?.rows.find((r) => r.id === id);
    return i?.name ?? id;
  };

  const run = async () => {
    const qs = draft.questions.filter((q) => q.enabled && q.tab === tab && q.pass === "pre");
    const all = allRowsFor(tab, "pre", qs);
    if (all.length === 0) return;
    // Prefer rows with a previous answer so there is something to compare.
    const scored = all.filter((r) => results[resultKey(r.id, "pre")]);
    const pool = scored.length >= 25 ? scored : all;
    const sample = shuffle(pool).slice(0, 25).map((r) => r.id);
    setRunning(true);
    setOut([]);
    await startRun({
      tab,
      pass: "pre",
      onlyIds: sample,
      questions: draft.questions,
      store: false,
      onRow: (r) => setOut((o) => [...o, { id: r.rowId, name: nameOf(r.rowId), prev: results[resultKey(r.rowId, "pre")], next: r }]),
    });
    setRunning(false);
  };

  const qids = draft.questions.filter((q) => q.enabled && q.tab === tab && q.pass === "pre").map((q) => q.id);
  return (
    <section data-testid="test-sample">
      <div className="flex items-center justify-between">
        <Label>Test on 25 rows · previous vs new answer, flipped rows highlighted</Label>
        <div className="flex gap-2">
          <select className="input !w-40" value={tab} onChange={(e) => setTab(e.target.value as Tab)} aria-label="Test tab">
            <option value="connections">Connections</option>
            <option value="invitations">Invitations</option>
          </select>
          <button className="btn" onClick={run} disabled={disabled || running} data-testid="test-run">{running ? "Testing…" : "Test on 25 rows"}</button>
        </div>
      </div>
      {out.length > 0 && (
        <div className="overflow-x-auto mt-3">
          <table className="data">
            <thead><tr><th>Row</th>{qids.map((q) => <th key={q}>{q}</th>)}</tr></thead>
            <tbody>
              {out.map((o) => (
                <tr key={o.id}>
                  <td className="whitespace-nowrap">{o.name}</td>
                  {qids.map((q) => {
                    const p = o.prev?.answers[q];
                    const n = o.next.answers[q];
                    const flipped = p && n && p.answer !== n.answer;
                    return (
                      <td key={q} className={flipped ? "text-accent" : ""}>
                        <div className="text-muted">{p ? `${p.answer} ${pct(p.type === "noul" ? p.noul : p.confidence)}` : "–"}</div>
                        <div className="font-mono">{n ? `${n.answer} ${pct(n.type === "noul" ? n.noul : n.confidence)}` : o.next.error ? "error" : "–"}</div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function shuffle<T>(a: T[]): T[] {
  const c = [...a];
  for (let i = c.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [c[i], c[j]] = [c[j], c[i]];
  }
  return c;
}

// ---------- Re-run all ----------

function RerunAll({ draft, disabled, onRun }: { draft: Preset; disabled: boolean; onRun: (tab: Tab) => void }) {
  const results = useApp((s) => s.results);
  const connections = useApp((s) => s.connections);
  const invitations = useApp((s) => s.invitations);
  const [confirm, setConfirm] = useState<Tab | null>(null);
  const avg = (prefix: string) => {
    const rs = Object.entries(results).filter(([k, v]) => k.startsWith(prefix) && v.pass === "pre" && v.inputTokens > 0).map(([, v]) => v.inputTokens);
    return rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null;
  };
  const rowsC = connections?.rows.length ?? 0;
  const rowsI = invitations?.rows.filter((r) => r.direction === "INCOMING" && r.hasMessage).length ?? 0;
  const estC = estimateRun(rowsC, avg("c:"));
  const estI = estimateRun(rowsI, avg("i:"), 250);
  return (
    <section data-testid="rerun">
      <Label>Re-run all with this preset</Label>
      <div className="grid md:grid-cols-2 gap-3 mt-3 text-xs">
        {([["connections", rowsC, estC], ["invitations", rowsI, estI]] as const).map(([tab, n, est]) => (
          <div key={tab} className="border border-line p-3">
            <div className="flex justify-between"><span className="capitalize">{tab}</span><span className="font-mono">{fmtInt(n)} rows</span></div>
            <div className="text-muted mt-1">Estimate: about {fmtInt(est.tokens)} input tokens · ${est.usd.toFixed(4)} at $0.042 per million</div>
            <div className="mt-2 flex gap-2">
              {confirm === tab ? (
                <>
                  <button className="btn accent" onClick={() => { setConfirm(null); onRun(tab); }} disabled={disabled || n === 0}>Confirm re-run</button>
                  <button className="btn ghost" onClick={() => setConfirm(null)}>Cancel</button>
                </>
              ) : (
                <button className="btn" onClick={() => setConfirm(tab)} disabled={disabled || n === 0}>Re-run {tab}</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
