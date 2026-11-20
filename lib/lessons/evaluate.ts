import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic } from "@/lib/anthropic";
import { logUsage } from "@/lib/usage";
import type { AttemptResult, Lesson } from "@/lib/lessons/model";

export const EVAL_MODEL = "claude-sonnet-5-5";

// The user's own coach prompt, word for word.
export const EVAL_SYSTEM = `You are a warm, direct cold-calling coach. The rep just answered a prospect's question out loud. Judge only against this lesson's rule and its 3 checks. Use the prospect's real situation and fears from the context. Be specific: quote the rep's words. Keep the verdict to one sentence and the tip to one sentence. Never be harsh, never pad. If the rep introduced a new cost, commitment or jargon the prospect would fear, fail the relevant check and say why in the prospect's terms. Score 0–10.`;

export const evalSchema = z.object({
  verdict: z.string().describe("One sentence"),
  checks: z.array(z.object({ id: z.string().describe("The check id, as given"), pass: z.boolean(), reason: z.string().describe("One short sentence") })),
  score: z.number().describe("0-10"),
  tip: z.string().describe("One sentence"),
  comparedToLast: z
    .string()
    .describe("If a previous attempt is given: one short sentence comparing this attempt with it, e.g. 'Shorter than last time, and now it has the number.' Otherwise an empty string."),
});

export type EvalInput = {
  lesson: Pick<Lesson, "title" | "rule" | "data">;
  transcript: string;
  previousTranscript?: string | null;
  wpm: number | null;
  /** What the rep sells and its price, so a new cost can be weighed against it. */
  offer?: { offer: string; price: string } | null;
};

export function evalPrompt({ lesson, transcript, previousTranscript, wpm, offer }: EvalInput): string {
  const p = lesson.data.practice;
  return `# Lesson
${lesson.title}
Rule: ${lesson.rule}

# Context
Prospect: ${lesson.data.prospectName}. ${p.context}
${offer ? `What the rep sells: ${offer.offer}\nPrice: ${offer.price || "not specified"}\nIf the rep names a new cost, work out what it adds up to for the prospect (for example per year) and compare it with this price.\n` : ""}
# The prospect asked
"${p.prospectQuestion}"

# The 3 checks
${p.checks.map((c) => `- ${c.id}: ${c.label}. Passes when: ${c.criterion}`).join("\n")}

# Model answer (for your reference only; other good answers are fine)
"${lesson.data.practice.modelLine}"

# The rep's answer${wpm ? ` (spoken at ${wpm} words per minute)` : " (typed)"}
"${transcript}"
${previousTranscript ? `\n# The rep's previous attempt\n"${previousTranscript}"\n` : ""}
Return one result per check, using the check ids above.`;
}

const clamp = (n: number) => Math.max(0, Math.min(10, Math.round(n * 10) / 10));

/** Sonnet grades one practice answer against the lesson's 3 checks. wpm is measured by code, not the AI. */
export async function evaluateAnswer(
  input: EvalInput,
  meter: { sessionId: string | null; kind: string },
  model: string = EVAL_MODEL,
): Promise<{ result: AttemptResult; score: number }> {
  const res = await anthropic.messages.parse({
    model,
    max_tokens: 4000,
    system: EVAL_SYSTEM,
    messages: [{ role: "user", content: evalPrompt(input) }],
    output_config: { effort: "low", format: zodOutputFormat(evalSchema) },
  });
  await logUsage(meter.sessionId, meter.kind, model, res.usage);
  if (res.stop_reason === "refusal" || !res.parsed_output) throw new Error("The coach did not return a valid check");
  const out = res.parsed_output as z.infer<typeof evalSchema>;

  // Keep the lesson's own checks, in order, even if the model renamed or dropped one.
  const checks = input.lesson.data.practice.checks.map((c, i) => {
    const hit = out.checks.find((x) => x.id === c.id) ?? out.checks[i];
    return { id: c.id, pass: hit?.pass ?? false, reason: hit?.reason ?? "" };
  });
  return {
    score: clamp(out.score),
    result: { verdict: out.verdict, checks, tip: out.tip, comparedToLast: input.previousTranscript ? out.comparedToLast : "" },
  };
}
