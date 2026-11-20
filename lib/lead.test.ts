import { describe, expect, it } from "vitest";
import { leadCard } from "./lead";
import type { Persona } from "./persona";

const base = {
  name: "Rajesh Nair",
  role: "Owner",
  businessName: "Spotless Shield Pest Control",
  city: "Dubai",
  emotion: { moodNow: "tired after a bad review", stress: 6, underlyingFeeling: "wary" },
  objections: [{ objection: "trust is not my problem", realReason: "was scammed", softensIf: "clear price" }],
} as unknown as Persona;

describe("leadCard", () => {
  it("shows public lead facts", () => {
    const p = { ...base, lead: { area: "Al Barsha South", googleRating: 4.93, reviewCount: 164.2, website: "none", publicNote: "Two vans, 8 years" } } as Persona;
    expect(leadCard(p)).toEqual({
      name: "Rajesh Nair",
      role: "Owner",
      businessName: "Spotless Shield Pest Control",
      location: "Al Barsha South, Dubai",
      rating: 4.9,
      reviews: 164,
      website: "none",
      note: "Two vans, 8 years",
    });
  });

  it("works for older personas with no lead card", () => {
    const c = leadCard(base);
    expect(c.location).toBe("Dubai");
    expect(c.rating).toBeNull();
    expect(c.reviews).toBeNull();
  });

  it("never leaks hidden fields", () => {
    const text = JSON.stringify(leadCard(base));
    expect(text).not.toContain("bad review");
    expect(text).not.toContain("scammed");
  });
});
