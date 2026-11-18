import { describe, expect, it } from "vitest";
import { typesForPreset } from "./prospectTypes";
import { prospectTypeInput } from "./validation";

const t = (id: string, presetId: string, createdAt: number) => ({ id, presetId, label: id, profile: "x".repeat(20), createdAt });

describe("typesForPreset", () => {
  it("keeps only the project's types, oldest first", () => {
    const all = [t("b", "p1", 2), t("other", "p2", 1), t("a", "p1", 1)];
    expect(typesForPreset(all, "p1").map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("returns nothing when no project is chosen", () => {
    expect(typesForPreset([t("a", "p1", 1)], undefined)).toEqual([]);
  });
});

describe("prospectTypeInput", () => {
  it("accepts a name and a profile", () => {
    expect(prospectTypeInput.safeParse({ label: "Older owner", profile: "Owner of a repair shop in Al Satwa, Dubai" }).success).toBe(true);
  });

  it("rejects an empty name or a too-short profile", () => {
    expect(prospectTypeInput.safeParse({ label: "  ", profile: "Owner of a repair shop in Al Satwa, Dubai" }).success).toBe(false);
    expect(prospectTypeInput.safeParse({ label: "Older owner", profile: "too short" }).success).toBe(false);
  });
});
