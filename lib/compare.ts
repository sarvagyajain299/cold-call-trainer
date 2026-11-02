// Free comparisons between scorecards. Pure code, no AI.
// An arrow is only shown for a REAL change: at least `step` in the metric's own units. The steps below are
// provisional (about one point on a 0-10 scale). Phase 3's variance test (re-scoring one call twice)
// decides whether they need to be wider.

import type { StoredReport } from "@/lib/scoring";

export type MetricDef = {
  key: string;
  label: string;
  group: "scores" | "stages" | "voice";
  /** Smallest change that counts as real, in display units. */
  step: number;
  better: "higher" | "lower" | "target";
  target?: number;
  unit: string;
  get: (r: StoredReport) => number | null;
};

const pct = (n: number) => Math.round(n * 100);

export const IDEAL_WPM = 145;

const stage = (key: string, label: string): MetricDef => ({
  key: `stage_${key}`,
  label,
  group: "stages",
  step: 1,
  better: "higher",
  unit: "/10",
  get: (r) => r.analysis.stages.find((s) => s.stage === key)?.score ?? null,
});

export const METRICS: MetricDef[] = [
  { key: "rating", label: "Overall rating", group: "scores", step: 1, better: "higher", unit: "/10", get: (r) => r.analysis.overallRating },
  { key: "conversion", label: "Chance of the goal", group: "scores", step: 10, better: "higher", unit: "%", get: (r) => r.analysis.conversionScore },
  stage("opener", "Opener"),
  stage("reason_for_call", "Reason for the call"),
  stage("discovery", "Discovery"),
  stage("value_pitch", "Value pitch"),
  stage("objection_handling", "Objection handling"),
  stage("close", "Close / next step"),
  { key: "goal_clarity", label: "Clarity of the goal", group: "stages", step: 1, better: "higher", unit: "/10", get: (r) => r.analysis.goalClarity.score },
  { key: "call_control", label: "Call control", group: "stages", step: 1, better: "higher", unit: "/10", get: (r) => r.analysis.callControl.score },
  { key: "energy", label: "Energy", group: "voice", step: 1, better: "higher", unit: "/10", get: (r) => r.analysis.voice.energy },
  { key: "confidence", label: "Confidence", group: "voice", step: 1, better: "higher", unit: "/10", get: (r) => r.analysis.voice.confidence },
  { key: "warmth", label: "Warmth", group: "voice", step: 1, better: "higher", unit: "/10", get: (r) => r.analysis.voice.warmth },
  { key: "voice_clarity", label: "Clarity (coach)", group: "voice", step: 1, better: "higher", unit: "/10", get: (r) => r.analysis.voice.clarity },
  { key: "pace", label: "Pace", group: "voice", step: 10, better: "target", target: IDEAL_WPM, unit: " wpm", get: (r) => (r.metrics.speech ? r.metrics.speech.wpm : null) },
  { key: "clear_words", label: "Words understood clearly", group: "voice", step: 5, better: "higher", unit: "%", get: (r) => (r.metrics.speech ? pct(1 - r.metrics.speech.lowConfidenceShare) : null) },
  { key: "fillers", label: "Fillers per minute", group: "voice", step: 1, better: "lower", unit: "/min", get: (r) => (r.metrics.speech ? r.metrics.speech.fillersPerMin : null) },
  { key: "trailing_off", label: "Sentences that trail off", group: "voice", step: 15, better: "lower", unit: "%", get: (r) => (r.metrics.voice && r.metrics.voice.sentences > 0 ? pct(r.metrics.voice.trailingOffShare) : null) },
  { key: "monotone", label: "Flatness", group: "voice", step: 10, better: "lower", unit: "/100", get: (r) => (r.metrics.voice && r.metrics.voice.sentences > 0 ? r.metrics.voice.monotoneScore : null) },
  { key: "talk_share", label: "Your share of the words", group: "voice", step: 10, better: "target", target: 45, unit: "%", get: (r) => pct(r.meta.traineeWordShare) },
];

export type Change = {
  key: string;
  label: string;
  prev: number;
  cur: number;
  unit: string;
  /** "up" / "down" are real changes; "same" is within normal noise. */
  direction: "up" | "down" | "same";
  /** Only meaningful when direction is not "same". */
  good: boolean;
};

function isGood(m: MetricDef, prev: number, cur: number): boolean {
  if (m.better === "higher") return cur > prev;
  if (m.better === "lower") return cur < prev;
  return Math.abs(cur - (m.target as number)) < Math.abs(prev - (m.target as number));
}

export function compareReports(cur: StoredReport, prev: StoredReport): Change[] {
  const out: Change[] = [];
  for (const m of METRICS) {
    const c = m.get(cur);
    const p = m.get(prev);
    if (c === null || p === null) continue;
    const delta = c - p;
    const real = Math.abs(delta) >= m.step;
    out.push({
      key: m.key,
      label: m.label,
      prev: p,
      cur: c,
      unit: m.unit,
      direction: !real ? "same" : delta > 0 ? "up" : "down",
      good: real ? isGood(m, p, c) : false,
    });
  }
  return out;
}

export type Comparison = {
  prevSessionId: string;
  prevCreatedAt: number;
  name: string;
  changes: Change[];
  /** Plain warnings, e.g. a different difficulty. */
  cautions: string[];
};

export function buildComparison(args: {
  cur: StoredReport;
  prev: StoredReport;
  prevSessionId: string;
  prevCreatedAt: number;
  curDifficulty: string;
  prevDifficulty: string;
  curPresetId: string;
  prevPresetId: string;
}): Comparison {
  const cautions: string[] = [];
  if (args.curDifficulty !== args.prevDifficulty) {
    cautions.push(`Different difficulty (${args.prevDifficulty} then, ${args.curDifficulty} now), so compare with care.`);
  }
  if (args.curPresetId !== args.prevPresetId) cautions.push("A different project, so the offer was not the same.");
  return {
    prevSessionId: args.prevSessionId,
    prevCreatedAt: args.prevCreatedAt,
    name: args.cur.persona.name.split(" ")[0],
    changes: compareReports(args.cur, args.prev),
    cautions,
  };
}

/** Newest earlier call by the same saved person that has a scorecard. */
export function findPrevious<T extends { id: string; createdAt: number; persona: string | null; report: string | null }>(
  current: { id: string; createdAt: number; persona: string | null },
  all: T[],
  keyOf: (personaJson: string) => string,
): T | null {
  if (!current.persona) return null;
  const key = keyOf(current.persona);
  const earlier = all
    .filter((s) => s.id !== current.id && s.report && s.persona && s.createdAt < current.createdAt && keyOf(s.persona) === key)
    .sort((a, b) => b.createdAt - a.createdAt);
  return earlier[0] ?? null;
}
