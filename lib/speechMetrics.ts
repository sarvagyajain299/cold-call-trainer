export type DgWord = { word: string; start: number; end: number; confidence: number };

export type SpeechSummary = {
  wordCount: number;
  talkSecs: number;
  wpm: number;
  fillerCount: number;
  fillersPerMin: number;
  avgConfidence: number;
  lowConfidenceShare: number;
  /** 0-100, higher is clearer. Derived from Deepgram word confidence. */
  clarityScore: number;
  lowConfidenceWords: { word: string; at: number; confidence: number }[];
  longPauses: { at: number; secs: number }[];
  longestRunSecs: number;
};

const FILLERS = new Set(["um", "uh", "uhm", "umm", "er", "erm", "hmm", "mm"]);
const LOW_CONFIDENCE = 0.75;
const LONG_PAUSE_SECS = 1.5;
const RUN_BREAK_SECS = 1.0;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const round1 = (n: number) => Math.round(n * 10) / 10;
const norm = (w: string) => w.toLowerCase().replace(/[^a-z']/g, "");

export function summarizeSpeech(words: DgWord[]): SpeechSummary {
  const spoken = words.filter((w) => norm(w.word));
  if (spoken.length === 0) {
    return {
      wordCount: 0, talkSecs: 0, wpm: 0, fillerCount: 0, fillersPerMin: 0, avgConfidence: 0,
      lowConfidenceShare: 0, clarityScore: 0, lowConfidenceWords: [], longPauses: [], longestRunSecs: 0,
    };
  }

  const fillers = spoken.filter((w) => FILLERS.has(norm(w.word)));
  const content = spoken.filter((w) => !FILLERS.has(norm(w.word)));

  // Time actually spent speaking: sum of word spans plus the short gaps between them, skipping long pauses.
  let talkSecs = 0;
  let runStart = spoken[0].start;
  let runEnd = spoken[0].end;
  let longestRun = 0;
  const longPauses: SpeechSummary["longPauses"] = [];
  for (let i = 1; i < spoken.length; i++) {
    const gap = spoken[i].start - spoken[i - 1].end;
    if (gap >= LONG_PAUSE_SECS) longPauses.push({ at: round1(spoken[i - 1].end), secs: round1(gap) });
    if (gap >= RUN_BREAK_SECS) {
      talkSecs += runEnd - runStart;
      longestRun = Math.max(longestRun, runEnd - runStart);
      runStart = spoken[i].start;
    }
    runEnd = spoken[i].end;
  }
  talkSecs += runEnd - runStart;
  longestRun = Math.max(longestRun, runEnd - runStart);

  const avg = content.length ? content.reduce((s, w) => s + w.confidence, 0) / content.length : 0;
  const low = content.filter((w) => w.confidence < LOW_CONFIDENCE);
  const lowShare = content.length ? low.length / content.length : 0;

  return {
    wordCount: spoken.length,
    talkSecs: round1(talkSecs),
    wpm: talkSecs > 0 ? Math.round((spoken.length / talkSecs) * 60) : 0,
    fillerCount: fillers.length,
    fillersPerMin: talkSecs > 0 ? round1((fillers.length / talkSecs) * 60) : 0,
    avgConfidence: Math.round(avg * 1000) / 1000,
    lowConfidenceShare: Math.round(lowShare * 1000) / 1000,
    clarityScore: Math.round(clamp(100 - (1 - avg) * 200 - lowShare * 100, 0, 100)),
    lowConfidenceWords: low
      .sort((a, b) => a.confidence - b.confidence)
      .slice(0, 15)
      .map((w) => ({ word: w.word, at: round1(w.start), confidence: Math.round(w.confidence * 100) / 100 })),
    longPauses: longPauses.slice(0, 10),
    longestRunSecs: round1(longestRun),
  };
}

/** Speech stats for one trainee turn: words that start inside [from, to). */
export function windowSpeech(words: DgWord[], from: number, to: number): SpeechSummary {
  return summarizeSpeech(words.filter((w) => w.start >= from && w.start < to));
}
