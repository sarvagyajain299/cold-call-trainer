import { describe, expect, it } from "vitest";
import { pickVoice } from "./voices";

describe("pickVoice", () => {
  it("gives the same person the same voice every time", () => {
    const ahmed = { gender: "male", name: "Ahmed Tahboub", city: "Dubai" } as const;
    const first = pickVoice(ahmed);
    for (let i = 0; i < 50; i++) expect(pickVoice(ahmed)).toBe(first);
  });

  it("uses more than one voice across different people of the same gender", () => {
    const names = Array.from({ length: 30 }, (_, i) => `Person ${i}`);
    const voices = new Set(names.map((name) => pickVoice({ gender: "female", name, city: "Leeds" })));
    expect(voices.size).toBeGreaterThan(1);
  });
});
