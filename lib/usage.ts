// Cost meter: records the real token counts of every Claude call.

// USD per million tokens. Opus 5.5.
const PRICES: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.4, cacheWrite: 5 },
};

export type TokenUsage = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
};

export function costUsd(model: string, u: TokenUsage): number {
  const p = PRICES[model];
  if (!p) return 0;
  return (
    ((u.input_tokens ?? 0) * p.input +
      (u.output_tokens ?? 0) * p.output +
      (u.cache_read_input_tokens ?? 0) * p.cacheRead +
      (u.cache_creation_input_tokens ?? 0) * p.cacheWrite) /
    1_000_000
  );
}

/** Never throws: a logging problem must not break a call or a scorecard. */
export async function logUsage(sessionId: string | null, kind: string, model: string, u: TokenUsage) {
  try {
    const { sqlite } = await import("@/lib/db");
    sqlite
      .prepare(
        "INSERT INTO llm_usage (session_id, kind, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost_usd, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
      )
      .run(
        sessionId,
        kind,
        model,
        u.input_tokens ?? 0,
        u.output_tokens ?? 0,
        u.cache_read_input_tokens ?? 0,
        u.cache_creation_input_tokens ?? 0,
        costUsd(model, u),
        Date.now(),
      );
  } catch (err) {
    console.error("could not log usage", err);
  }
}

export type UsageRow = { kind: string; input: number; output: number; cost: number };

export async function usageForSession(sessionId: string): Promise<{ rows: UsageRow[]; total: number }> {
  const { sqlite } = await import("@/lib/db");
  const rows = sqlite
    .prepare(
      "SELECT kind, SUM(input_tokens) AS input, SUM(output_tokens) AS output, SUM(cost_usd) AS cost FROM llm_usage WHERE session_id = ? GROUP BY kind ORDER BY MIN(created_at)",
    )
    .all(sessionId) as UsageRow[];
  return { rows, total: rows.reduce((s, r) => s + r.cost, 0) };
}
