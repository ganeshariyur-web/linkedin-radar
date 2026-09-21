"use client";
import type { ReactNode } from "react";

export function Label({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`label ${className}`}>{children}</div>;
}

export function Bar({ value, accent = false, className = "" }: { value: number; accent?: boolean; className?: string }) {
  const pct = Math.max(0, Math.min(1, value || 0)) * 100;
  return (
    <div className={`bar ${accent ? "accent" : ""} ${className}`} aria-hidden>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <Label>{label}</Label>
      <div className="font-mono text-base md:text-lg leading-tight mt-1 truncate" title={hint}>
        {value}
      </div>
    </div>
  );
}

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="mt-6">
      <div className="flex items-center justify-between mb-2">
        <Label>{title}</Label>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Pill({ children, active = false, onClick }: { children: ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-[11px] px-2 py-1 border ${active ? "border-fg bg-fg text-bg" : "border-line text-muted hover:border-fg hover:text-fg"}`}
    >
      {children}
    </button>
  );
}

export function fmtMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h) return `${h}h ${m % 60}m`;
  if (m) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export function fmtInt(n: number): string {
  return n.toLocaleString("en-US");
}

export function pct(n: number | null | undefined): string {
  return n === null || n === undefined ? "–" : `${Math.round(n * 100)}%`;
}
