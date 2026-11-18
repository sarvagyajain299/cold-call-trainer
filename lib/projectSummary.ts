/** Pure numbers for one project's page: calls made, scored, average and best rating, latest focus. */
export type ScoredCall = { createdAt: number; rating: number; focus: string };

export type ProjectSummary = {
  calls: number;
  scored: number;
  average: number | null;
  best: number | null;
  latestFocus: string | null;
};

export function summarise(totalCalls: number, scored: ScoredCall[]): ProjectSummary {
  if (scored.length === 0) return { calls: totalCalls, scored: 0, average: null, best: null, latestFocus: null };
  const ratings = scored.map((s) => s.rating);
  const latest = [...scored].sort((a, b) => b.createdAt - a.createdAt)[0];
  return {
    calls: totalCalls,
    scored: scored.length,
    average: Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10,
    best: Math.max(...ratings),
    latestFocus: latest.focus || null,
  };
}
