import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/anthropic", () => ({ anthropic: {}, PERSONA_MODEL: "test" }));

import { groupPeople, personaKey, type CallRow } from "./people";

const persona = (name: string) => JSON.stringify({ name, role: "Owner", city: "Dubai", gender: "male" });
const report = (rating: number) =>
  JSON.stringify({ analysis: { overallRating: rating, conversionScore: rating * 10, outcome: "brushed_off" } });

const row = (over: Partial<CallRow> & { id: string }): CallRow => ({
  persona: null,
  report: null,
  status: "setup",
  conversationId: null,
  profile: "a business owner",
  difficulty: "realistic",
  createdAt: 1,
  ...over,
});

describe("groupPeople", () => {
  it("groups a call and its redo under one person, newest first", () => {
    const p = persona("Ahmed");
    const { people } = groupPeople([
      row({ id: "a", persona: p, report: report(3), status: "done", conversationId: "c1", createdAt: 100 }),
      row({ id: "b", persona: p, report: report(6), status: "done", conversationId: "c2", createdAt: 200 }),
      row({ id: "c", persona: p, createdAt: 300 }), // redo not dialled yet
    ]);
    expect(people).toHaveLength(1);
    expect(people[0].calls.map((c) => c.id)).toEqual(["c", "b", "a"]);
    expect(people[0].scoredCount).toBe(2);
    expect(people[0].latestSessionId).toBe("c");
    expect(people[0].calls[1]).toMatchObject({ rating: 6, conversion: 60, scored: true });
    expect(people[0].calls[0]).toMatchObject({ rating: null, scored: false });
  });

  it("keeps different people apart and orders by most recently called", () => {
    const { people } = groupPeople([
      row({ id: "a", persona: persona("Ahmed"), report: report(3), status: "done", createdAt: 100 }),
      row({ id: "k", persona: persona("Karan"), report: report(2), status: "done", createdAt: 200 }),
    ]);
    expect(people.map((p) => p.persona.name)).toEqual(["Karan", "Ahmed"]);
  });

  it("hides people with no scorecard yet and lists them as waiting, by state", () => {
    const { people, waiting } = groupPeople([
      row({ id: "ready", persona: persona("A"), status: "setup", createdAt: 1 }),
      row({ id: "stuck", persona: persona("B"), status: "live", createdAt: 2 }),
      row({ id: "unscored", persona: persona("C"), status: "scoring", conversationId: "c9", createdAt: 3 }),
      row({ id: "unprepared", persona: null, status: "setup", createdAt: 4 }),
    ]);
    expect(people).toHaveLength(0);
    expect(waiting.map((w) => [w.sessionId, w.state])).toEqual([
      ["unprepared", "ready"],
      ["unscored", "needs_scoring"],
      ["stuck", "interrupted"],
      ["ready", "ready"],
    ]);
  });

  it("gives the same key for the same saved prospect and a different key otherwise", () => {
    expect(personaKey(persona("Ahmed"))).toBe(personaKey(persona("Ahmed")));
    expect(personaKey(persona("Ahmed"))).not.toBe(personaKey(persona("Karan")));
  });
});
