"use client";
// Client-side scoring loop. Iterates batches, streams rows back, repaints the
// store after every row. Pause stops dispatching after the in-flight batch.

import { resultKey, useApp } from "./store";
import { connectionPreState, fieldsForQuestions, invitationPreState, postState, type JevState } from "./state";
import { questionsHash } from "./questions";
import type { Pass, QuestionSpec, RowResult, Tab } from "./types";
import type { RowScore } from "./jev";

export const DEFAULT_BATCH = 24;
let pauseRequested = false;
let running = false;
let currentBatchSize = DEFAULT_BATCH;

export function requestPause() {
  pauseRequested = true;
}

export function isRunning() {
  return running;
}

/** Rows that still need scoring for the active question set. */
export function pendingRows(tab: Tab, pass: Pass): { id: string; state: JevState }[] {
  const s = useApp.getState();
  const preset = s.activePreset();
  const qs = preset.questions.filter((q) => q.enabled && q.tab === tab && q.pass === pass);
  if (qs.length === 0) return [];
  const hash = questionsHash(preset.questions, pass, tab);
  const fields = fieldsForQuestions(qs);
  const out: { id: string; state: JevState }[] = [];
  const needs = (id: string) => {
    const r = s.results[resultKey(id, pass)];
    return !r || r.questionsHash !== hash || !!r.error;
  };
  if (pass === "pre") {
    if (tab === "connections") {
      for (const row of s.connections?.rows ?? []) if (needs(row.id)) out.push({ id: row.id, state: connectionPreState(row, fields) });
    } else {
      // INCOMING invitations with a non-empty Message only. OUTGOING and message-less rows never reach Jev.
      for (const row of s.invitations?.rows ?? []) {
        if (row.direction !== "INCOMING" || !row.hasMessage) continue;
        if (needs(row.id)) out.push({ id: row.id, state: invitationPreState(row, fields) });
      }
    }
  } else {
    const prefix = tab === "connections" ? "c:" : "i:";
    for (const e of Object.values(s.enrichment)) {
      if (!e.rowId.startsWith(prefix)) continue;
      if (needs(e.rowId)) out.push({ id: e.rowId, state: postState(e, fields) });
    }
  }
  return out;
}

export interface RunOptions {
  tab: Tab;
  pass: Pass;
  /** Restrict to these row ids (e.g. a test sample). */
  onlyIds?: string[];
  /** Override questions (Studio test). Results are returned, not stored, when store=false. */
  questions?: QuestionSpec[];
  store?: boolean;
  onRow?: (r: RowResult) => void;
}

/** Stream one batch through /api/score; returns per-row results as they arrive. */
export async function scoreBatch(
  tab: Tab,
  pass: Pass,
  questions: QuestionSpec[],
  rows: { id: string; state: JevState }[],
  onRow: (r: RowScore) => void,
  signal?: AbortSignal,
): Promise<{ inputTokens: number; errors: number }> {
  const res = await fetch("/api/score", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tab, pass, questions, rows }),
    signal,
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg = j.error ? `${j.error}${j.details ? " " + JSON.stringify(j.details) : ""}` : msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  let inputTokens = 0;
  let errors = 0;
  const handleLine = (line: string) => {
    if (!line.trim()) return;
    const obj = JSON.parse(line);
    if (obj.done) return;
    const r = obj as RowScore;
    inputTokens += r.inputTokens ?? 0;
    if (r.error) errors++;
    onRow(r);
  };
  if (res.body) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        handleLine(buf.slice(0, nl));
        buf = buf.slice(nl + 1);
      }
    }
    if (buf.trim()) handleLine(buf);
  } else {
    (await res.text()).split("\n").forEach(handleLine);
  }
  return { inputTokens, errors };
}

export async function startRun(opts: RunOptions): Promise<void> {
  if (running) return;
  running = true;
  pauseRequested = false;
  const app = useApp.getState();
  const preset = app.activePreset();
  const questions = (opts.questions ?? preset.questions).filter((q) => q.enabled && q.tab === opts.tab && q.pass === opts.pass);
  const hash = questionsHash(opts.questions ?? preset.questions, opts.pass, opts.tab);
  let pending = pendingRows(opts.tab, opts.pass);
  if (opts.onlyIds) {
    const set = new Set(opts.onlyIds);
    // For a test we re-score even already-scored rows.
    pending = allRowsFor(opts.tab, opts.pass, questions).filter((r) => set.has(r.id));
  }
  const prev = app.run;
  const resumed = prev.status === "paused" && prev.tab === opts.tab && prev.pass === opts.pass;
  app.setRun({
    status: "running",
    tab: opts.tab,
    pass: opts.pass,
    startedAt: resumed && prev.startedAt ? Date.now() - prev.elapsedMs : Date.now(),
    elapsedMs: resumed ? prev.elapsedMs : 0,
    rowsScored: resumed ? prev.rowsScored : 0,
    answers: resumed ? prev.answers : 0,
    inputTokens: resumed ? prev.inputTokens : 0,
    total: pending.length + (resumed ? prev.rowsScored : 0),
    lastError: null,
  });
  const qCount = questions.length;
  try {
    let i = 0;
    while (i < pending.length) {
      if (pauseRequested) {
        useApp.getState().setRun({ status: "paused", elapsedMs: Date.now() - (useApp.getState().run.startedAt ?? Date.now()) });
        running = false;
        return;
      }
      const batch = pending.slice(i, i + currentBatchSize);
      try {
        const buffer: RowResult[] = [];
        await scoreBatch(opts.tab, opts.pass, questions, batch, (r) => {
          const result: RowResult = {
            rowId: r.id,
            pass: opts.pass,
            questionsHash: hash,
            answers: r.answers,
            latencyMs: r.latencyMs,
            inputTokens: r.inputTokens,
            outputTokens: r.outputTokens,
            model: r.model,
            scoredAt: new Date().toISOString(),
            error: r.error,
          };
          if (opts.store !== false) useApp.getState().setResults([result]);
          else buffer.push(result);
          opts.onRow?.(result);
          const st = useApp.getState();
          st.setRun({
            currentRowId: r.id,
            rowsScored: st.run.rowsScored + 1,
            answers: st.run.answers + (r.error ? 0 : qCount),
            inputTokens: st.run.inputTokens + (r.inputTokens ?? 0),
            elapsedMs: Date.now() - (st.run.startedAt ?? Date.now()),
            callCount: st.run.callCount + 1,
          });
          st.bumpJevCalls(1);
        });
        i += batch.length;
        if (currentBatchSize < DEFAULT_BATCH) currentBatchSize = Math.min(DEFAULT_BATCH, currentBatchSize * 2);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // Validation errors are not transient: stop.
        if (/HTTP 4\d\d|validation|contract|forbidden|outside/i.test(msg)) {
          useApp.getState().setRun({ status: "error", lastError: msg });
          running = false;
          return;
        }
        // Transient: halve the batch and retry after a short wait.
        currentBatchSize = Math.max(4, Math.floor(currentBatchSize / 2));
        useApp.getState().setRun({ lastError: `${msg} (retrying with ${currentBatchSize}-row batches)` });
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
    const st = useApp.getState();
    st.setRun({ status: "done", elapsedMs: Date.now() - (st.run.startedAt ?? Date.now()), currentRowId: st.run.currentRowId });
  } finally {
    running = false;
  }
}

function allRowsFor(tab: Tab, pass: Pass, questions: QuestionSpec[]): { id: string; state: JevState }[] {
  const s = useApp.getState();
  const fields = fieldsForQuestions(questions);
  if (pass === "pre") {
    if (tab === "connections") return (s.connections?.rows ?? []).map((row) => ({ id: row.id, state: connectionPreState(row, fields) }));
    return (s.invitations?.rows ?? []).filter((r) => r.direction === "INCOMING" && r.hasMessage).map((row) => ({ id: row.id, state: invitationPreState(row, fields) }));
  }
  const prefix = tab === "connections" ? "c:" : "i:";
  return Object.values(s.enrichment).filter((e) => e.rowId.startsWith(prefix)).map((e) => ({ id: e.rowId, state: postState(e, fields) }));
}

export { allRowsFor };
