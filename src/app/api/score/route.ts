import { NextRequest } from "next/server";
import { PARALLEL_ROWS, validateScoreRequest } from "@/lib/score-validate";
import { runParallel, scoreRow, toJevQuestions } from "@/lib/jev";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/score
 * Body: { tab, pass, questions: QuestionSpec[], rows: [{ id, state }] } (≤ 50 rows)
 * Streams NDJSON: one line per row as it finishes, then { done: true, ... }.
 * Only contract fields are accepted in state; nothing is logged or stored.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }
  const v = validateScoreRequest(body);
  if (!v.ok) return json({ error: v.error, details: v.details }, v.status);
  if (!process.env.TYPESAFE_API_KEY) return json({ error: "TYPESAFE_API_KEY is not configured on the server." }, 503);

  const { questions, rows } = v.value;
  const jevQuestions = toJevQuestions(questions);
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const t0 = Date.now();
      let inputTokens = 0;
      let errors = 0;
      const tasks = rows.map((r) => () => scoreRow(r.id, r.state, questions, jevQuestions));
      await runParallel(tasks, PARALLEL_ROWS, (res) => {
        inputTokens += res.inputTokens;
        if (res.error) errors++;
        controller.enqueue(encoder.encode(JSON.stringify(res) + "\n"));
      });
      controller.enqueue(encoder.encode(JSON.stringify({ done: true, rows: rows.length, errors, inputTokens, elapsedMs: Date.now() - t0 }) + "\n"));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
