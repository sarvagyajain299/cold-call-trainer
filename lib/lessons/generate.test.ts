import { describe, expect, it } from "vitest";
import { assembleLessons, type LessonWriting } from "@/lib/lessons/generate";
import type { StoredReport } from "@/lib/scoring";
import type { Turn } from "@/lib/transcript";

const turn = (role: Turn["role"], t: number, text: string): Turn => ({ role, t, text, cues: [] });

const transcript: Turn[] = [
  turn("prospect", 0, "Hello, Spotless Shield."),
  turn("trainee", 3, "Hi, this is Frankie from Focus."),
  turn("prospect", 8, "After one year, what exactly will I pay, in dirhams? I don't like surprises."),
  turn("trainee", 12, "So, uh, it depends, it depends on the server and the domain, we can figure out, it will be negligible."),
  turn("prospect", 20, "This is not a number. Who will update it? I don't have time for computer work."),
  turn("trainee", 26, "We can do a yearly contract with us."),
  turn("prospect", 30, "Okay, send it on WhatsApp."),
];

const report = {
  createdAt: 1,
  transcript,
  persona: { name: "Rajesh Nair" },
  meta: { durationSecs: 40 },
  analysis: {
    topFixes: [{ fix: "f", why: "w", howToPractice: "h", oneLine: "o", tag: "vague_offer" }],
    moments: [
      { timeSecs: 12, speaker: "trainee", kind: "miss", quote: "it will be negligible", betterLine: "About 60 dirhams a year from year two.", tag: "vague_offer", what: "", why: "", oneLine: "" },
    ],
    personaReveal: { feelings: [{ timeSecs: 0, feeling: "wary", why: "" }, { timeSecs: 20, feeling: "suspicious", why: "" }] },
  },
} as unknown as StoredReport;

const lesson = (over: Partial<LessonWriting["lessons"][number]> = {}): LessonWriting["lessons"][number] => ({
  title: "Answer money questions in one sentence",
  rule: "One question. One sentence. One number. Then stop talking.",
  findItTurnIds: ["t3"],
  findItPrompt: "Tap the turn that cost you his trust.",
  findItHint: "Look for the longest bar on your line.",
  findItExplanation: "That answer had no number.",
  chooseProspectTurnId: "t2",
  chooseProspectQuote: "what exactly will I pay, in dirhams?",
  distractor: "Don't worry about that, it's very cheap.",
  chooseRightExplanation: "He wanted a number.",
  chooseWrongHint: "Which one has a number?",
  practiceProspectTurnId: "t4",
  practiceQuestion: "Who will update it?",
  practiceContext: "He has no time.",
  checks: [
    { id: "short", label: "Under about 20 words", criterion: "20 words or fewer" },
    { id: "no-cost", label: "No new costs", criterion: "No new cost or contract words" },
    { id: "nothing-to-do", label: "Nothing for him to do", criterion: "Says he has nothing to do" },
  ],
  modelLine: "You won't have to do anything. Any change, just WhatsApp me.",
  cueLabel: "When he asks about updates",
  ...over,
});

const writing = (l: LessonWriting["lessons"][number]): LessonWriting => ({
  lessons: [l],
  gutReconcileReview: "You felt you rambled. You did, and you still got the WhatsApp yes.",
  gutReconcileWell: "w",
  gutReconcileMixed: "m",
  gutReconcileBadly: "b",
  feelingLevels: [1, 9],
});

describe("assembleLessons", () => {
  it("builds a lesson from verified model output and real call data", () => {
    const { lessons, rejected } = assembleLessons(report, writing(lesson()), "I rambled", "seed");
    expect(rejected).toEqual([]);
    const d = lessons[0].data;
    expect(d.findIt.correctTurnIds).toEqual(["t3"]);
    expect(d.findIt.clip).toEqual({ t: 12, end: 20 });
    expect(d.choose.prospectQuote).toBe("what exactly will I pay, in dirhams?");
    expect(d.choose.options.map((o) => o.kind).sort()).toEqual(["distractor", "model", "yours"]);
    expect(d.choose.options.find((o) => o.kind === "model")?.text).toBe("About 60 dirhams a year from year two.");
    expect(d.choose.options.find((o) => o.kind === "yours")?.text).not.toMatch(/\buh\b/);
    expect(d.choose.reaction?.text).toMatch(/^This is not a number/);
    expect(d.ruleScreen.before.words).toBe(20);
    expect(d.ruleScreen.after.words).toBe(8);
    expect(d.practice.clip).toEqual({ t: 20, end: 26 });
    expect(d.gutCheck).toEqual({ mode: "review", selfReview: "I rambled", reconcile: expect.stringContaining("rambled") });
    expect(d.feelingLevels).toEqual([1, 4]);
  });

  it("falls back to call data when ids or quotes do not check out", () => {
    const { lessons, rejected } = assembleLessons(
      report,
      writing(lesson({ findItTurnIds: ["t2", "t99"], chooseProspectQuote: "words nobody said here", practiceProspectTurnId: "t4", practiceQuestion: "Something he never asked?" })),
      null,
      "seed",
    );
    expect(rejected.length).toBe(3);
    const d = lessons[0].data;
    expect(d.findIt.correctTurnIds).toEqual(["t3"]); // from the coach's tagged moment
    expect(d.choose.prospectQuote).toBe(transcript[2].text);
    expect(d.practice.clip).toBeUndefined();
    expect(d.gutCheck?.mode).toBe("pick");
  });
});
