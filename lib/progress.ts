// Progress across everyone you have called: series per metric (oldest first) and habit counts. Pure code.

import { METRICS, type MetricDef } from "@/lib/compare";
import { HABITS } from "@/lib/habits";
import type { StoredReport } from "@/lib/scoring";

export type Series = {
  def: MetricDef;
  values: number[];
  latest: number;
  /** Average of the first calls vs average of the latest calls (up to 3 each; first vs last when fewer than 4). */
  from: number;
  to: number;
  direction: "up" | "down" | "same";
  good: boolean;
};

const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
const round1 = (n: number) => Math.round(n * 10) / 10;

export function buildSeries(reportsOldestFirst: StoredReport[]): Series[] {
  const out: Series[] = [];
  for (const def of METRICS) {
    const values = reportsOldestFirst.map((r) => def.get(r)).filter((v): v is number => v !== null);
    if (values.length < 2) continue;
    const k = values.length >= 4 ? 3 : 1;
    const from = round1(avg(values.slice(0, k)));
    const to = round1(avg(values.slice(-k)));
    const delta = to - from;
    const real = Math.abs(delta) >= def.step;
    const good = !real
      ? false
      : def.better === "higher"
        ? delta > 0
        : def.better === "lower"
          ? delta < 0
          : Math.abs(to - (def.target as number)) < Math.abs(from - (def.target as number));
    out.push({ def, values, latest: values[values.length - 1], from, to, direction: real ? (delta > 0 ? "up" : "down") : "same", good });
  }
  return out;
}

export type Point = {
  sessionId: string;
  createdAt: number;
  name: string;
  difficulty: string;
  value: number;
};

/** One point per scored call (oldest first) for a single metric. Calls that lack the metric are skipped. */
export function metricPoints(
  rowsOldestFirst: { id: string; createdAt: number; difficulty: string; report: StoredReport }[],
  key: string,
): { def: MetricDef; points: Point[] } | null {
  const def = METRICS.find((m) => m.key === key);
  if (!def) return null;
  const points: Point[] = [];
  for (const r of rowsOldestFirst) {
    const v = def.get(r.report);
    if (v === null) continue;
    points.push({ sessionId: r.id, createdAt: r.report.createdAt, name: r.report.persona.name, difficulty: r.difficulty, value: v });
  }
  return { def, points };
}

export type HabitCount ={ id: string; label: string; calls: number; outOf: number };

/** Per habit: in how many of the latest `window` tagged calls did it appear? Calls without tag data are ignored. */
export function countHabits(reportsNewestFirst: StoredReport[], window = 10): HabitCount[] {
  const tagged = reportsNewestFirst
    .map((r) => {
      const a = r.analysis as unknown as {
        moments: { kind: string; tag?: string }[];
        objections: { tag?: string }[];
        missedSignals: { tag?: string }[];
        topFixes: { tag?: string }[];
      };
      const tags = new Set<string>();
      for (const m of a.moments) if (m.kind === "miss" && m.tag) tags.add(m.tag);
      for (const x of [...a.objections, ...a.missedSignals, ...a.topFixes]) if (x.tag) tags.add(x.tag);
      return { tags, hasTagData: [...a.moments, ...a.topFixes].some((x) => "tag" in x) };
    })
    .filter((t) => t.hasTagData)
    .slice(0, window);

  const counts = new Map<string, number>();
  for (const t of tagged) for (const id of t.tags) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([id]) => id in HABITS)
    .map(([id, calls]) => ({ id, label: HABITS[id], calls, outOf: tagged.length }))
    .sort((a, b) => b.calls - a.calls);
}
