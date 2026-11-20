import type { StoredReport } from "@/lib/scoring";

/** The headline's first sentence (a full stop followed by a space and a capital letter ends it). */
export function firstSentence(text: string): string {
  const m = /^(.+?[.!?])\s+(?=[A-Z])/.exec(text.trim());
  return m ? m[1] : text.trim();
}

const round = (n: number) => Math.round(n * 10) / 10;

function change(cur: number, prev: number | null, unit: string): string {
  if (prev === null) return "";
  const d = round(cur - prev);
  if (d === 0) return ", same as last call";
  return `, ${d > 0 ? "up" : "down"} ${Math.abs(d)}${unit} from last call`;
}

/** Rating and chance of the goal as "up from last call" lines, not giant numbers. */
export function lessonHomeSummary(cur: StoredReport, prev: StoredReport | null) {
  const a = cur.analysis;
  return {
    headline: firstSentence(a.headline),
    lines: [
      `Rating ${a.overallRating}/10${change(a.overallRating, prev?.analysis.overallRating ?? null, "")}`,
      `Chance of the goal ${a.conversionScore}%${change(a.conversionScore, prev?.analysis.conversionScore ?? null, "")}`,
    ],
  };
}
