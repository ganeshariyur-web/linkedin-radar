// Server-only Apify REST helpers. APIFY_TOKEN never leaves the function.

const BASE = "https://api.apify.com/v2";

function token(): string {
  const t = process.env.APIFY_TOKEN;
  if (!t) throw new Error("APIFY_TOKEN is not configured on the server.");
  return t;
}

async function apify<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Apify ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

export interface RunInfo {
  id: string;
  status: string;
  defaultDatasetId: string;
  startedAt?: string;
  finishedAt?: string;
  usageTotalUsd?: number;
}

export async function startRun(actorId: string, input: Record<string, unknown>): Promise<RunInfo> {
  const r = await apify<{ data: RunInfo }>(`/acts/${actorId}/runs`, { method: "POST", body: JSON.stringify(input) });
  return r.data;
}

export async function getRun(runId: string): Promise<RunInfo> {
  const r = await apify<{ data: RunInfo }>(`/actor-runs/${runId}`);
  return r.data;
}

export async function abortRun(runId: string): Promise<RunInfo> {
  const r = await apify<{ data: RunInfo }>(`/actor-runs/${runId}/abort`, { method: "POST" });
  return r.data;
}

export async function getItems(datasetId: string, offset: number, limit = 100): Promise<Record<string, unknown>[]> {
  return apify<Record<string, unknown>[]>(`/datasets/${datasetId}/items?offset=${offset}&limit=${limit}&clean=true`);
}

export const TERMINAL = new Set(["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"]);
