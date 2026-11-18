import { describe, expect, it } from "vitest";
import { summarise } from "@/lib/projectSummary";

describe("project summary", () => {
  it("handles a project with no scored calls", () => {
    expect(summarise(2, [])).toEqual({ calls: 2, scored: 0, average: null, best: null, latestFocus: null });
  });

  it("averages ratings to one decimal and takes the newest focus", () => {
    const out = summarise(4, [
      { createdAt: 1, rating: 3, focus: "old focus" },
      { createdAt: 3, rating: 1.5, focus: "newest focus" },
      { createdAt: 2, rating: 4, focus: "middle" },
    ]);
    expect(out).toEqual({ calls: 4, scored: 3, average: 2.8, best: 4, latestFocus: "newest focus" });
  });
});
