// Pure cheat sheet model (safe to import from client components). The AI generator is in lib/cheatsheet.ts.
// The cheat sheet: short keywords and phrases to read before a call and glance at during it.
// A generic part ships as defaults; the offer-specific part is generated once per project and is fully editable.
// It never contains anything about the hidden prospect: only the project, regional norms and the user's own notes.

import { z } from "zod";

export type Section = { id: string; title: string; hint: string; lines: string[] };

export const SECTION_ORDER = ["opener", "reason", "questions", "objections", "ask", "proof", "where_from", "swaps", "notes"] as const;
export type SectionId = (typeof SECTION_ORDER)[number];

/** Which sections the AI writes for the offer. Everything else is a generic default the user can edit. */
export const GENERATED: SectionId[] = ["reason", "questions", "objections", "ask", "proof"];

const META: Record<SectionId, { title: string; hint: string }> = {
  opener: { title: "Opener, 4 steps", hint: "The first 10 seconds. Slow." },
  reason: { title: "Reason for the call", hint: "One plain sentence. No jargon." },
  questions: { title: "Questions to ask", hint: "Open questions. Then listen." },
  objections: { title: "When they say...", hint: "Acknowledge, then ask. Do not argue." },
  ask: { title: "The ask", hint: "A specific day and time." },
  proof: { title: "Proof you can mention", hint: "Only real results. Fill in your own." },
  where_from: { title: "Where are you calling from?", hint: "Answer in one sentence, then ask your question." },
  swaps: { title: "Say this, not that", hint: "Phrases that can confuse listeners in the US, UK, Australia and Europe." },
  notes: { title: "My own lines", hint: "Better lines you want to keep." },
};

const DEFAULTS: Record<"opener" | "where_from" | "swaps" | "notes", string[]> = {
  opener: [
    "1. Their name, slowly, then pause",
    "2. Your name + company",
    "3. Why you are calling: one sentence",
    "4. Stop. Let them answer.",
  ],
  where_from: [
    "I'm calling from Dubai.",
    "Then straight back to your question.",
    "Do not apologise for it.",
  ],
  swaps: [
    "revert → get back to you / reply",
    "do the needful → I'll take care of it",
    "kindly → please",
    "prepone → move it earlier",
    "out of station → away this week",
    "Finish every sentence. Do not trail off.",
  ],
  notes: [],
};

export function emptySheet(): Section[] {
  return SECTION_ORDER.map((id) => ({
    id,
    ...META[id],
    lines: id === "opener" || id === "where_from" || id === "swaps" || id === "notes" ? [...DEFAULTS[id]] : [],
  }));
}

export const generatedSchema = z.object({
  reason: z.array(z.string()).describe("2 or 3 alternative one-sentence reasons for calling, in plain words"),
  questions: z.array(z.string()).describe("6 short open questions that uncover the problem this offer solves"),
  objections: z
    .array(z.object({ they: z.string(), you: z.string() }))
    .describe("Exactly 5: not interested, send me an email or info, we already have someone, what does it cost, who are you / where are you from"),
  ask: z.array(z.string()).describe("3 ways to ask for the call goal with a specific day and time"),
  proof: z.array(z.string()).describe("3 short proof points taken ONLY from the offer text, or a placeholder such as 'Add a real result here'"),
});
export type Generated = z.infer<typeof generatedSchema>;

/** Merge freshly generated content into a sheet, leaving the generic sections and the user's notes untouched. */
export function applyGenerated(sheet: Section[], g: Generated): Section[] {
  const clean = (xs: string[]) => xs.map((x) => x.trim()).filter(Boolean);
  const gen: Record<string, string[]> = {
    reason: clean(g.reason),
    questions: clean(g.questions),
    objections: g.objections.map((o) => `${o.they.trim()} → ${o.you.trim()}`).filter((l) => l.length > 3),
    ask: clean(g.ask),
    proof: clean(g.proof),
  };
  return sheet.map((s) => (s.id in gen ? { ...s, lines: gen[s.id] } : s));
}

/** Older or partial data is filled out so every section always exists, in order. */
export function normalizeSheet(raw: unknown): Section[] {
  const base = emptySheet();
  if (!Array.isArray(raw)) return base;
  const byId = new Map<string, string[]>();
  for (const r of raw as { id?: unknown; lines?: unknown }[]) {
    if (typeof r?.id === "string" && Array.isArray(r.lines)) byId.set(r.id, r.lines.filter((l): l is string => typeof l === "string"));
  }
  return base.map((s) => (byId.has(s.id) ? { ...s, lines: byId.get(s.id) as string[] } : s));
}

/** One-line digest for the in-call panel: the lines worth a glance, taken from the editable sheet. */
export function panelLines(sheet: Section[]): { label: string; text: string }[] {
  const first = (id: SectionId) => sheet.find((s) => s.id === id)?.lines.find((l) => l.trim()) ?? "";
  const out = [
    { label: "Opener", text: "Name · who you are · why · pause" },
    { label: "Reason", text: first("reason") },
    { label: "Ask", text: first("ask") },
  ];
  return out.filter((l) => l.text);
}
