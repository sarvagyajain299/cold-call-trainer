// Pure cheat sheet model (safe to import from client components). The AI generator is in lib/cheatsheet.ts.
// The cheat sheet: short keywords and phrases to read before a call and glance at during it.
// A generic part ships as defaults; the offer-specific part is generated once per project and is fully editable.
// It never contains anything about the hidden prospect: only the project, regional norms and the user's own notes.

import { z } from "zod";

export type Section = { id: string; title: string; hint: string; lines: string[] };

/** The call script: exact words, in call order. Every project has its own copy. */
export const SCRIPT_ORDER = ["script_opener", "script_reason", "script_question", "script_pitch", "script_ask", "script_confirm", "script_exit"] as const;

export const SECTION_ORDER = [...SCRIPT_ORDER, "opener", "reason", "questions", "objections", "ask", "proof", "where_from", "swaps", "notes"] as const;
export type SectionId = (typeof SECTION_ORDER)[number];

/** Which sections the AI writes for the offer. Everything else is a generic default the user can edit. */
export const GENERATED: SectionId[] = ["reason", "questions", "objections", "ask", "proof"];

const META: Record<SectionId, { title: string; hint: string }> = {
  script_opener: { title: "1. Opener", hint: "Yes: go to 2. No: objection reply or 7." },
  script_reason: { title: "2. Reason", hint: "Any answer: go to 3." },
  script_question: { title: "3. Question", hint: "Listen, then go to 4." },
  script_pitch: { title: "4. Pitch", hint: "One true sentence. Then go to 5." },
  script_ask: { title: "5. Ask", hint: "Then stop talking. Yes: go to 6. Objection: reply, then ask once more or go to 7." },
  script_confirm: { title: "6. Confirm", hint: "Repeat it back. End the call." },
  script_exit: { title: "7. Exit", hint: "Polite and short. End the call." },
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

const DEFAULTS: Partial<Record<SectionId, string[]>> = {
  script_opener: ["Hi [Name], this is [You] from [Company]. I know you weren't expecting my call. Can I take 30 seconds to tell you why I called, and you can tell me if it's worth talking?"],
  script_reason: ["I called because [type of business] can lose [specific problem]. Not sure if you're bumping into this."],
  script_question: ["Just out of curiosity, how are you handling that today?"],
  script_pitch: ["What I do is [one true sentence about your offer]."],
  script_ask: ["Would you be opposed to [length of call] to see if it fits? [First time option] or [second time option]?"],
  script_confirm: ["Great, [day and time]. What's the best number or email for the invite?"],
  script_exit: ["No problem, thanks for your time, [Name]."],
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
    lines: [...(DEFAULTS[id] ?? [])],
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

export const isScriptSection = (id: string) => (SCRIPT_ORDER as readonly string[]).includes(id);

/** The script steps, in order, for the in-call panel. */
export function scriptSteps(sheet: Section[]): Section[] {
  return sheet.filter((s) => isScriptSection(s.id) && s.lines.length > 0);
}

/** Objection lines split into what they say and your reply. A line without an arrow is all reply. */
export function objectionReplies(sheet: Section[]): { they: string; you: string }[] {
  const lines = sheet.find((s) => s.id === "objections")?.lines ?? [];
  return lines.map((l) => {
    const at = l.indexOf("→");
    return at < 0 ? { they: "", you: l.trim() } : { they: l.slice(0, at).trim(), you: l.slice(at + 1).trim() };
  });
}

// Said live on the call, so they are not blanks to fill in beforehand.
const LIVE_FILL = new Set(["name", "day and time"]);

/** The brackets in the script that still need a real fact. */
export function scriptBlanks(sheet: Section[]): string[] {
  const out = new Set<string>();
  for (const s of scriptSteps(sheet)) {
    for (const l of s.lines) {
      for (const m of l.matchAll(/\[([^\]]+)\]/g)) {
        if (!LIVE_FILL.has(m[1].trim().toLowerCase())) out.add(m[1].trim());
      }
    }
  }
  return [...out];
}
