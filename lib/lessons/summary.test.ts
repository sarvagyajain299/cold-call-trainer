import { describe, expect, it } from "vitest";
import { firstSentence, lessonHomeSummary } from "@/lib/lessons/summary";
import type { StoredReport } from "@/lib/scoring";

const r = (rating: number, conv: number, headline = "You got the goal. But it was close.") =>
  ({ analysis: { overallRating: rating, conversionScore: conv, headline } }) as unknown as StoredReport;

describe("lessonHomeSummary", () => {
  it("uses the first sentence of the headline", () => {
    expect(lessonHomeSummary(r(4, 62), null).headline).toBe("You got the goal.");
    expect(firstSentence("Fast, rambling answers on renewal, e.g. 1.5 times longer")).toBe("Fast, rambling answers on renewal, e.g. 1.5 times longer");
  });
  it("shows plain values for the first call in a project", () => {
    expect(lessonHomeSummary(r(4, 62), null).lines).toEqual(["Rating 4/10", "Chance of the goal 62%"]);
  });
  it("compares with the last call", () => {
    expect(lessonHomeSummary(r(4, 62), r(2.5, 62)).lines).toEqual(["Rating 4/10, up 1.5 from last call", "Chance of the goal 62%, same as last call"]);
    expect(lessonHomeSummary(r(3, 40), r(4, 55)).lines).toEqual(["Rating 3/10, down 1 from last call", "Chance of the goal 40%, down 15 from last call"]);
  });
});
