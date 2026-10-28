import { describe, expect, it } from "vitest";
import { cleanTurn, toTurns, formatTranscript } from "./transcript";
import { summarizeSpeech, windowSpeech, type DgWord } from "./speechMetrics";
import { summarizeVoice, type VoiceSample } from "./voiceMetrics";
import { quoteAppears, keepVerified } from "./reportVerify";

describe("transcript cleaning", () => {
  it("strips voice tags into cues and keeps the words", () => {
    expect(cleanTurn("[sighs] Aman? No, brother, wrong name. [annoyed] Say it quick.")).toEqual({
      text: "Aman? No, brother, wrong name. Say it quick.",
      cues: ["sighs", "annoyed"],
    });
  });

  it("maps roles, drops empty turns, and formats for the scorer", () => {
    const turns = toTurns([
      { role: "agent", message: "Yes, hello?", time_in_call_secs: 0 },
      { role: "user", message: "Hello, this is Frankie.", time_in_call_secs: 1.04 },
      { role: "agent", message: "", time_in_call_secs: 219 },
    ]);
    expect(turns).toHaveLength(2);
    expect(turns[1]).toMatchObject({ role: "trainee", t: 1 });
    expect(formatTranscript(turns)).toBe("[0s] PROSPECT: Yes, hello?\n[1s] TRAINEE: Hello, this is Frankie.");
  });
});

const word = (w: string, start: number, confidence = 0.95, len = 0.3): DgWord => ({ word: w, start, end: start + len, confidence });

describe("speech metrics", () => {
  it("counts fillers, finds long pauses and low-confidence words", () => {
    const words = [
      word("hello", 0), word("um", 0.4), word("this", 0.8), word("is", 1.1, 0.4), word("frankie", 1.4),
      word("we", 4.0), word("build", 4.3), word("websites", 4.6, 0.5),
    ];
    const s = summarizeSpeech(words);
    expect(s.fillerCount).toBe(1);
    expect(s.longPauses).toEqual([{ at: 1.7, secs: 2.3 }]);
    expect(s.lowConfidenceWords.map((w) => w.word)).toEqual(["is", "websites"]);
    expect(s.clarityScore).toBeLessThan(90);
  });

  it("scores clean speech as clear", () => {
    const clean = Array.from({ length: 40 }, (_, i) => word(`word${i}`, i * 0.35, 0.98));
    expect(summarizeSpeech(clean).clarityScore).toBeGreaterThan(95);
  });

  it("returns zeros for no words and windows by start time", () => {
    expect(summarizeSpeech([]).wordCount).toBe(0);
    const words = [word("a", 0), word("b", 5), word("c", 6)];
    expect(windowSpeech(words, 4, 10).wordCount).toBe(2);
  });
});

/** 10 samples per second. Builds `secs` of one sentence, then 0.6s of silence. */
function sentence(startT: number, secs: number, pitch: (i: number, n: number) => number, db: (i: number, n: number) => number): VoiceSample[] {
  const n = Math.round(secs * 10);
  const out: VoiceSample[] = [];
  for (let i = 0; i < n; i++) out.push([startT + i / 10, db(i, n), pitch(i, n), 0.95]);
  for (let i = 0; i < 6; i++) out.push([startT + secs + i / 10, -70, 0, 0.1]);
  return out;
}

describe("voice metrics", () => {
  const build = (pitch: (i: number, n: number) => number, db: (i: number, n: number) => number) => {
    const all: VoiceSample[] = [];
    let t = 0;
    for (let k = 0; k < 8; k++) {
      const s = sentence(t, 3, pitch, db);
      all.push(...s);
      t += 3.6;
    }
    return all;
  };

  it("rates a flat voice as monotone and a lively voice as not", () => {
    const flat = summarizeVoice(build(() => 150, () => -30));
    const lively = summarizeVoice(build((i) => 150 * 2 ** (Math.sin(i / 3) * 4 / 12), () => -30));
    expect(flat.monotoneScore).toBeGreaterThan(90);
    expect(lively.monotoneScore).toBeLessThan(40);
  });

  it("detects sentences that trail off", () => {
    const fading = summarizeVoice(build(() => 150, (i, n) => (i > n * 0.8 ? -42 : -30)));
    const steady = summarizeVoice(build(() => 150, () => -30));
    expect(fading.trailingOffShare).toBe(1);
    expect(steady.trailingOffShare).toBe(0);
  });

  it("detects questions ending on a rising pitch", () => {
    const rising = summarizeVoice(build((i, n) => (i > n * 0.85 ? 150 * 2 ** (3 / 12) : 150), () => -30));
    expect(rising.risingEndShare).toBeGreaterThan(0.8);
  });

  it("returns an empty summary when there is too little audio", () => {
    expect(summarizeVoice([[0, -30, 150, 0.9]]).sentences).toBe(0);
  });
});

describe("quote verification", () => {
  const turns = toTurns([
    { role: "agent", message: "[sighs] Of course I have a website, brother. Did you even look before you called?", time_in_call_secs: 25 },
    { role: "user", message: "Are you happy with your current website? Is it converting properly?", time_in_call_secs: 37 },
  ]);

  it("accepts real quotes, ignoring case and punctuation", () => {
    expect(quoteAppears("are you happy with your current website", turns, "trainee")).toBe(true);
    expect(quoteAppears("Did you even look before you called", turns, "prospect")).toBe(true);
  });

  it("accepts ellipsis quotes when every fragment is real", () => {
    expect(quoteAppears("Are you happy ... converting properly", turns)).toBe(true);
    expect(quoteAppears("Are you happy ... guaranteed refund", turns)).toBe(false);
  });

  it("rejects invented quotes and wrong speakers", () => {
    expect(quoteAppears("we guarantee ten times more leads", turns)).toBe(false);
    expect(quoteAppears("Are you happy with your current website", turns, "prospect")).toBe(false);
  });

  it("keepVerified drops the invented ones and counts them", () => {
    const { kept, dropped } = keepVerified(
      [{ quote: "Is it converting properly" }, { quote: "I promise a refund" }],
      turns,
    );
    expect(kept).toHaveLength(1);
    expect(dropped).toBe(1);
  });
});
