"use client";
import { useRef, useState } from "react";
import { useApp } from "@/lib/store";
import { ingestFile } from "@/lib/upload";
import type { Tab } from "@/lib/types";
import { fmtInt } from "./ui";

export function UploadBar({ onOpenUploads }: { onOpenUploads?: () => void }) {
  const connections = useApp((s) => s.connections);
  const invitations = useApp((s) => s.invitations);
  const [msg, setMsg] = useState<string | null>(null);
  const replace = async (file: File, slot: Tab) => {
    const o = await ingestFile(file, slot);
    setMsg(o.message);
    setTimeout(() => setMsg(null), 6000);
  };
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs" data-testid="upload-bar">
      <FileChip label="Connections" name={connections?.stats.fileName} count={connections?.rows.length} onReplace={(f) => replace(f, "connections")} />
      <FileChip label="Invitations" name={invitations?.stats.fileName} count={invitations?.rows.length} onReplace={(f) => replace(f, "invitations")} />
      {onOpenUploads && <button className="btn ghost !py-1 !px-2" onClick={onOpenUploads} data-testid="open-uploads">Files & stats</button>}
      {msg && <span className="text-accent">{msg}</span>}
    </div>
  );
}

function FileChip({ label, name, count, onReplace }: { label: string; name?: string; count?: number; onReplace: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-2">
      <span className="label">{label}</span>
      {name ? (
        <>
          <span className="font-mono truncate max-w-[12rem]" title={name}>{name}</span>
          <span className="text-muted">{fmtInt(count ?? 0)} rows</span>
        </>
      ) : (
        <span className="text-muted">not loaded</span>
      )}
      <button className="btn ghost !py-1 !px-2" onClick={() => ref.current?.click()}>{name ? "Replace" : "Add"}</button>
      <input ref={ref} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onReplace(f); e.currentTarget.value = ""; }} />
    </div>
  );
}
