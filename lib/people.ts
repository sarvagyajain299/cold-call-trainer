import { createHash } from "node:crypto";
import type { Persona } from "@/lib/persona";

export type CallRow = {
  id: string;
  persona: string | null;
  report: string | null;
  status: string;
  conversationId: string | null;
  profile: string;
  difficulty: string;
  createdAt: number;
};

export type CallSummary = {
  id: string;
  createdAt: number;
  difficulty: string;
  scored: boolean;
  rating: number | null;
  conversion: number | null;
  outcome: string | null;
};

export type Person = {
  key: string;
  persona: Persona;
  /** Newest first. Includes calls that have not been scored yet. */
  calls: CallSummary[];
  scoredCount: number;
  lastCalledAt: number;
  /** Any session of this person; "Call again" copies the prospect from it. */
  latestSessionId: string;
};

export type Waiting = {
  sessionId: string;
  profile: string;
  difficulty: string;
  createdAt: number;
  /** ready: not dialled yet. interrupted: started but never connected. needs_scoring: call happened, no scorecard yet. */
  state: "ready" | "interrupted" | "needs_scoring";
};

/** The same person is the same saved prospect: "Call again" copies it byte for byte. */
export const personaKey = (personaJson: string) => createHash("sha256").update(personaJson).digest("hex").slice(0, 12);

function summarize(row: CallRow): CallSummary {
  let rating: number | null = null;
  let conversion: number | null = null;
  let outcome: string | null = null;
  if (row.report) {
    const a = (JSON.parse(row.report) as { analysis: { overallRating: number; conversionScore: number; outcome: string } }).analysis;
    rating = a.overallRating;
    conversion = a.conversionScore;
    outcome = a.outcome;
  }
  return { id: row.id, createdAt: row.createdAt, difficulty: row.difficulty, scored: Boolean(row.report), rating, conversion, outcome };
}

/**
 * A person appears once at least one of their calls has a scorecard, because who they are stays hidden
 * until then. Everything else is listed as waiting.
 */
export function groupPeople(rows: CallRow[]): { people: Person[]; waiting: Waiting[] } {
  const groups = new Map<string, CallRow[]>();
  const loose: CallRow[] = [];
  for (const row of rows) {
    if (!row.persona) loose.push(row);
    else groups.set(personaKey(row.persona), [...(groups.get(personaKey(row.persona)) ?? []), row]);
  }

  const people: Person[] = [];
  const waiting: Waiting[] = [];

  const waitingFrom = (row: CallRow): Waiting => ({
    sessionId: row.id,
    profile: row.profile,
    difficulty: row.difficulty,
    createdAt: row.createdAt,
    state: row.conversationId ? "needs_scoring" : row.status === "setup" ? "ready" : "interrupted",
  });

  for (const [key, members] of groups) {
    const newestFirst = [...members].sort((a, b) => b.createdAt - a.createdAt);
    const scored = newestFirst.filter((m) => m.report);
    if (scored.length === 0) {
      waiting.push(waitingFrom(newestFirst[0]));
      continue;
    }
    people.push({
      key,
      persona: JSON.parse(newestFirst[0].persona as string) as Persona,
      calls: newestFirst.map(summarize),
      scoredCount: scored.length,
      lastCalledAt: scored[0].createdAt,
      latestSessionId: newestFirst[0].id,
    });
  }
  for (const row of loose) waiting.push(waitingFrom(row));

  people.sort((a, b) => b.lastCalledAt - a.lastCalledAt);
  waiting.sort((a, b) => b.createdAt - a.createdAt);
  return { people, waiting };
}
