import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/anthropic", () => ({ anthropic: {}, PERSONA_MODEL: "test" }));

import { applyGenerated, emptySheet, normalizeSheet, objectionReplies, SCRIPT_ORDER, scriptBlanks, scriptSteps, SECTION_ORDER } from "@/lib/sheetModel";

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

  it("gives every project the 7 script steps, in call order", () => {
    expect(scriptSteps(emptySheet()).map((s) => s.id)).toEqual([...SCRIPT_ORDER]);
  });

  it("adds the script template to a sheet saved before scripts existed, keeping its lines", () => {
    const out = normalizeSheet([{ id: "ask", lines: ["old ask"] }]);
    expect(out.find((s) => s.id === "ask")!.lines).toEqual(["old ask"]);
    expect(scriptSteps(out)).toHaveLength(7);
  });

  it("never overwrites the script when offer sections are regenerated", () => {
    const sheet = emptySheet().map((s) => (s.id === "script_pitch" ? { ...s, lines: ["My own words."] } : s));
    expect(applyGenerated(sheet, gen).find((s) => s.id === "script_pitch")!.lines).toEqual(["My own words."]);
  });

  it("lists brackets still to fill, but not the ones said live on the call", () => {
    const blanks = scriptBlanks(emptySheet());
    expect(blanks).toContain("Company");
    expect(blanks).not.toContain("Name");
    expect(blanks).not.toContain("day and time");
    const filled = emptySheet().map((s) => (s.id.startsWith("script_") ? { ...s, lines: ["Hi [Name], great."] } : s));
    expect(scriptBlanks(filled)).toEqual([]);
  });

  it("splits objections into what they say and your reply", () => {
    const out = applyGenerated(emptySheet(), gen);
    expect(objectionReplies(out)).toEqual([{ they: "Not interested", you: "Fair enough. Quick question first?" }]);
    const plain = emptySheet().map((s) => (s.id === "objections" ? { ...s, lines: ["Just a reply"] } : s));
    expect(objectionReplies(plain)).toEqual([{ they: "", you: "Just a reply" }]);
  });
});
