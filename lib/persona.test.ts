import { describe, expect, it, vi } from "vitest";

// persona.ts creates an Anthropic client at import time; keep the test offline.
vi.mock("@/lib/anthropic", () => ({ anthropic: {}, PERSONA_MODEL: "test" }));

import { buildAgentPrompt, personaSchema, rollDials, type Persona } from "./persona";

const persona: Persona = {
  name: "Sarah Collins",
  gender: "female",
  age: 47,
  role: "Practice owner",
  businessName: "Collins Family Dental",
  city: "Leeds",
  country: "United Kingdom",
  region: "UK",
  accent: "Yorkshire",
  voiceBrief: "mid-40s, warm, quick pace, Yorkshire",
  pickupLine: "Collins Dental, Sarah speaking.",
  situation: { where: "at reception", doing: "sorting patient files", whoIsAround: "a nurse", soundscape: "phones", minutesAvailable: 2 },
  emotion: { moodNow: "frazzled after a no-show", stress: 7, underlyingFeeling: "annoyed at the interruption" },
  personality: {
    traits: ["direct", "practical"],
    directness: "Says no plainly.",
    phoneStyle: "clipped",
    coldCallHistory: "Gets three a week.",
    accentReaction: "Asks for repeats if unclear.",
  },
  business: {
    currentSetup: "Old website",
    realPainPoints: ["empty Tuesday slots"],
    fitWithOffer: "Partial",
    budgetReality: "tight",
    decisionAuthority: "She decides",
  },
  objections: [{ objection: "We already have a guy", realReason: "loyalty", softensIf: "clear proof of results" }],
  dynamics: {
    interestStart: 2,
    trustStart: 3,
    warmsUpWhen: ["caller is specific"],
    coolsDownWhen: ["caller rambles"],
    hangsUpWhen: ["asked to repeat three times"],
    bestRealisticOutcome: "callback",
  },
};

describe("rollDials", () => {
  it("keeps brutal calls less open than easy calls over many rolls", () => {
    const avg = (d: "easy" | "brutal") =>
      Array.from({ length: 300 }, () => rollDials(d).openness).reduce((a, b) => a + b, 0) / 300;
    expect(avg("brutal")).toBeLessThan(avg("easy"));
  });

  it("stays inside documented ranges", () => {
    for (let i = 0; i < 200; i++) {
      const d = rollDials("realistic");
      expect(d.openness).toBeGreaterThanOrEqual(2);
      expect(d.openness).toBeLessThanOrEqual(7);
      expect(d.mood).toBeGreaterThanOrEqual(-5);
      expect(d.mood).toBeLessThanOrEqual(5);
    }
  });
});

describe("buildAgentPrompt", () => {
  const prompt = buildAgentPrompt(persona, "realistic");

  it("tells the agent who it is and to use end_call to hang up", () => {
    expect(prompt).toContain("Sarah Collins");
    expect(prompt).toContain("end_call");
  });

  it("includes how to react to garbled speech", () => {
    expect(prompt).toMatch(/Sorry, what was that/);
  });

  it("forbids revealing it is an AI", () => {
    expect(prompt).toMatch(/Never say or hint that you are an AI/);
  });
});

describe("personaSchema", () => {
  it("accepts a complete persona", () => {
    expect(personaSchema.safeParse(persona).success).toBe(true);
  });

  it("rejects an unknown region", () => {
    expect(personaSchema.safeParse({ ...persona, region: "MARS" }).success).toBe(false);
  });
});
