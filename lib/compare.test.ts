import { describe, expect, it } from "vitest";
import { buildComparison, compareReports, findPrevious, METRICS } from "@/lib/compare";
import { ABOUT } from "@/lib/about";
import { buildSeries, countHabits } from "@/lib/progress";
import type { StoredReport } from "@/lib/scoring";

function report(opener: number, wpm: number, extra: Record<string, unknown> = {}): StoredReport {
  return {
    analysis: {
      overallRating: 3,
      conversionScore: 10,
      stages: [{ stage: "opener", score: opener, comment: "" }],
      goalClarity: { score: 4, comment: "" },
      callControl: { score: 4, comment: "" },
      voice: { energy: 5, confidence: 5, warmth: 5, clarity: 5, issues: [], summary: "" },
      moments: [],
      objections: [],
      missedSignals: [],
      topFixes: [],
      ...extra,
    },
    persona: { name: "Ahmed Khan" },
    metrics: { speech: { wpm, lowConfidenceShare: 0.1, fillersPerMin: 2 }, voice: null, tone: null },
    meta: { traineeWordShare: 0.45 },
  } as unknown as StoredReport;
}

describe("compareReports", () => {
  it("flags real changes only", () => {
    const ch = compareReports(report(3, 190), report(1, 195));
    const opener = ch.find((c) => c.key === "stage_opener")!;
    expect(opener).toMatchObject({ direction: "up", good: true, prev: 1, cur: 3 });
    expect(ch.find((c) => c.key === "rating")!.direction).toBe("same");
    // 195 -> 190 wpm is noise and both are far above the ideal pace
    expect(ch.find((c) => c.key === "pace")!.direction).toBe("same");
  });
  it("treats moving toward the ideal pace as good", () => {
    const pace = compareReports(report(3, 150), report(3, 190)).find((c) => c.key === "pace")!;
    expect(pace).toMatchObject({ direction: "down", good: true });
  });
  it("skips metrics missing from an old report", () => {
    const old = report(3, 150);
    old.metrics.speech = null;
    expect(compareReports(report(3, 150), old).find((c) => c.key === "pace")).toBeUndefined();
  });
  it("warns about a different difficulty or project", () => {
    const c = buildComparison({
      cur: report(3, 150), prev: report(1, 150), prevSessionId: "a", prevCreatedAt: 1,
      curDifficulty: "brutal", prevDifficulty: "realistic", curPresetId: "p1", prevPresetId: "p2",
    });
    expect(c.cautions).toHaveLength(2);
    expect(c.name).toBe("Ahmed");
  });
});

describe("findPrevious", () => {
  const rows = [
    { id: "1", createdAt: 1, persona: "A", report: "{}" },
    { id: "2", createdAt: 2, persona: "B", report: "{}" },
    { id: "3", createdAt: 3, persona: "A", report: "{}" },
    { id: "4", createdAt: 4, persona: "A", report: null },
  ];
  it("finds the newest earlier scored call by the same person", () => {
    expect(findPrevious({ id: "5", createdAt: 5, persona: "A" }, rows, (p) => p)?.id).toBe("3");
    expect(findPrevious({ id: "3", createdAt: 3, persona: "A" }, rows, (p) => p)?.id).toBe("1");
    expect(findPrevious({ id: "1", createdAt: 1, persona: "A" }, rows, (p) => p)).toBeNull();
  });
});

describe("metric descriptions", () => {
  it("every metric is explained", () => {
    for (const m of METRICS) {
      expect(ABOUT[m.key], m.key).toBeDefined();
      expect(ABOUT[m.key].what.length).toBeGreaterThan(10);
    }
  });
});

describe("progress", () => {
  it("builds series and ignores a single point", () => {
    expect(buildSeries([report(1, 150)])).toEqual([]);
    const s = buildSeries([report(1, 150), report(4, 150)]).find((x) => x.def.key === "stage_opener")!;
    expect(s).toMatchObject({ from: 1, to: 4, direction: "up", good: true });
  });
  it("counts habits per call and ignores old reports without tags", () => {
    const tagged = (tag: string) =>
      report(1, 150, { moments: [{ kind: "miss", tag }], topFixes: [{ tag }] });
    const habits = countHabits([tagged("no_ask"), tagged("no_ask"), tagged("fillers"), report(1, 150)]);
    expect(habits[0]).toMatchObject({ id: "no_ask", calls: 2, outOf: 3 });
  });
});
