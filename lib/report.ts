import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, PERSONA_MODEL } from "@/lib/anthropic";
import { RUBRIC, SCORING_GUIDE } from "@/lib/rubric";
import { formatTranscript, type Turn } from "@/lib/transcript";
import { keepVerified } from "@/lib/reportVerify";
import type { Preset } from "@/db/schema";
import type { Persona } from "@/lib/persona";
import type { SpeechSummary } from "@/lib/speechMetrics";
import type { VoiceSummary } from "@/lib/voiceMetrics";
import type { Tone } from "@/lib/tone";

/*
 * The report is written in two focused calls that run in parallel. A single structured response
 * with every field is rejected by the API as too complex.
 */

// Call 1: the verdict, the scores and what to do next.
export const verdictSchema = z.object({
  headline: z.string().describe("One honest sentence summing up the call"),
  overallRating: z.number().describe("0-10, calibrated per the guide"),
  conversionScore: z.number().describe("0-100 probability this call reaches its goal or a firm step toward it"),
  conversionReasoning: z.string().describe("Why that probability, referring to this prospect's hidden fit and mood"),
  outcome: z.enum(["meeting_booked", "callback_agreed", "info_requested", "brushed_off", "hung_up", "ended_neutral"]),
  wins: z.array(z.string()).describe("What genuinely worked, specific"),
  topFixes: z
    .array(
      z.object({
        fix: z.string(),
        why: z.string(),
        howToPractice: z.string().describe("A concrete drill to try on the next call"),
      }),
    )
    .describe("Exactly three, most important first"),
  focusNextCall: z.string().describe("ONE thing to focus on for the next call, a single sentence"),
  stages: z
    .array(
      z.object({
        stage: z.enum(["opener", "reason_for_call", "discovery", "value_pitch", "objection_handling", "close"]),
        score: z.number().describe("0-10"),
        comment: z.string(),
      }),
    )
    .describe("One entry per stage, in call order"),
  goalClarity: z.object({
    score: z.number().describe("0-10: did the trainee make the purpose of the call and the ask clear?"),
    comment: z.string(),
  }),
  callControl: z.object({ score: z.number().describe("0-10"), comment: z.string() }),
  culturalFit: z.object({ score: z.number().describe("0-10"), notes: z.array(z.string()) }),
  selfReviewFeedback: z
    .string()
    .describe("Compare the trainee's own review with reality. If none was given, return an empty string."),
});

// Call 2: the evidence, the voice and the reveal of who the prospect was.
export const evidenceSchema = z.object({
  moments: z
    .array(
      z.object({
        timeSecs: z.number(),
        speaker: z.enum(["trainee", "prospect"]),
        quote: z.string().describe("EXACT words from the transcript at that moment; use '...' to skip words"),
        kind: z.enum(["win", "miss"]),
        what: z.string(),
        why: z.string(),
        betterLine: z.string().describe("For a miss: what a top closer would have said instead. Empty string for a win."),
      }),
    )
    .describe("The 6 to 12 most instructive moments in time order"),
  objections: z.array(
    z.object({
      timeSecs: z.number(),
      quote: z.string().describe("EXACT prospect words raising the objection or brush-off"),
      realObjection: z.boolean().describe("false if it was a reflex brush-off"),
      howHandled: z.string(),
      score: z.number().describe("0-10"),
      betterResponse: z.string(),
    }),
  ),
  missedSignals: z.array(
    z.object({
      timeSecs: z.number(),
      quote: z.string().describe("EXACT prospect words that signalled a pain, interest or opening"),
      meaning: z.string(),
      whatToDo: z.string(),
    }),
  ),
  voice: z.object({
    energy: z.number().describe("0-10"),
    confidence: z.number().describe("0-10"),
    warmth: z.number().describe("0-10"),
    clarity: z.number().describe("0-10"),
    summary: z.string().describe("Blend the measurements and the listener's notes into plain coaching about the voice"),
    issues: z.array(z.object({ timeSecs: z.number(), note: z.string() })),
  }),
  personaReveal: z.object({
    whoTheyWere: z.string().describe("Two sentences on who the prospect really was and what was happening for them"),
    feelings: z
      .array(z.object({ timeSecs: z.number(), feeling: z.string(), why: z.string() }))
      .describe("How the prospect felt at 4 to 8 points in the call, and what caused it"),
    hiddenTruth: z.string().describe("The real fit, budget and best realistic outcome, and whether the trainee found it"),
  }),
});

export type Verdict = z.infer<typeof verdictSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export type Analysis = Verdict & Evidence;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n * 10) / 10));

export function clampScores(a: Analysis): Analysis {
  return {
    ...a,
    overallRating: clamp(a.overallRating, 0, 10),
    conversionScore: Math.round(clamp(a.conversionScore, 0, 100)),
    stages: a.stages.map((s) => ({ ...s, score: clamp(s.score, 0, 10) })),
    goalClarity: { ...a.goalClarity, score: clamp(a.goalClarity.score, 0, 10) },
    callControl: { ...a.callControl, score: clamp(a.callControl.score, 0, 10) },
    objections: a.objections.map((o) => ({ ...o, score: clamp(o.score, 0, 10) })),
    voice: {
      ...a.voice,
      energy: clamp(a.voice.energy, 0, 10),
      confidence: clamp(a.voice.confidence, 0, 10),
      warmth: clamp(a.voice.warmth, 0, 10),
      clarity: clamp(a.voice.clarity, 0, 10),
    },
    culturalFit: { ...a.culturalFit, score: clamp(a.culturalFit.score, 0, 10) },
  };
}

/** Drop any quoted evidence that does not appear in the transcript, so the coach cannot invent words. */
export function verifyAnalysis(a: Analysis, turns: Turn[]): { analysis: Analysis; droppedQuotes: number } {
  const moments = keepVerified(a.moments, turns);
  const objections = keepVerified(a.objections, turns, "prospect");
  const signals = keepVerified(a.missedSignals, turns, "prospect");
  return {
    analysis: { ...a, moments: moments.kept, objections: objections.kept, missedSignals: signals.kept },
    droppedQuotes: moments.dropped + objections.dropped + signals.dropped,
  };
}

const SYSTEM = `You are a world-class cold-call coach reviewing a practice call. The trainee is an Indian professional based in Dubai who is new to cold calling and is practising on AI prospects in the US, UK, Australia, Europe and the Gulf. They worry that they mumble and that people ask them to repeat themselves.
Coach honestly and specifically, like the best human trainer: name what worked first, then what to fix, and always say what to do instead. Use the rubric. Every quote you give must be copied exactly from the transcript. Refer to times in seconds from the start of the call.

RUBRIC
${RUBRIC}

${SCORING_GUIDE}`;

export type ReportInput = {
  preset: Preset;
  profile: string;
  persona: Persona;
  turns: Turn[];
  durationSecs: number;
  endedBy: string;
  selfReview: string | null;
  speech: SpeechSummary | null;
  voice: VoiceSummary | null;
  tone: Tone | null;
  perTurn: { t: number; wpm: number; words: number; lowConfidence: string[] }[];
};

function buildContext(input: ReportInput): string {
  const { preset, persona } = input;

  const measurements = [
    input.speech
      ? `SPEECH (from the recording, Deepgram): ${input.speech.wpm} words per minute while speaking; ${input.speech.fillerCount} fillers (${input.speech.fillersPerMin}/min); clarity score ${input.speech.clarityScore}/100 (average word confidence ${input.speech.avgConfidence}, ${Math.round(input.speech.lowConfidenceShare * 100)}% of words low-confidence, i.e. hard to understand); longest unbroken run ${input.speech.longestRunSecs}s; ${input.speech.longPauses.length} long pauses. Hardest-to-recognise words: ${input.speech.lowConfidenceWords.map((w) => `"${w.word}"@${w.at}s`).join(", ") || "none"}.`
      : "SPEECH: not available.",
    input.voice
      ? `VOICE SIGNAL (from the microphone): pitch variation ${input.voice.pitchVariationSemitones} semitones (lively speech is about 3 or more; flat is under 1.5); monotone score ${input.voice.monotoneScore}/100 (higher is flatter); dynamic range ${input.voice.dynamicRangeDb} dB; ${Math.round(input.voice.trailingOffShare * 100)}% of ${input.voice.sentences} sentences trail off at the end; ${Math.round(input.voice.risingEndShare * 100)}% end on a rising pitch (sounds unsure). Energy by 15s block: ${input.voice.timeline.map((b) => `${b.startSecs}s:${b.avgDb}dB`).join(", ")}.`
      : "VOICE SIGNAL: not available.",
    input.tone
      ? `LISTENER'S NOTES (an AI that heard the recording): energy ${input.tone.energy}/10, confidence ${input.tone.confidence}/10, warmth ${input.tone.warmth}/10, easy to follow ${input.tone.easyToFollow}/10. ${input.tone.summary} Moments: ${input.tone.observations.map((o) => `${o.timeSecs}s ${o.kind}: ${o.note}`).join("; ")}.`
      : "LISTENER'S NOTES: not available.",
  ].join("\n");

  return `# What the trainee sells
Project: ${preset.name}
Offer: ${preset.offer}
Price: ${preset.price || "not specified"}
Ideal customer: ${preset.idealCustomer || "not specified"}
Goal of the call: ${preset.callGoal}

# What the trainee knew about the prospect before calling
${input.profile}

# The prospect, as built for this call (the trainee has NOT seen this)
${JSON.stringify(persona, null, 1)}

# Call facts
Duration: ${Math.round(input.durationSecs)}s. Ended by: ${input.endedBy}.

# Transcript (TRAINEE is the person being coached; PROSPECT is the AI; cues in brackets are the prospect's vocal expressions)
${formatTranscript(input.turns)}

# Measurements
${measurements}
Per trainee turn: ${input.perTurn.map((p) => `${p.t}s ${p.wpm}wpm/${p.words}w${p.lowConfidence.length ? ` unclear:${p.lowConfidence.join("/")}` : ""}`).join(" | ")}

# The trainee's own review of the call
${input.selfReview?.trim() || "(none given)"}`;
}

async function ask<S extends z.ZodType>(schema: S, context: string, task: string): Promise<z.infer<S>> {
  const res = await anthropic.messages.parse({
    model: PERSONA_MODEL,
    max_tokens: 12000,
    system: SYSTEM,
    messages: [{ role: "user", content: `${context}\n\n# Your task\n${task}` }],
    output_config: { effort: "high", format: zodOutputFormat(schema) },
  });
  if (res.stop_reason === "refusal" || !res.parsed_output) {
    throw new Error("The coach did not return a valid report");
  }
  return res.parsed_output as z.infer<S>;
}

export async function analyzeCall(input: ReportInput): Promise<Analysis> {
  const context = buildContext(input);

  const [verdict, evidence] = await Promise.all([
    ask(
      verdictSchema,
      context,
      "Give the verdict: ratings, conversion score, what worked, the three most important fixes, ONE focus for the next call, the six stage scores, goal clarity, call control and cultural fit. Include feedback on the trainee's own review if one was given.",
    ),
    ask(
      evidenceSchema,
      context,
      "Give the evidence: the most instructive moments (each with an exact quote), every objection and how it was handled, any buying signals that were missed, the voice assessment (blend the measurements and the listener's notes), and the reveal of who the prospect really was and how they felt. Quotes must be copied exactly from the transcript.",
    ),
  ]);

  return clampScores({ ...verdict, ...evidence });
}
