"use client";
// Zustand store with IndexedDB persistence (idb-keyval). Everything the user
// uploads or computes lives here, in their browser.

import { create } from "zustand";
import { get as idbGet, set as idbSet, del as idbDel } from "idb-keyval";
import type {
  ConnectionRow,
  Enrichment,
  InvitationRow,
  Pass,
  Preset,
  RowFlags,
  RowResult,
  Tab,
  UploadStats,
} from "./types";
import { buildDefaultPreset, DEFAULT_PRESET_NAME, normalizePreset } from "./presets";
import { matchInvitations } from "./join";

export type RunStatus = "idle" | "running" | "paused" | "done" | "error";

export interface RunState {
  status: RunStatus;
  tab: Tab | null;
  pass: Pass | null;
  startedAt: number | null;
  elapsedMs: number;
  rowsScored: number;
  answers: number;
  inputTokens: number;
  total: number;
  currentRowId: string | null;
  lastError: string | null;
  callCount: number;
}

export const idleRun: RunState = {
  status: "idle", tab: null, pass: null, startedAt: null, elapsedMs: 0, rowsScored: 0, answers: 0, inputTokens: 0, total: 0, currentRowId: null, lastError: null, callCount: 0,
};

export interface Upload<T> {
  rows: T[];
  stats: UploadStats;
}

export interface AppState {
  hydrated: boolean;
  connections: Upload<ConnectionRow> | null;
  invitations: Upload<InvitationRow> | null;
  results: Record<string, RowResult>; // `${rowId}|${pass}`
  enrichment: Record<string, Enrichment>;
  flags: Record<string, RowFlags>;
  presets: Preset[];
  activePresetName: string;
  run: RunState;
  selectedRowId: string | null;
  activeTab: Tab;
  theme: "light" | "dark" | "system";
  /** Cumulative Jev calls this session, for the "no new Jev calls" proof in the Studio. */
  jevCalls: number;

  hydrate: () => Promise<void>;
  setUpload: (tab: Tab, upload: Upload<ConnectionRow> | Upload<InvitationRow> | null) => void;
  setResults: (results: RowResult[]) => void;
  clearResults: (tab: Tab, pass: Pass) => void;
  setEnrichment: (items: Enrichment[]) => void;
  clearEnrichment: () => void;
  setFlag: (rowId: string, patch: Partial<RowFlags>) => void;
  setRun: (patch: Partial<RunState>) => void;
  setSelected: (rowId: string | null) => void;
  setActiveTab: (tab: Tab) => void;
  setTheme: (t: "light" | "dark" | "system") => void;
  savePreset: (p: Preset) => void;
  deletePreset: (name: string) => void;
  setActivePreset: (name: string) => void;
  resetDefaults: () => void;
  activePreset: () => Preset;
  bumpJevCalls: (n: number) => void;
}

export const resultKey = (rowId: string, pass: Pass) => `${rowId}|${pass}`;

const KEYS = {
  connections: "lr:connections",
  invitations: "lr:invitations",
  results: "lr:results",
  enrichment: "lr:enrichment",
  flags: "lr:flags",
  presets: "lr:presets",
  activePresetName: "lr:activePresetName",
  theme: "lr:theme",
} as const;

const timers: Partial<Record<keyof typeof KEYS, ReturnType<typeof setTimeout>>> = {};
function persist<K extends keyof typeof KEYS>(key: K, value: unknown) {
  if (typeof window === "undefined") return;
  clearTimeout(timers[key]);
  timers[key] = setTimeout(() => {
    (value === null || value === undefined ? idbDel(KEYS[key]) : idbSet(KEYS[key], value)).catch(() => {});
  }, 150);
}

function withMatches(state: Pick<AppState, "connections" | "invitations">): Upload<InvitationRow> | null {
  if (!state.invitations) return null;
  if (!state.connections) return { ...state.invitations, rows: state.invitations.rows.map((r) => ({ ...r, match: null })) };
  return { ...state.invitations, rows: matchInvitations(state.invitations.rows, state.connections.rows) };
}

export const useApp = create<AppState>((set, get) => ({
  hydrated: false,
  connections: null,
  invitations: null,
  results: {},
  enrichment: {},
  flags: {},
  presets: [buildDefaultPreset()],
  activePresetName: DEFAULT_PRESET_NAME,
  run: idleRun,
  selectedRowId: null,
  activeTab: "connections",
  theme: "system",
  jevCalls: 0,

  hydrate: async () => {
    if (typeof window === "undefined") return;
    try {
      const [connections, invitations, results, enrichment, flags, presets, activePresetName, theme] = await Promise.all([
        idbGet<Upload<ConnectionRow>>(KEYS.connections),
        idbGet<Upload<InvitationRow>>(KEYS.invitations),
        idbGet<Record<string, RowResult>>(KEYS.results),
        idbGet<Record<string, Enrichment>>(KEYS.enrichment),
        idbGet<Record<string, RowFlags>>(KEYS.flags),
        idbGet<Preset[]>(KEYS.presets),
        idbGet<string>(KEYS.activePresetName),
        idbGet<"light" | "dark" | "system">(KEYS.theme),
      ]);
      const normalizedPresets = (presets && presets.length ? presets : [buildDefaultPreset()]).map(normalizePreset);
      if (!normalizedPresets.some((p) => p.name === DEFAULT_PRESET_NAME)) normalizedPresets.unshift(buildDefaultPreset());
      const active = activePresetName && normalizedPresets.some((p) => p.name === activePresetName) ? activePresetName : DEFAULT_PRESET_NAME;
      const base = { connections: connections ?? null, invitations: invitations ?? null };
      set({
        ...base,
        invitations: withMatches(base),
        results: results ?? {},
        enrichment: enrichment ?? {},
        flags: flags ?? {},
        presets: normalizedPresets,
        activePresetName: active,
        theme: theme ?? "system",
        activeTab: connections ? "connections" : invitations ? "invitations" : "connections",
        hydrated: true,
      });
    } catch {
      set({ hydrated: true });
    }
  },

  setUpload: (tab, upload) => {
    const s = get();
    const base = {
      connections: tab === "connections" ? (upload as Upload<ConnectionRow> | null) : s.connections,
      invitations: tab === "invitations" ? (upload as Upload<InvitationRow> | null) : s.invitations,
    };
    const invitations = withMatches(base);
    // Keep the current tab if its file is (still) loaded; otherwise show whichever file exists, Connections first.
    const currentLoaded = s.activeTab === "connections" ? !!base.connections : !!base.invitations;
    const activeTab: Tab = currentLoaded ? s.activeTab : base.connections ? "connections" : base.invitations ? "invitations" : "connections";
    set({ connections: base.connections, invitations, activeTab, selectedRowId: null });
    persist("connections", base.connections);
    persist("invitations", base.invitations ? { ...base.invitations, rows: base.invitations.rows.map((r) => ({ ...r, match: null })) } : null);
  },

  setResults: (list) => {
    const results = { ...get().results };
    for (const r of list) results[resultKey(r.rowId, r.pass)] = r;
    set({ results });
    persist("results", results);
  },

  clearResults: (tab, pass) => {
    const prefix = tab === "connections" ? "c:" : "i:";
    const results: Record<string, RowResult> = {};
    for (const [k, v] of Object.entries(get().results)) {
      if (k.startsWith(prefix) && v.pass === pass) continue;
      results[k] = v;
    }
    set({ results });
    persist("results", results);
  },

  setEnrichment: (items) => {
    const enrichment = { ...get().enrichment };
    for (const e of items) enrichment[e.rowId] = e;
    set({ enrichment });
    persist("enrichment", enrichment);
  },

  clearEnrichment: () => {
    set({ enrichment: {} });
    persist("enrichment", null);
  },

  setFlag: (rowId, patch) => {
    const prev = get().flags[rowId] ?? { dmSent: false, accepted: false };
    const flags = { ...get().flags, [rowId]: { ...prev, ...patch } };
    set({ flags });
    persist("flags", flags);
  },

  setRun: (patch) => set({ run: { ...get().run, ...patch } }),
  setSelected: (rowId) => set({ selectedRowId: rowId }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setTheme: (theme) => {
    set({ theme });
    persist("theme", theme);
  },

  savePreset: (p) => {
    const presets = get().presets.filter((x) => x.name !== p.name);
    presets.push(normalizePreset(p));
    set({ presets, activePresetName: p.name });
    persist("presets", presets);
    persist("activePresetName", p.name);
  },

  deletePreset: (name) => {
    if (name === DEFAULT_PRESET_NAME) return;
    const presets = get().presets.filter((x) => x.name !== name);
    const active = get().activePresetName === name ? DEFAULT_PRESET_NAME : get().activePresetName;
    set({ presets, activePresetName: active });
    persist("presets", presets);
    persist("activePresetName", active);
  },

  setActivePreset: (name) => {
    if (!get().presets.some((p) => p.name === name)) return;
    set({ activePresetName: name });
    persist("activePresetName", name);
  },

  resetDefaults: () => {
    const presets = get().presets.filter((x) => x.name !== DEFAULT_PRESET_NAME);
    presets.unshift(buildDefaultPreset());
    set({ presets, activePresetName: DEFAULT_PRESET_NAME });
    persist("presets", presets);
    persist("activePresetName", DEFAULT_PRESET_NAME);
  },

  activePreset: () => {
    const s = get();
    return s.presets.find((p) => p.name === s.activePresetName) ?? s.presets[0] ?? buildDefaultPreset();
  },

  bumpJevCalls: (n) => set({ jevCalls: get().jevCalls + n }),
}));

/** Hook for the active preset (re-renders when presets or the active name change). */
export function useActivePreset(): Preset {
  return useApp((s) => s.presets.find((p) => p.name === s.activePresetName) ?? s.presets[0]);
}
