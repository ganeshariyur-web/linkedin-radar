export const JEV_USD_PER_MILLION_INPUT_TOKENS = 0.042;

export function costUsd(inputTokens: number): number {
  return (inputTokens / 1_000_000) * JEV_USD_PER_MILLION_INPUT_TOKENS;
}

export function formatCost(inputTokens: number): string {
  return `$${costUsd(inputTokens).toFixed(4)}`;
}

/** Estimate tokens for a run from measured averages, falling back to a default. */
export function estimateRun(rows: number, avgTokensPerRow: number | null, defaultTokens = 450): { tokens: number; usd: number } {
  const per = avgTokensPerRow && avgTokensPerRow > 0 ? avgTokensPerRow : defaultTokens;
  const tokens = Math.round(rows * per);
  return { tokens, usd: costUsd(tokens) };
}
