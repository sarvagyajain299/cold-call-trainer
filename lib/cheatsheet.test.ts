import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/anthropic", () => ({ anthropic: {}, PERSONA_MODEL: "test" }));

import { applyGenerated, emptySheet, normalizeSheet, panelLines, SECTION_ORDER } from "@/lib/sheetModel";

const gen = {
  reason: ["  Leads are lost after hours  ", ""],
  questions: ["What happens to enquiries at night?"],
  objections: [{ they: "Not interested", you: "Fair enough. Quick question first?" }],
  ask: ["Could we do 20 minutes Tuesday at 10?"],
  proof: ["Add a real result here"],
};

describe("cheat sheet", () => {
  it("starts with generic sections and empty generated ones", () => {
    const s = emptySheet();
    expect(s.map((x) => x.id)).toEqual([...SECTION_ORDER]);
    expect(s.find((x) => x.id === "opener")!.lines).toHaveLength(4);
    expect(s.find((x) => x.id === "questions")!.lines).toEqual([]);
  });

  it("applies generated content but keeps the user's edits to the other sections", () => {
    const sheet = emptySheet().map((s) => (s.id === "notes" ? { ...s, lines: ["my own line"] } : s));
    const out = applyGenerated(sheet, gen);
    expect(out.find((s) => s.id === "reason")!.lines).toEqual(["Leads are lost after hours"]);
    expect(out.find((s) => s.id === "objections")!.lines).toEqual(["Not interested → Fair enough. Quick question first?"]);
    expect(out.find((s) => s.id === "notes")!.lines).toEqual(["my own line"]);
    expect(out.find((s) => s.id === "opener")!.lines).toHaveLength(4);
  });

  it("normalises broken or partial stored data", () => {
    expect(normalizeSheet(null)).toHaveLength(SECTION_ORDER.length);
    const out = normalizeSheet([{ id: "ask", lines: ["x", 5] }, { nonsense: true }]);
    expect(out.find((s) => s.id === "ask")!.lines).toEqual(["x"]);
    expect(out.map((s) => s.id)).toEqual([...SECTION_ORDER]);
  });

  it("builds the in-call digest from the editable sheet", () => {
    const out = applyGenerated(emptySheet(), gen);
    const lines = panelLines(out);
    expect(lines.map((l) => l.label)).toEqual(["Opener", "Reason", "Ask"]);
    expect(lines[2].text).toBe("Could we do 20 minutes Tuesday at 10?");
    expect(panelLines(emptySheet()).map((l) => l.label)).toEqual(["Opener"]);
  });
});
