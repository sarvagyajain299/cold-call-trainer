import { describe, expect, it } from "vitest";
import { buildTimeline, firstSentence, gotTheAsk, timelineCounts } from "@/lib/timeline";
import { normalizeTag } from "@/lib/habits";
import type { Analysis } from "@/lib/report";

const base = {
  moments: [
    { timeSecs: 30, speaker: "trainee", quote: "hi", kind: "miss", what: "Rushed it. Then more.", why: "w", betterLine: "Try this" },
    { timeSecs: 5, speaker: "prospect", quote: "ok", kind: "win", what: "Good start", why: "w", betterLine: "", oneLine: "Nice open", tag: "" },
  ],
  objections: [{ timeSecs: 20, quote: "no", realObjection: false, howHandled: "Argued.", score: 2, betterResponse: "Ask why" }],
  missedSignals: [{ timeSecs: 40, quote: "busy week", meaning: "Timing pain. Yes.", whatToDo: "Offer Friday" }],
  voice: { issues: [{ timeSecs: 10, note: "Mumbled the name" }] },
  personaReveal: { feelings: [{ timeSecs: 1, feeling: "Irritated", why: "Mid-task" }] },
} as unknown as Analysis;

describe("timeline", () => {
  it("merges everything in time order, with fallbacks for old reports", () => {
    const items = buildTimeline(base);
    expect(items.map((i) => i.timeSecs)).toEqual([1, 5, 10, 20, 30, 40]);
    expect(items.find((i) => i.id === "m0")!.oneLine).toBe("Rushed it.");
    expect(items.find((i) => i.id === "m1")!.oneLine).toBe("Nice open");
    expect(timelineCounts(items)).toMatchObject({ win: 1, miss: 1, objection: 1, signal: 1, voice: 1, feeling: 1 });
  });
  it("firstSentence handles no punctuation", () => {
    expect(firstSentence("no stop here")).toBe("no stop here");
  });
  it("derives got-the-ask", () => {
    expect(gotTheAsk("meeting_booked")).toBe("Yes");
    expect(gotTheAsk("info_requested")).toBe("Partly");
    expect(gotTheAsk("hung_up")).toBe("No");
  });
  it("normalises tags", () => {
    expect(normalizeTag("No Ask")).toBe("no_ask");
    expect(normalizeTag("made-up")).toBe("");
  });
});
