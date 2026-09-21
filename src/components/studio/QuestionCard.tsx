"use client";
import type { QuestionSpec, QuestionType } from "@/lib/types";
import type { ValidationIssue } from "@/lib/questions";
import { Label } from "../ui";

export interface FieldOption {
  name: string;
  source: string;
  available: boolean;
}

export function QuestionCard({ q, issues, fieldOptions, onChange, onDelete, onDuplicate, onMove }: {
  q: QuestionSpec;
  issues: ValidationIssue[];
  fieldOptions: FieldOption[];
  onChange: (q: QuestionSpec) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const errs = issues.filter((i) => i.level === "error");
  const warns = issues.filter((i) => i.level === "warning");
  const set = <K extends keyof QuestionSpec>(k: K, v: QuestionSpec[K]) => onChange({ ...q, [k]: v });

  const convert = (t: QuestionType) => {
    if (t === q.type) return;
    const next: QuestionSpec = { ...q, type: t };
    if (t === "choice") {
      next.options = q.options?.length ? q.options : (q.levels ?? []).map((l, i) => ({ key: `level_${i}`, description: l }));
      if (!next.options.length) next.options = [{ key: "yes", description: "" }, { key: "no", description: "" }];
      delete next.levels;
    } else if (t === "score") {
      next.levels = q.levels?.length ? q.levels : (q.options ?? []).map((o) => o.description || o.key);
      if (next.levels.length < 2) next.levels = ["Low", "High"];
      delete next.options;
    } else {
      delete next.options;
      delete next.levels;
    }
    onChange(next);
  };

  return (
    <article id={q.id} className={`card p-5 ${q.enabled ? "" : "opacity-60"} ${errs.length ? "!border-accent" : ""}`} data-testid={`qcard-${q.id}`}>
      <div className="flex flex-wrap items-center gap-3">
        <input className="input !w-56 font-mono" value={q.id} onChange={(e) => set("id", e.target.value.trim())} aria-label="Question id" />
        <select className="input !w-28" value={q.type} onChange={(e) => convert(e.target.value as QuestionType)} aria-label="Question type">
          <option value="choice">Choice</option>
          <option value="score">Score</option>
          <option value="noul">Noul</option>
        </select>
        <span className="label">{q.tab} · {q.pass === "pre" ? "pre-enrichment" : "post-enrichment"}</span>
        <div className="ml-auto flex items-center gap-1">
          <label className="text-xs flex items-center gap-1 mr-2"><input type="checkbox" checked={q.enabled} onChange={(e) => set("enabled", e.target.checked)} /> enabled</label>
          <button className="btn ghost !px-2" onClick={() => onMove(-1)} title="Move up">↑</button>
          <button className="btn ghost !px-2" onClick={() => onMove(1)} title="Move down">↓</button>
          <button className="btn ghost" onClick={onDuplicate}>Duplicate</button>
          <button className="btn ghost" onClick={onDelete}>Delete</button>
        </div>
      </div>

      <div className="mt-3">
        <Label>{q.type === "noul" ? "Statement (no criteria)" : "Instructions"}</Label>
        <textarea className="input mt-1" value={q.instructions} onChange={(e) => set("instructions", e.target.value)} />
      </div>

      <div className="mt-3">
        <Label>Fields this question reads</Label>
        <div className="flex flex-wrap gap-3 mt-1">
          {fieldOptions.map((f) => (
            <label key={f.name} className={`text-xs flex items-center gap-1 ${f.available ? "" : "text-muted"}`} title={f.source}>
              <input type="checkbox" checked={q.fields.includes(f.name)} onChange={(e) => set("fields", e.target.checked ? [...q.fields, f.name] : q.fields.filter((x) => x !== f.name))} />
              <span className="font-mono">{f.name}</span>
              <span className="text-muted">← {f.source}{f.available ? "" : " (not in current upload)"}</span>
            </label>
          ))}
          {fieldOptions.length === 0 && <span className="text-xs text-muted">Upload the {q.tab} file to see its columns.</span>}
        </div>
      </div>

      {q.type === "choice" && (
        <div className="mt-3">
          <div className="flex items-center justify-between">
            <Label>Options ({q.options?.length ?? 0}) · each needs a criterion</Label>
            <button className="btn ghost" onClick={() => set("options", [...(q.options ?? []), { key: `option_${(q.options?.length ?? 0) + 1}`, description: "" }])}>Add option</button>
          </div>
          <ul className="mt-2 space-y-2">
            {(q.options ?? []).map((o, i) => (
              <li key={i} className="grid grid-cols-[10rem_1fr_auto] gap-2 items-start">
                <input className="input font-mono" value={o.key} onChange={(e) => set("options", q.options!.map((x, j) => (j === i ? { ...x, key: e.target.value.trim() } : x)))} aria-label={`Option ${i + 1} key`} />
                <input className="input" value={o.description} placeholder="Criterion: when is this option right?" onChange={(e) => set("options", q.options!.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} aria-label={`Option ${i + 1} criterion`} />
                <div className="flex gap-1">
                  <button className="btn ghost !px-2" disabled={i === 0} onClick={() => set("options", swap(q.options!, i, i - 1))}>↑</button>
                  <button className="btn ghost !px-2" disabled={i === q.options!.length - 1} onClick={() => set("options", swap(q.options!, i, i + 1))}>↓</button>
                  <button className="btn ghost !px-2" onClick={() => set("options", q.options!.filter((_, j) => j !== i))}>×</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {q.type === "score" && (
        <div className="mt-3">
          <div className="flex items-center justify-between">
            <Label>Ordered levels ({q.levels?.length ?? 0}) · lowest first, 2–10</Label>
            <button className="btn ghost" onClick={() => set("levels", [...(q.levels ?? []), ""])}>Add level</button>
          </div>
          <ol className="mt-2 space-y-2">
            {(q.levels ?? []).map((l, i) => (
              <li key={i} className="grid grid-cols-[2rem_1fr_auto] gap-2 items-center">
                <span className="font-mono text-xs text-muted">{i}</span>
                <input className="input" value={l} onChange={(e) => set("levels", q.levels!.map((x, j) => (j === i ? e.target.value : x)))} aria-label={`Level ${i}`} />
                <div className="flex gap-1">
                  <button className="btn ghost !px-2" disabled={i === 0} onClick={() => set("levels", swap(q.levels!, i, i - 1))}>↑</button>
                  <button className="btn ghost !px-2" disabled={i === q.levels!.length - 1} onClick={() => set("levels", swap(q.levels!, i, i + 1))}>↓</button>
                  <button className="btn ghost !px-2" onClick={() => set("levels", q.levels!.filter((_, j) => j !== i))}>×</button>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {(errs.length > 0 || warns.length > 0) && (
        <ul className="mt-3 space-y-1 text-xs" data-testid={`issues-${q.id}`}>
          {errs.map((i, k) => <li key={`e${k}`} className="text-accent">✕ {i.message}</li>)}
          {warns.map((i, k) => <li key={`w${k}`} className="text-muted">△ {i.message}</li>)}
        </ul>
      )}
    </article>
  );
}

function swap<T>(arr: T[], a: number, b: number): T[] {
  const c = [...arr];
  [c[a], c[b]] = [c[b], c[a]];
  return c;
}
