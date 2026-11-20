import { describe, expect, it } from "vitest";
import { costUsd } from "@/lib/usage";

describe("costUsd", () => {
  it("prices Opus 5.5 input and output", () => {
    expect(costUsd("claude-opus-5-5", { input_tokens: 1_000_000, output_tokens: 1_000_000 })).toBeCloseTo(24);
  });
  it("prices Sonnet 5.5 and cache reads", () => {
    expect(costUsd("claude-sonnet-5-5", { input_tokens: 1_000_000, output_tokens: 1_000_000 })).toBeCloseTo(12);
    expect(costUsd("claude-opus-5-5", { cache_read_input_tokens: 1_000_000 })).toBeCloseTo(0.2);
  });
  it("handles missing fields and unknown models", () => {
    expect(costUsd("claude-opus-5-5", {})).toBe(0);
    expect(costUsd("other", { input_tokens: 5 })).toBe(0);
  });
});
