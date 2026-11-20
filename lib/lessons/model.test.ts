import { describe, expect, it } from "vitest";
import {
  DAY_MS,
  cleanReply,
  feelingSteps,
  nextProspectTurn,
  nextReview,
  shuffle,
  turnId,
  turnLanes,
  wordCount,
  wpm,
} from "@/lib/lessons/model";
import type { Turn } from "@/lib/transcript";

const turn = (role: Turn["role"], t: number, text: string): Turn => ({ role, t, text, cues: [] });

// Rajesh, 125s: the renewal answer exactly as ElevenLabs logged it.
const RAJESH_125 =
  "The price is one time only. The price is one time only. The only thing that you may have to incur the costs are the domain renewal costs. That may be a few dirhams, and the cost to renew the server wherever you run it, so hosting. But that we can figure out. It will be negligible based on your, um, needs and understandings, because you have to rent something to run the system.";

describe("wordCount", () => {
  it("counts words separated by any whitespace", () => {
    expect(wordCount("  one two\nthree  ")).toBe(3);
    expect(wordCount("")).toBe(0);
  });
  it("matches the computed count of Rajesh's 125s answer (74, not the coach's 71)", () => {
    expect(wordCount(RAJESH_125)).toBe(74);
  });
});

describe("turnLanes", () => {
  const turns = [turn("prospect", 0, "Hello?"), turn("trainee", 3, "Hi there, is this Rajesh?"), turn("prospect", 6, "Yes.")];
  it("places each turn from its start to the next turn's start, scaled to the call", () => {
    const lanes = turnLanes(turns, 10);
    expect(lanes.map((l) => [l.id, l.role, l.start, l.end])).toEqual([
      ["t0", "prospect", 0, 3],
      ["t1", "trainee", 3, 6],
      ["t2", "prospect", 6, 10],
    ]);
    expect(lanes[1].x).toBeCloseTo(0.3);
    expect(lanes[1].w).toBeCloseTo(0.3);
    expect(lanes[1].words).toBe(5);
  });
  it("uses the last turn's start when the duration is missing", () => {
    const lanes = turnLanes(turns, 0);
    expect(lanes[2].end).toBeGreaterThan(6);
    expect(lanes[2].x + lanes[2].w).toBeLessThanOrEqual(1);
  });
  it("gives every turn a stable id", () => {
    expect(turnId(4)).toBe("t4");
  });
});

describe("nextProspectTurn", () => {
  const turns = [turn("trainee", 0, "a"), turn("trainee", 2, "b"), turn("prospect", 4, "c"), turn("trainee", 6, "d")];
  it("finds the first prospect turn after an index", () => {
    expect(nextProspectTurn(turns, 0)?.index).toBe(2);
    expect(nextProspectTurn(turns, 3)).toBeNull();
  });
});

describe("cleanReply", () => {
  it("removes fillers and stutters", () => {
    expect(cleanReply("This is, this is Frankie from Focus, and, uh, this is a cold call.")).toBe(
      "This is Frankie from Focus, and this is a cold call.",
    );
  });
  it("starts with a capital letter after a leading filler is removed", () => {
    expect(cleanReply("Hmm, okay. So looking at the preview.")).toBe("Okay. So looking at the preview.");
  });
  it("removes a repeated sentence", () => {
    expect(cleanReply("The price is one time only. The price is one time only. Domain is extra.")).toBe(
      "The price is one time only. Domain is extra.",
    );
  });
  it("cuts long replies with an ellipsis", () => {
    const out = cleanReply(RAJESH_125, 20);
    expect(wordCount(out)).toBeLessThanOrEqual(20);
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toMatch(/\buh\b|\bum\b/i);
  });
});

describe("wpm", () => {
  it("is words per minute of speaking time", () => {
    expect(wpm(30, 12)).toBe(150);
  });
  it("is null without speaking time", () => {
    expect(wpm(10, 0)).toBeNull();
  });
});

describe("nextReview", () => {
  const now = 1_000_000;
  it("a score under 7 comes back tomorrow and restarts the ladder", () => {
    expect(nextReview(5, 1, now)).toEqual({ at: now + DAY_MS, step: 0 });
  });
  it("7 or more climbs 3 days, then 7 days, then stops", () => {
    expect(nextReview(7, 0, now)).toEqual({ at: now + 3 * DAY_MS, step: 1 });
    expect(nextReview(9, 1, now)).toEqual({ at: now + 7 * DAY_MS, step: 2 });
    expect(nextReview(8, 2, now)).toEqual({ at: null, step: 2 });
  });
});

describe("shuffle", () => {
  it("is deterministic for a seed and keeps every item", () => {
    const a = shuffle([1, 2, 3, 4, 5], "seed");
    expect(shuffle([1, 2, 3, 4, 5], "seed")).toEqual(a);
    expect([...a].sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("feelingSteps", () => {
  it("turns feelings into steps that hold until the next change", () => {
    const steps = feelingSteps([{ timeSecs: 0, feeling: "Wary" }, { timeSecs: 40, feeling: "Interested" }], [1, 3], 100);
    expect(steps).toEqual([
      { x: 0, x2: 0.4, level: 1, t: 0, feeling: "Wary" },
      { x: 0.4, x2: 1, level: 3, t: 40, feeling: "Interested" },
    ]);
  });
  it("defaults missing levels to the middle", () => {
    expect(feelingSteps([{ timeSecs: 0 }], [], 10)[0].level).toBe(2);
  });
});
