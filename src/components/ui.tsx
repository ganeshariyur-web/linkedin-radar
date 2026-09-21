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

/** A metric in the strip: small-caps label over a large serif numeral. */
export function Tile({ label, value, hint, accent = false }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className="min-w-0">
      <Label>{label}</Label>
      <div className={`display-num text-[28px] md:text-[34px] mt-2 truncate ${accent ? "text-accent" : ""}`} title={hint}>
        {value}
      </div>
    </div>
  );
}

/** Section header: italic numeral, small caps title, hairline. */
export function SectionHead({ n, title, right }: { n?: string; title: string; right?: ReactNode }) {
  return (
    <div className="sec">
      {n && <span className="n">{n}</span>}
      <span className="label !text-fg-2">{title}</span>
      <span className="ml-auto">{right}</span>
    </div>
  );
}

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="mt-6">
      <SectionHead title={title} right={right} />
      {children}
    </section>
  );
}

export function Pill({ children, active = false, onClick }: { children: ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`pill ${active ? "active" : ""}`}>
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
