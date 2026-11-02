// Turns the report's separate lists into one chronological timeline, and builds the one-line
// summaries shown on collapsed sections. Pure functions, no AI. Old reports have no oneLine or tag;
// those fall back to the first sentence.

import type { Analysis } from "@/lib/report";

export type TimelineType = "win" | "miss" | "objection" | "signal" | "voice" | "feeling";

export type TimelineItem = {
  id: string;
  type: TimelineType;
  timeSecs: number;
  tag: string;
  oneLine: string;
  quote?: string;
  speaker?: "trainee" | "prospect";
  detail: { label: string; text: string }[];
  /** A better line the user could save to their cheat sheet (Phase 5). */
  better?: { label: string; text: string };
  score?: number;
  note?: string;
};

export const TYPE_LABEL: Record<TimelineType, string> = {
  win: "Win",
  miss: "Miss",
  objection: "Objection",
  signal: "Signal",
  voice: "Voice",
  feeling: "Feeling",
};

export function firstSentence(text: string): string {
  const t = (text ?? "").trim();
  const m = t.match(/^[\s\S]*?[.!?](?=\s|$)/);
  const s = (m ? m[0] : t).trim();
  return s.length > 140 ? `${s.slice(0, 137).trimEnd()}...` : s;
}

type Loose = { oneLine?: string; tag?: string };
const one = (item: Loose, fallback: string) => (item.oneLine?.trim() ? item.oneLine.trim() : firstSentence(fallback));

export function buildTimeline(a: Analysis): TimelineItem[] {
  const items: TimelineItem[] = [];

  a.moments.forEach((m, i) => {
    items.push({
      id: `m${i}`,
      type: m.kind,
      timeSecs: m.timeSecs,
      tag: (m as Loose).tag ?? "",
      oneLine: one(m as Loose, m.what),
      quote: m.quote,
      speaker: m.speaker,
      detail: [
        { label: "What happened", text: m.what },
        { label: "Why it matters", text: m.why },
      ],
      better: m.betterLine ? { label: "A top closer would say", text: m.betterLine } : undefined,
    });
  });

  a.objections.forEach((o, i) => {
    items.push({
      id: `o${i}`,
      type: "objection",
      timeSecs: o.timeSecs,
      tag: (o as Loose).tag ?? "",
      oneLine: one(o as Loose, o.howHandled),
      quote: o.quote,
      speaker: "prospect",
      score: o.score,
      note: o.realObjection ? "real objection" : "reflex brush-off",
      detail: [{ label: "How you handled it", text: o.howHandled }],
      better: { label: "Better response", text: o.betterResponse },
    });
  });

  a.missedSignals.forEach((s, i) => {
    items.push({
      id: `s${i}`,
      type: "signal",
      timeSecs: s.timeSecs,
      tag: (s as Loose).tag ?? "",
      oneLine: one(s as Loose, s.meaning),
      quote: s.quote,
      speaker: "prospect",
      detail: [
        { label: "What it meant", text: s.meaning },
        { label: "Do this", text: s.whatToDo },
      ],
    });
  });

  a.voice.issues.forEach((v, i) => {
    items.push({ id: `v${i}`, type: "voice", timeSecs: v.timeSecs, tag: "", oneLine: v.note, detail: [] });
  });

  a.personaReveal.feelings.forEach((f, i) => {
    items.push({
      id: `f${i}`,
      type: "feeling",
      timeSecs: f.timeSecs,
      tag: "",
      oneLine: f.feeling,
      detail: [{ label: "Why", text: f.why }],
    });
  });

  return items.sort((x, y) => x.timeSecs - y.timeSecs);
}

export function timelineCounts(items: TimelineItem[]): Record<TimelineType, number> {
  const c: Record<TimelineType, number> = { win: 0, miss: 0, objection: 0, signal: 0, voice: 0, feeling: 0 };
  for (const it of items) c[it.type]++;
  return c;
}

/** "weakest: Opener 1/10, best: Discovery 5/10" over stages, goal clarity, call control and cultural fit. */
export function scoreboardSummary(a: Analysis, stageLabel: (s: string) => string): string {
  const all = [
    ...a.stages.map((s) => ({ name: stageLabel(s.stage), score: s.score })),
    { name: "Goal clarity", score: a.goalClarity.score },
    { name: "Call control", score: a.callControl.score },
    { name: "Cultural fit", score: a.culturalFit.score },
  ];
  const sorted = [...all].sort((x, y) => x.score - y.score);
  const weak = sorted[0];
  const best = sorted[sorted.length - 1];
  return `weakest: ${weak.name} ${weak.score}/10 · best: ${best.name} ${best.score}/10`;
}

/** Plain "Got the ask?" derived from the outcome the coach already gives. */
export function gotTheAsk(outcome: Analysis["outcome"]): "Yes" | "Partly" | "No" {
  if (outcome === "meeting_booked") return "Yes";
  if (outcome === "callback_agreed" || outcome === "info_requested") return "Partly";
  return "No";
}
