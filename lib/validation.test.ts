import { describe, expect, it } from "vitest";
import { presetInput, sessionInput } from "./validation";

describe("presetInput", () => {
  it("accepts a complete preset and defaults optional fields", () => {
    const r = presetInput.parse({ name: "Web", offer: "We build websites for dentists", callGoal: "Book a demo" });
    expect(r.price).toBe("");
    expect(r.idealCustomer).toBe("");
  });

  it("rejects a too-short offer", () => {
    expect(presetInput.safeParse({ name: "Web", offer: "short", callGoal: "Book a demo" }).success).toBe(false);
  });
});

describe("sessionInput", () => {
  it("rejects an unknown difficulty", () => {
    const r = sessionInput.safeParse({ presetId: "x", profile: "A plumber in Leeds, UK, owns the business", difficulty: "nightmare" });
    expect(r.success).toBe(false);
  });

  it("accepts a valid session", () => {
    const r = sessionInput.safeParse({ presetId: "x", profile: "A plumber in Leeds, UK, owns the business", difficulty: "brutal" });
    expect(r.success).toBe(true);
  });
});
