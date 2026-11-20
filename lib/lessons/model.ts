// Pure lesson logic: safe to import on the client. No database, no AI.
import type { Turn } from "@/lib/transcript";

export const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_ATTEMPTS = 3;
export const WPM_TARGET = { min: 140, max: 160 };

export type LessonStatus = "not_started" | "in_progress" | "done" | "skipped";

export type Clip = { t: number; end: number };

export type GutCheck =
  | { mode: "review"; selfReview: string; reconcile: string }
  | { mode: "pick"; options: { label: string; reconcile: string }[] };

export type Check = { id: string; label: string; criterion: string };

export type LessonData = {
  prospectName: string;
  gutCheck?: GutCheck;
  findIt: { prompt: string; correctTurnIds: string[]; hint: string; explanation: string; clip?: Clip };
  choose: {
    prospectQuote: string;
    clip?: Clip;
    options: { text: string; kind: "yours" | "model" | "distractor" }[];
    rightExplanation: string;
    wrongHint: string;
    reaction?: { text: string; clip: Clip };
  };
  ruleScreen: { before: { text: string; words: number; clip?: Clip }; after: { text: string; words: number } };
  practice: { prospectQuestion: string; clip?: Clip; context: string; checks: Check[]; modelLine: string };
  cueCard: { label: string; line: string };
  /** 0 = guarded ... 4 = open, one per persona-reveal feeling. */
  feelingLevels: number[];
  /** Screen indexes the user skipped. */
  skipped: number[];
};

export type Lesson = {
  id: string;
  sessionId: string;
  ord: number;
  title: string;
  rule: string;
  data: LessonData;
  status: LessonStatus;
  screen: number;
  gutPick: string | null;
  bestScore: number | null;
  reviewStep: number;
  nextReviewAt: number | null;
};

export type CheckResult = { id: string; pass: boolean; reason: string };

export type AttemptResult = {
  verdict: string;
  checks: CheckResult[];
  tip: string;
  comparedToLast: string;
};

export type Attempt = {
  id: string;
  attemptNumber: number;
  mode: "voice" | "typed";
  transcript: string;
  wpm: number | null;
  score: number | null;
  result: AttemptResult | null;
  error: string | null;
};

export const turnId = (index: number) => `t${index}`;
export const turnIndex = (id: string): number => (/^t(\d+)$/.test(id) ? Number(id.slice(1)) : -1);

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export type Lane = { id: string; index: number; role: Turn["role"]; start: number; end: number; x: number; w: number; words: number };

/** One bar per turn, from its start to the next turn's start, as fractions (0..1) of the call. */
export function turnLanes(turns: Turn[], durationSecs: number): Lane[] {
  if (turns.length === 0) return [];
  const last = turns[turns.length - 1];
  const lastEnd = durationSecs > last.t ? durationSecs : last.t + Math.max(2, wordCount(last.text) * 0.4);
  const total = Math.max(lastEnd, 1);
  return turns.map((turn, i) => {
    const end = i + 1 < turns.length ? turns[i + 1].t : lastEnd;
    return {
      id: turnId(i),
      index: i,
      role: turn.role,
      start: turn.t,
      end,
      x: turn.t / total,
      w: Math.max(0, end - turn.t) / total,
      words: wordCount(turn.text),
    };
  });
}

/** Clip times for a turn: from its start to the next turn's start. */
export function clipFor(turns: Turn[], index: number, durationSecs: number): Clip | undefined {
  const turn = turns[index];
  if (!turn) return undefined;
  const end = turns[index + 1]?.t ?? (durationSecs > turn.t ? durationSecs : turn.t + 10);
  return { t: turn.t, end };
}

export function nextProspectTurn(turns: Turn[], afterIndex: number): { turn: Turn; index: number } | null {
  for (let i = afterIndex + 1; i < turns.length; i++) {
    if (turns[i].role === "prospect") return { turn: turns[i], index: i };
  }
  return null;
}

export function nextTraineeTurn(turns: Turn[], afterIndex: number): { turn: Turn; index: number } | null {
  for (let i = afterIndex + 1; i < turns.length; i++) {
    if (turns[i].role === "trainee") return { turn: turns[i], index: i };
  }
  return null;
}

const FILLER = /,?\s*\b(?:uh+|um+|uhm|erm|er|ah+|hmm+)\b,?/gi;
const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");
const trailingPunct = (w: string) => /[^\p{L}\p{N}']*$/u.exec(w)?.[0] ?? "";
const stripPunct = (w: string) => w.replace(/[^\p{L}\p{N}']+$/u, "");

/** What the trainee said, minus fillers, stutters and repeats, cut at about `maxWords`. */
export function cleanReply(text: string, maxWords = 45): string {
  const tokens = text
    .replace(FILLER, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .trim()
    .split(" ")
    .filter((w) => w && !/-$/.test(w)); // dropped half-words like "al-"

  // Remove an immediate repeat of 1 to 8 words ("this is, this is" or a repeated sentence).
  for (let i = 0; i < tokens.length; i++) {
    for (let len = Math.min(8, Math.floor((tokens.length - i) / 2)); len >= 1; len--) {
      let same = true;
      for (let k = 0; k < len; k++) {
        if (norm(tokens[i + k]) !== norm(tokens[i + len + k]) || !norm(tokens[i + k])) {
          same = false;
          break;
        }
      }
      if (same) {
        const lastOfRepeat = tokens[i + 2 * len - 1];
        tokens[i + len - 1] = stripPunct(tokens[i + len - 1]) + trailingPunct(lastOfRepeat);
        tokens.splice(i + len, len);
        len = Math.min(9, Math.floor((tokens.length - i) / 2) + 1); // look again at the same place
      }
    }
  }

  if (tokens[0]) tokens[0] = tokens[0].charAt(0).toUpperCase() + tokens[0].slice(1);

  if (tokens.length <= maxWords) return tokens.join(" ");
  const cut = tokens.slice(0, maxWords);
  cut[cut.length - 1] = stripPunct(cut[cut.length - 1]) + "…";
  return cut.join(" ");
}

export function wpm(words: number, speakingSec: number): number | null {
  if (!speakingSec || speakingSec <= 0 || words <= 0) return null;
  return Math.round((words / speakingSec) * 60);
}

/**
 * Spaced review. Under 7 comes back tomorrow and restarts; 7 or more climbs 3 days, then 7 days,
 * and after that the lesson needs no more reviews (at = null).
 */
export function nextReview(score: number, step: number, now: number): { at: number | null; step: number } {
  if (score < 7) return { at: now + DAY_MS, step: 0 };
  if (step <= 0) return { at: now + 3 * DAY_MS, step: 1 };
  if (step === 1) return { at: now + 7 * DAY_MS, step: 2 };
  return { at: null, step: 2 };
}

function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Same order every time for the same seed, so a revisit shows the same options. */
export function shuffle<T>(items: T[], seed: string): T[] {
  const out = [...items];
  const rand = seeded(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export type FeelingStep = { x: number; x2: number; level: number; t: number; feeling: string };

/** The prospect's feelings as steps across the call (x as 0..1), each held until the next change. */
export function feelingSteps(feelings: { timeSecs: number; feeling?: string }[], levels: number[], durationSecs: number): FeelingStep[] {
  const sorted = feelings.map((f, i) => ({ t: f.timeSecs, level: levels[i], feeling: f.feeling ?? "" })).sort((a, b) => a.t - b.t);
  const total = Math.max(durationSecs, sorted[sorted.length - 1]?.t ?? 0, 1);
  return sorted.map((f, i) => ({
    x: Math.min(1, f.t / total),
    x2: i + 1 < sorted.length ? Math.min(1, sorted[i + 1].t / total) : 1,
    level: Number.isFinite(f.level) ? Math.max(0, Math.min(4, Math.round(f.level))) : 2,
    t: f.t,
    feeling: f.feeling,
  }));
}

/** The line for the cue card: your best attempt if it scored 8 or more, otherwise the model line. */
export function cueLine(modelLine: string, attempts: { score: number | null; transcript: string }[]): string {
  const best = attempts.filter((a) => (a.score ?? 0) >= 8).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
  return best ? best.transcript : modelLine;
}

export const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
