import { NextRequest } from "next/server";
import { COMPANY_ACTOR, PROFILE_ACTOR, actorErrorOf, estimateUsd, mapCompanyItem, mapProfileItem, type ActorConfig } from "@/config/apify";
import { abortRun, datasetItemCount, getItems, getRun, listRecentRuns, startRun, TERMINAL } from "@/lib/apify-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const LINKEDIN_PROFILE = /^https?:\/\/([a-z]{2,3}\.)?linkedin\.com\/in\/[^/?#]+\/?$/i;
const LINKEDIN_COMPANY = /^https?:\/\/([a-z]{2,3}\.)?linkedin\.com\/company\/[^/?#]+\/?$/i;

function actorFor(kind: string): ActorConfig | null {
  if (kind === "profile") return PROFILE_ACTOR;
  if (kind === "company") return COMPANY_ACTOR;
  return null;
}

/**
 * POST { action: "start", kind: "profile" | "company", urls: string[] }  → starts one Apify run (≤ 100 URLs)
 * POST { action: "abort", runId }
 * GET  ?runId=&datasetId=&offset=&kind=                                   → status + newly available mapped items
 * GET  ?action=recent                                                      → recent runs of the configured actors (for recovery)
 * Only LinkedIn profile or company URLs are accepted; nothing else leaves the browser.
 */
export async function POST(req: NextRequest) {
  if (!process.env.APIFY_TOKEN) return json({ error: "APIFY_TOKEN is not configured on the server." }, 503);
  let body: { action?: string; kind?: string; urls?: unknown; runId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }
  if (body.action === "abort") {
    if (!body.runId || typeof body.runId !== "string") return json({ error: "runId required." }, 400);
    const run = await abortRun(body.runId);
    return json({ status: run.status });
  }
  if (body.action !== "start") return json({ error: 'action must be "start" or "abort".' }, 400);
  const actor = actorFor(body.kind ?? "");
  if (!actor) return json({ error: 'kind must be "profile" or "company".' }, 400);
  if (!Array.isArray(body.urls) || body.urls.length === 0) return json({ error: "urls must be a non-empty array." }, 400);
  if (body.urls.length > actor.maxItemsPerRun) return json({ error: `At most ${actor.maxItemsPerRun} URLs per run.` }, 413);
  const re = body.kind === "profile" ? LINKEDIN_PROFILE : LINKEDIN_COMPANY;
  const urls: string[] = [];
  for (const u of body.urls) {
    if (typeof u !== "string" || !re.test(u.trim())) return json({ error: `Not a LinkedIn ${body.kind} URL: ${String(u).slice(0, 80)}` }, 422);
    urls.push(u.trim());
  }
  try {
    const run = await startRun(actor.actorId, actor.buildInput(urls));
    return json({ runId: run.id, datasetId: run.defaultDatasetId, status: run.status, actor: actor.slug, count: urls.length, estimateUsd: estimateUsd(actor, urls.length) });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 502);
  }
}

export async function GET(req: NextRequest) {
  if (!process.env.APIFY_TOKEN) return json({ error: "APIFY_TOKEN is not configured on the server." }, 503);
  const sp = req.nextUrl.searchParams;
  if (sp.get("action") === "recent") {
    try {
      const ours = new Map([[PROFILE_ACTOR.actorId, "profile"], [COMPANY_ACTOR.actorId, "company"]]);
      const runs = (await listRecentRuns(25)).filter((r) => ours.has(r.actId));
      const out = await Promise.all(runs.map(async (r) => ({
        runId: r.id,
        datasetId: r.defaultDatasetId,
        kind: ours.get(r.actId),
        status: r.status,
        startedAt: r.startedAt,
        finishedAt: r.finishedAt ?? null,
        usd: r.usageTotalUsd ?? null,
        itemCount: r.stats?.datasetItemCount ?? (await datasetItemCount(r.defaultDatasetId)),
      })));
      return json({ runs: out });
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 502);
    }
  }
  const runId = sp.get("runId");
  const datasetId = sp.get("datasetId");
  const kind = sp.get("kind") ?? "profile";
  const offset = Math.max(0, Number(sp.get("offset") ?? 0) || 0);
  if (!runId || !datasetId) return json({ error: "runId and datasetId required." }, 400);
  try {
    const run = await getRun(runId);
    const raw = await getItems(datasetId, offset, 100);
    const actorError = actorErrorOf(raw);
    const items = raw.filter((it) => !(Object.keys(it).length <= 2 && typeof it.error === "string")).map((it) => (kind === "company" ? mapCompanyItem(it) : mapProfileItem(it)));
    return json({
      status: run.status,
      finished: TERMINAL.has(run.status),
      items,
      nextOffset: offset + raw.length,
      usageTotalUsd: run.usageTotalUsd ?? null,
      actorError,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 502);
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
