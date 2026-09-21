"use client";
import Link from "next/link";
import { useApp } from "@/lib/store";
import type { ScoredRow } from "@/lib/derive";
import type { QuestionAnswer, QuestionSpec, RowResult } from "@/lib/types";
import { TIER_LABEL, BUCKET_LABEL } from "@/lib/tiers";
import { Bar, Label, pct, fmtInt } from "./ui";

export function VerifyingProfile({ rows, questions }: { rows: ScoredRow[]; questions: QuestionSpec[] }) {
  const selected = useApp((s) => s.selectedRowId);
  const current = useApp((s) => s.run.currentRowId);
  const status = useApp((s) => s.run.status);
  const id = selected ?? current;
  const row = rows.find((r) => r.id === id) ?? null;
  const live = !selected && status === "running";

  return (
    <div data-testid="verifying">
      <div className="flex items-center justify-between">
        <Label>{live ? "Verifying profile" : selected ? "Selected profile" : "Verifying profile"}</Label>
        {live && <span className="label text-accent">Live</span>}
      </div>
      {!row ? (
        <p className="mt-3 text-sm text-muted">Click a tile, or press Run to watch rows score here.</p>
      ) : (
        <div className="mt-3">
          <div className="flex items-start gap-3">
            {row.enrichment?.photo && <img src={row.enrichment.photo} alt="" className="w-12 h-12 object-cover" referrerPolicy="no-referrer" />}
            <div className="min-w-0">
              <div className="headline text-2xl truncate">{row.name}</div>
              {row.kind === "connection" ? (
                <div className="text-xs text-muted mt-1 leading-relaxed">
                  <div className="truncate">{row.row.position || <em>no position</em>}</div>
                  <div className="truncate">{row.row.company || <em>no company</em>}</div>
                  <div className="flex gap-3 mt-1">
                    <span>Connected {row.row.connectedFor ?? "–"}</span>
                    {row.row.hasEmail && <span>· email on file</span>}
                    <span className="text-fg">· {TIER_LABEL[row.tier]}</span>
                  </div>
                  {row.enrichment && (
                    <div className="mt-1">{[row.enrichment.headline, row.enrichment.location].filter(Boolean).join(" · ")}</div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-muted mt-1 leading-relaxed">
                  <div>{row.row.direction} · {row.row.invitationAge ?? "–"} · {row.row.match ?? "no match data"} · <span className="text-fg">{BUCKET_LABEL[row.bucket]}</span></div>
                  {row.row.message ? <blockquote className="mt-1 border-l border-line pl-2 italic whitespace-pre-wrap">{row.row.message}</blockquote> : <em>no message</em>}
                </div>
              )}
              {row.kind === "connection" && row.row.url && (
                <a href={row.row.url} target="_blank" rel="noreferrer noopener" className="label mt-2 inline-block hover:text-fg">Open profile ↗</a>
              )}
              {row.kind === "invitation" && row.row.profileUrl && (
                <a href={row.row.profileUrl} target="_blank" rel="noreferrer noopener" className="label mt-2 inline-block hover:text-fg">Open profile ↗</a>
              )}
            </div>
          </div>
          <AnswerLines result={row.pre} questions={questions.filter((q) => q.pass === "pre")} pass="pre" />
          {row.post && <AnswerLines result={row.post} questions={questions.filter((q) => q.pass === "post")} pass="post" />}
          {!row.pre && row.kind === "invitation" && !row.row.hasMessage && (
            <p className="mt-3 text-xs text-muted">No message, so this row was never sent to Jev. Select it for enrichment to learn more.</p>
          )}
          {!row.pre && row.kind === "invitation" && row.row.direction === "OUTGOING" && (
            <p className="mt-3 text-xs text-muted">Outgoing invitation: matched against Connections in code, no Jev call.</p>
          )}
        </div>
      )}
    </div>
  );
}

function AnswerLines({ result, questions, pass }: { result?: RowResult; questions: QuestionSpec[]; pass: "pre" | "post" }) {
  if (!result) return null;
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between">
        <Label>{pass === "pre" ? "Pre-enrichment answers" : "Post-enrichment answers"}</Label>
        <span className="label">{result.latencyMs} ms · {fmtInt(result.inputTokens)} tokens</span>
      </div>
      {result.error && <div className="text-xs text-accent mt-1">{result.error}</div>}
      <ul className="mt-2 space-y-2">
        {questions.filter((q) => q.enabled).map((q) => {
          const a = result.answers[q.id];
          return <AnswerLine key={q.id} q={q} a={a} latency={result.latencyMs} tokens={result.inputTokens} />;
        })}
      </ul>
    </div>
  );
}

function AnswerLine({ q, a, latency, tokens }: { q: QuestionSpec; a?: QuestionAnswer; latency: number; tokens: number }) {
  const value = a ? (a.type === "noul" ? a.noul ?? 0 : a.confidence ?? a.probability) : 0;
  const label = a ? (a.type === "noul" ? `${pct(a.noul)} yes` : a.type === "score" ? `${a.answer} (${(a.score ?? 0).toFixed(2)})` : a.answer) : "–";
  return (
    <li className="text-xs" data-testid={`answer-${q.id}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-muted">{q.id}</span>
        <span className="font-mono truncate">{label}</span>
      </div>
      <Bar value={value} accent={a?.type === "noul"} className="mt-1" />
      <div className="flex items-center justify-between mt-1 text-[10px] text-muted">
        <span>{a?.type === "noul" ? "probability" : "confidence"} {pct(value)} · {latency} ms · {fmtInt(tokens)} tok</span>
        <Link href={`/studio#${q.id}`} className="hover:text-fg">Edit this question</Link>
      </div>
    </li>
  );
}
