"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { pendingRows, requestPause, startRun, isRunning } from "@/lib/runner";
import { formatCost } from "@/lib/cost";
import type { Tab } from "@/lib/types";
import { UploadBar } from "./UploadBar";
import { Tile, fmtInt, fmtMs } from "./ui";

export function TopBar({ tab, tier1Count, rowsRead, questionCount, onOpenUploads }: { tab: Tab; tier1Count: number; rowsRead: number; questionCount: number; onOpenUploads?: () => void }) {
  const run = useApp((s) => s.run);
  const results = useApp((s) => s.results);
  const presets = useApp((s) => s.presets);
  const activePresetName = useApp((s) => s.activePresetName);
  const setActivePreset = useApp((s) => s.setActivePreset);
  const [, tick] = useState(0);
  useEffect(() => {
    if (run.status !== "running") return;
    const t = setInterval(() => tick((x) => x + 1), 500);
    return () => clearInterval(t);
  }, [run.status]);

  const elapsed = run.status === "running" && run.startedAt ? Date.now() - run.startedAt : run.elapsedMs;
  // Totals across all stored results (this tab), so the tiles survive a reload.
  const prefix = tab === "connections" ? "c:" : "i:";
  let typedAnswers = 0;
  let tokens = 0;
  for (const [k, r] of Object.entries(results)) {
    if (!k.startsWith(prefix)) continue;
    typedAnswers += Object.keys(r.answers).length;
    tokens += r.inputTokens;
  }
  const perSec = elapsed > 0 && run.answers ? run.answers / (elapsed / 1000) : 0;
  const pending = pendingRows(tab, "pre").length;
  const running = run.status === "running";

  const onRun = () => {
    if (running) return;
    startRun({ tab, pass: "pre" });
  };
  const onPause = () => requestPause();

  return (
    <div className="pt-4">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4">
        <UploadBar onOpenUploads={onOpenUploads} />
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs">
            <span className="label">Lens</span>
            <select className="input !w-48" value={activePresetName} onChange={(e) => setActivePreset(e.target.value)} aria-label="Active preset" data-testid="preset-select" disabled={running}>
              {presets.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
          </label>
          {running ? (
            <button className="btn accent" onClick={onPause} data-testid="pause">Pause</button>
          ) : (
            <button className="btn primary" onClick={onRun} disabled={pending === 0 || isRunning()} data-testid="run">
              {run.status === "paused" ? "Resume" : "Run"} {pending > 0 ? `· ${fmtInt(pending)} rows` : "· nothing pending"}
            </button>
          )}
        </div>
      </div>
      {run.lastError && <div className="mt-2 text-xs text-accent" data-testid="run-error">{run.lastError}</div>}
      <div className="metrics" data-testid="tiles">
        <Tile label="Rows read" value={fmtInt(rowsRead)} />
        <Tile label="Typed answers" value={fmtInt(typedAnswers)} hint={`rows × ${questionCount} questions`} />
        <Tile label="Tier 1 so far" value={fmtInt(tier1Count)} accent />
        <Tile label="Answers / sec" value={perSec ? perSec.toFixed(1) : "–"} />
        <Tile label="Elapsed" value={elapsed ? fmtMs(elapsed) : "–"} />
        <Tile label="Cost so far" value={formatCost(tokens)} hint={`${fmtInt(tokens)} input tokens × $0.042 per million`} />
      </div>
    </div>
  );
}
