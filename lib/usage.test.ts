import { describe, expect, it } from "vitest";
import { costUsd } from "@/lib/usage";

describe("costUsd", () => {
  it("prices Opus 5.5 input and output", () => {
    expect(costUsd("claude-opus-5-5", { input_tokens: 1_000_000, output_tokens: 1_000_000 })).toBeCloseTo(24);
  });
  it("handles missing fields and unknown models", () => {
    expect(costUsd("claude-opus-5-5", {})).toBe(0);
    expect(costUsd("other", { input_tokens: 5 })).toBe(0);
  });
});
