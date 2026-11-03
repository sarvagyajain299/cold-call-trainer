import { describe, expect, it } from "vitest";
import { buildHistory, finalizeFocusCheck, type PriorCall } from "@/lib/history";
import type { StoredReport } from "@/lib/scoring";

function call(i: number, name = "Ahmed Tahboub", tag = "no_ask"): PriorCall {
  return {
    sessionId: `s${i}`,
    createdAt: Date.UTC(2026, 9, i + 1),
    difficulty: "realistic",
    report: {
      createdAt: Date.UTC(2026, 9, i + 1),
      persona: { name },
      analysis: {
        overallRating: i,
        conversionScore: 10,
        focusNextCall: `Focus number ${i}`,
        stages: [{ stage: "opener", score: i, comment: "" }],
        topFixes: [{ fix: `Fix ${i}`, why: "", howToPractice: "", tag }],
        moments: [{ kind: "miss", quote: "I am calling about the website", speaker: "trainee", timeSecs: 12, tag }],
        objections: [],
        missedSignals: [],
      },
    } as unknown as StoredReport,
  };
}

describe("buildHistory", () => {
  it("is null with no earlier calls", () => {
    expect(buildHistory([], [])).toBeNull();
  });
  it("uses the newest call's focus and stays under the size cap", () => {
    const prior = [8, 7, 6, 5, 4, 3, 2, 1].map((i) => call(i));
    const h = buildHistory(prior, prior.filter((c) => c.report.persona.name === "Ahmed Tahboub"))!;
    expect(h.lastFocus.focus).toBe("Focus number 8");
    expect(h.text.length).toBeLessThan(4800);
    expect(h.text).toContain("Focus number 8");
    expect(h.text).not.toContain("Focus number 1\"");
    expect(h.text).toContain("No ask: appeared in");
    expect(h.text).toContain("The same prospect last time");
  });
  it("checks the same person's last focus when there is one", () => {
    const karan = call(5, "Karan Malhotra");
    const ahmed = call(3);
    const h = buildHistory([karan, ahmed], [ahmed])!;
    expect(h.lastFocus.focus).toBe("Focus number 3");
    expect(buildHistory([karan, ahmed], [])!.lastFocus.focus).toBe("Focus number 5");
  });
  it("omits the same-prospect block when there is none", () => {
    const h = buildHistory([call(3, "Karan Malhotra")], [])!;
    expect(h.text).not.toContain("The same prospect last time");
  });
});

describe("finalizeFocusCheck", () => {
  const turns = [{ role: "trainee", t: 1, text: "Hi Ahmed, I am calling about WhatsApp leads", cues: [] }] as never;
  const history = buildHistory([call(2)], [])!;
  it("forces no_previous without history", () => {
    const f = finalizeFocusCheck({ focus: "x", verdict: "followed", evidenceQuote: "q", evidenceTimeSecs: 3, comment: "c" }, null, turns);
    expect(f.verdict).toBe("no_previous");
    expect(f.comment).toBe("");
  });
  it("uses the real previous focus and keeps a verified quote", () => {
    const f = finalizeFocusCheck(
      { focus: "invented", verdict: "partly", evidenceQuote: "calling about WhatsApp leads", evidenceTimeSecs: 1, comment: "ok" },
      history,
      turns,
    );
    expect(f.focus).toBe("Focus number 2");
    expect(f.evidenceQuote).toBe("calling about WhatsApp leads");
  });
  it("drops a quote that is not in the transcript", () => {
    const f = finalizeFocusCheck(
      { focus: "", verdict: "followed", evidenceQuote: "never said this sentence", evidenceTimeSecs: 9, comment: "ok" },
      history,
      turns,
    );
    expect(f.evidenceQuote).toBe("");
    expect(f.evidenceTimeSecs).toBe(0);
    expect(f.verdict).toBe("followed");
  });
});
