"use client";
import { useCallback, useRef, useState } from "react";
import { useApp } from "@/lib/store";
import { ingestFile, type UploadOutcome } from "@/lib/upload";
import type { Tab, UploadStats } from "@/lib/types";
import { Label, fmtInt } from "./ui";

const HOW_TO: Record<Tab, string[]> = {
  connections: [
    "LinkedIn → Me → Settings & Privacy → Data privacy → Get a copy of your data.",
    "Choose “Want something in particular?”, tick Connections, then Request archive.",
    "When the email arrives (about 10 minutes), download the zip and drop Connections.csv here.",
  ],
  invitations: [
    "LinkedIn → Me → Settings & Privacy → Data privacy → Get a copy of your data.",
    "Choose “Want something in particular?”, tick Invitations, then Request archive.",
    "When the email arrives, download the zip and drop Invitations.csv here.",
  ],
};

export function UploadSlots({ onContinue }: { onContinue?: () => void }) {
  const [messages, setMessages] = useState<Record<Tab, UploadOutcome | null>>({ connections: null, invitations: null });
  const connections = useApp((s) => s.connections);
  const invitations = useApp((s) => s.invitations);

  const onFile = useCallback(async (file: File, slot: Tab) => {
    const outcome = await ingestFile(file, slot);
    setMessages((m) => {
      const next = { ...m, [slot]: outcome };
      if (outcome.ok && outcome.moved && outcome.schema) next[outcome.schema] = outcome;
      return next;
    });
  }, []);

  return (
    <div className="mt-10 md:mt-16">
      <h1 className="headline text-4xl md:text-6xl max-w-3xl">
        Score every connection and invitation against your ideal customer, live.
      </h1>
      <p className="mt-4 max-w-2xl text-sm text-muted leading-relaxed">
        Drop your LinkedIn exports below. They are parsed in this browser and never uploaded as files; only the job title,
        company and a few code-computed buckets reach TypeSafe’s Jev for judgment. Either file may be loaded alone.
      </p>
      <div className="grid md:grid-cols-2 gap-6 mt-10">
        <Slot slot="connections" title="Connections.csv" stats={connections?.stats ?? null} onFile={onFile} outcome={messages.connections} />
        <Slot slot="invitations" title="Invitations.csv" stats={invitations?.stats ?? null} onFile={onFile} outcome={messages.invitations} />
      </div>
      {(connections || invitations) && (
        <div className="mt-8 flex items-center gap-4">
          <button className="btn primary" onClick={onContinue} data-testid="continue">Open radar →</button>
          <span className="text-xs text-muted">{connections && invitations ? "Both files loaded." : "You can add the other file later from the top bar."}</span>
        </div>
      )}
    </div>
  );
}

function Slot({ slot, title, stats, onFile, outcome }: { slot: Tab; title: string; stats: UploadStats | null; onFile: (f: File, s: Tab) => void; outcome: UploadOutcome | null }) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <Label>{slot === "connections" ? "Slot 1" : "Slot 2"}</Label>
      <div
        data-testid={`slot-${slot}`}
        className={`dropzone mt-2 p-6 min-h-[11rem] flex flex-col justify-between cursor-pointer ${over ? "over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f, slot); }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
      >
        <div className="flex items-baseline justify-between">
          <div className="headline text-2xl">{title}</div>
          <span className="label">Drop or choose file</span>
        </div>
        <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" data-testid={`input-${slot}`} onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f, slot); e.currentTarget.value = ""; }} />
        {stats ? <StatsBlock stats={stats} /> : <div className="text-xs text-muted">No file yet.</div>}
      </div>
      {outcome && (
        <p data-testid={`msg-${slot}`} className={`mt-2 text-xs ${outcome.ok ? (outcome.moved ? "text-accent" : "text-muted") : "text-accent"}`}>
          {outcome.message}
        </p>
      )}
      <ol className="mt-3 text-[11px] text-muted leading-relaxed space-y-0.5 list-decimal pl-4">
        {HOW_TO[slot].map((l) => <li key={l}>{l}</li>)}
      </ol>
    </div>
  );
}

export function StatsBlock({ stats }: { stats: UploadStats }) {
  const items: [string, string][] = [
    ["Parsed rows", `${fmtInt(stats.parsedRowCount)} of ${fmtInt(stats.rawDataLineCount)} raw lines`],
    ["Date format", stats.dateFormat],
  ];
  if (stats.schema === "connections") {
    items.push(["Empty position", fmtInt(stats.emptyPosition ?? 0)]);
    items.push(["Empty company", fmtInt(stats.emptyCompany ?? 0)]);
    items.push(["With email", fmtInt(stats.withEmail ?? 0)]);
    if (stats.preambleLines) items.push(["Preamble skipped", `${stats.preambleLines} lines`]);
  } else {
    items.push(["Without a message", fmtInt(stats.withoutMessage ?? 0)]);
    items.push(["Incoming / outgoing", `${fmtInt(stats.incoming ?? 0)} / ${fmtInt(stats.outgoing ?? 0)}`]);
  }
  return (
    <dl data-testid={`stats-${stats.schema}`} className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-3">
      {items.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted">{k}</dt>
          <dd className="font-mono text-right">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
