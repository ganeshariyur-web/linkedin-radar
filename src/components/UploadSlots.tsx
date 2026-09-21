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
    <div className="mt-12 md:mt-20">
      <div className="grid lg:grid-cols-12 gap-10 items-end">
        <div className="lg:col-span-8">
          <div className="label eyebrow mb-4">Network intelligence · Judged by Jev, counted by code</div>
          <h1 className="headline text-[44px] md:text-[72px] max-w-4xl">
            Every connection, every invitation, <em>ranked against the people who matter.</em>
          </h1>
        </div>
        <p className="lg:col-span-4 text-[15px] text-fg-2 leading-relaxed max-w-md">
          Drop your LinkedIn exports. They are parsed here, in your browser, and never uploaded as files. Only a job title,
          a company name and a few code-computed buckets reach the model. Either file may be loaded alone.
        </p>
      </div>
      <div className="grid md:grid-cols-2 gap-8 mt-14">
        <Slot slot="connections" title="Connections.csv" stats={connections?.stats ?? null} onFile={onFile} outcome={messages.connections} />
        <Slot slot="invitations" title="Invitations.csv" stats={invitations?.stats ?? null} onFile={onFile} outcome={messages.invitations} />
      </div>
      <div className="mt-16 rule pt-8 grid md:grid-cols-3 gap-8" data-testid="how-it-works">
        {[
          ["Score", "Press Run. Jev reads only the job title, company and a few code-computed buckets, and answers typed questions with probabilities. Code turns them into tiers."],
          ["Inspect", "Watch each person verify live, click any tile for the full reasoning, filter by tier, role or company type, and download a CSV per tier."],
          ["Enrich and tune", "Enrich Tier 1 through Apify for photo, location and company size, then rewrite any question or threshold in the Classifier Studio and test it on 25 rows."],
        ].map(([t, d], i) => (
          <div key={t}>
            <div className="flex items-baseline gap-3">
              <span className="headline italic text-accent text-[22px]">0{i + 1}</span>
              <span className="headline text-[24px]">{t}</span>
            </div>
            <p className="text-[13px] text-muted leading-relaxed mt-2">{d}</p>
          </div>
        ))}
      </div>
      {(connections || invitations) && (
        <div className="mt-10 flex items-center gap-4">
          <button className="btn primary !px-6 !py-3" onClick={onContinue} data-testid="continue">Open radar →</button>
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
        className={`dropzone mt-2 p-7 min-h-[12.5rem] flex flex-col justify-between cursor-pointer ${over ? "over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f, slot); }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
      >
        <div className="flex items-baseline justify-between">
          <div className="headline text-[28px]">{title}</div>
          <span className="btn ghost !py-1.5">Drop or choose file</span>
        </div>
        <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" data-testid={`input-${slot}`} onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f, slot); e.currentTarget.value = ""; }} />
        {stats ? <StatsBlock stats={stats} /> : <div className="text-xs text-muted mt-6">No file yet.</div>}
      </div>
      {outcome && (
        <p data-testid={`msg-${slot}`} className={`mt-2 text-xs ${outcome.ok ? (outcome.moved ? "text-accent" : "text-muted") : "text-accent"}`}>
          {outcome.message}
        </p>
      )}
      <ol className="mt-4 space-y-1.5">
        {HOW_TO[slot].map((l, i) => (
          <li key={l} className="flex gap-3 text-[12px] text-muted leading-relaxed">
            <span className="headline italic text-accent text-[13px] w-4 shrink-0">{i + 1}</span>
            <span>{l}</span>
          </li>
        ))}
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
    <dl data-testid={`stats-${stats.schema}`} className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 text-xs mt-5">
      {items.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="label !text-[10px]">{k}</dt>
          <dd className="num text-right text-fg">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
