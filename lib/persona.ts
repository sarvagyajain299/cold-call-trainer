import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, PERSONA_MODEL } from "@/lib/anthropic";
import type { Preset } from "@/db/schema";

export type Difficulty = "easy" | "realistic" | "brutal";

/* ---------- Dials: random numbers only. Claude invents every situation and emotion. ---------- */

export type Dials = {
  openness: number; // 0-10 how receptive to a stranger's call, before hearing anything
  patience: number; // 0-10 tolerance for waffle, mumbling, pushiness
  mood: number; // -5 (awful day) .. +5 (great day)
  attention: "full" | "split" | "minimal";
  offerFit: "strong" | "partial" | "none";
};

const between = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
const pick = <T,>(weighted: [T, number][]): T => {
  const total = weighted.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [v, w] of weighted) if ((r -= w) <= 0) return v;
  return weighted[weighted.length - 1][0];
};

const RANGES: Record<Difficulty, { openness: [number, number]; patience: [number, number] }> = {
  easy: { openness: [5, 9], patience: [6, 10] },
  realistic: { openness: [2, 7], patience: [3, 8] },
  brutal: { openness: [0, 4], patience: [1, 5] },
};

const FIT_WEIGHTS: Record<Difficulty, [Dials["offerFit"], number][]> = {
  easy: [["strong", 55], ["partial", 35], ["none", 10]],
  realistic: [["strong", 30], ["partial", 40], ["none", 30]],
  brutal: [["strong", 15], ["partial", 35], ["none", 50]],
};

export function rollDials(difficulty: Difficulty): Dials {
  const r = RANGES[difficulty];
  return {
    openness: Math.round(between(...r.openness)),
    patience: Math.round(between(...r.patience)),
    mood: Math.round(between(-5, 5)),
    attention: pick<Dials["attention"]>([["full", 35], ["split", 45], ["minimal", 20]]),
    offerFit: pick(FIT_WEIGHTS[difficulty]),
  };
}

/* ---------- Persona schema (hidden from the user until the report) ---------- */

export const personaSchema = z.object({
  name: z.string().describe("Full name appropriate for the region"),
  gender: z.enum(["male", "female"]),
  age: z.number(),
  role: z.string(),
  businessName: z.string(),
  city: z.string(),
  country: z.string(),
  region: z.enum(["US", "UK", "AU", "EU", "GCC", "OTHER"]),
  accent: z.string().describe("Concrete spoken accent, e.g. 'broad Yorkshire', 'General American', 'Gulf Arabic-accented English'"),
  voiceBrief: z.string().describe("One line describing the ideal voice: age feel, pitch, pace, accent"),
  pickupLine: z.string().describe("Exactly what they say on answering, as a real person would on this device and in this setting"),
  situation: z.object({
    where: z.string(),
    doing: z.string().describe("What they were in the middle of when the phone rang"),
    whoIsAround: z.string(),
    soundscape: z.string().describe("Background sound heard on their side of the call, or 'quiet'"),
    minutesAvailable: z.number(),
  }),
  emotion: z.object({
    moodNow: z.string().describe("Their emotional state when answering, in a sentence, with its cause"),
    stress: z.number(),
    underlyingFeeling: z.string().describe("What they feel about being cold called right now"),
  }),
  personality: z.object({
    traits: z.array(z.string()),
    directness: z.string(),
    phoneStyle: z.string().describe("How they talk on calls: pace, filler words, humour, interruptions"),
    coldCallHistory: z.string().describe("Their past experience and attitude to cold callers"),
    accentReaction: z.string().describe("How they react to a caller with a non-local accent or hard-to-follow speech"),
  }),
  business: z.object({
    currentSetup: z.string(),
    realPainPoints: z.array(z.string()),
    fitWithOffer: z.string().describe("Honest assessment of whether the caller's offer helps them"),
    budgetReality: z.string(),
    decisionAuthority: z.string(),
  }),
  objections: z.array(
    z.object({
      objection: z.string().describe("In their own words"),
      realReason: z.string(),
      softensIf: z.string().describe("What the caller would have to do or say for this to soften"),
    }),
  ),
  dynamics: z.object({
    interestStart: z.number(),
    trustStart: z.number(),
    warmsUpWhen: z.array(z.string()),
    coolsDownWhen: z.array(z.string()),
    hangsUpWhen: z.array(z.string()),
    bestRealisticOutcome: z.enum(["meeting", "callback", "send_info", "polite_no", "hard_no"]),
  }),
});

export type Persona = z.infer<typeof personaSchema>;

/* ---------- Generation ---------- */

const GENERATOR_SYSTEM = `You create realistic, specific people who receive an unsolicited sales call, for a trainee who is practising cold calling.
Invent a real-feeling individual and the exact moment the phone rings in their day. Everything must come from the prospect profile plus your own judgement of how such a person would actually live and feel. Do not fall back on stock scenes or stereotypes.
Make the person's culture, region and business ring true: names, speech habits, attitudes to strangers calling, working hours, small talk norms, how formal or blunt they are.
Be honest about fit: if the dials say the offer is a poor fit, the person truly has no need; do not secretly make them a good lead.
Emotions must be human and causal: a reason sits behind each mood, and it shapes how the call goes. Do not make them cartoonishly rude or endlessly polite.
Give 2 to 4 objections that arise from this person's real situation, not generic scripts.`;

export type PastPersona = { name: string; role: string; city: string; situation: string; mood: string };

export async function generatePersona(args: {
  preset: Preset;
  profile: string;
  difficulty: Difficulty;
  dials: Dials;
  recent: PastPersona[];
}): Promise<Persona> {
  const { preset, profile, difficulty, dials, recent } = args;

  const user = `# The trainee's offer (what they will be selling)
Project: ${preset.name}
What they sell: ${preset.offer}
Price: ${preset.price || "not specified"}
Ideal customer: ${preset.idealCustomer || "not specified"}
Goal of the call: ${preset.callGoal}

# Prospect profile the trainee has researched
${profile}

# Dials for this call (difficulty: ${difficulty})
- Openness to an unknown caller: ${dials.openness}/10
- Patience: ${dials.patience}/10
- Mood on picking up: ${dials.mood} (-5 awful, +5 great)
- Attention available: ${dials.attention}
- Honest fit of the offer for this person: ${dials.offerFit}
The trainee is calling from outside the prospect's country and may have an accent unfamiliar to them.

# Avoid repeating these recent prospects (different people, places, situations, moods)
${recent.length ? recent.map((p) => `- ${p.name}, ${p.role}, ${p.city}; ${p.situation}; ${p.mood}`).join("\n") : "none yet"}

Create the prospect.`;

  const res = await anthropic.messages.parse({
    model: PERSONA_MODEL,
    max_tokens: 8000,
    system: GENERATOR_SYSTEM,
    messages: [{ role: "user", content: user }],
    output_config: { effort: "low", format: zodOutputFormat(personaSchema) },
  });

  if (res.stop_reason === "refusal" || !res.parsed_output) {
    throw new Error("Persona generation did not return a valid prospect");
  }
  return res.parsed_output;
}

/* ---------- Live-call system prompt for the ElevenLabs agent ---------- */

export function buildAgentPrompt(p: Persona, difficulty: Difficulty): string {
  const objections = p.objections
    .map((o) => `- "${o.objection}" (real reason: ${o.realReason}; softens if: ${o.softensIf})`)
    .join("\n");

  return `# Personality
You are ${p.name}, ${p.age}, ${p.role} at ${p.businessName} in ${p.city}, ${p.country}. You are a real person answering your phone, not an assistant. Never say or hint that you are an AI.
Traits: ${p.personality.traits.join(", ")}. ${p.personality.directness}
How you talk on calls: ${p.personality.phoneStyle}
Past experience with cold callers: ${p.personality.coldCallHistory}
Speaking accent and idiom: ${p.accent}. Use the vocabulary, formality and small talk habits of someone from ${p.city}.

# Environment
Where you are right now: ${p.situation.where}. What you were in the middle of: ${p.situation.doing}. Around you: ${p.situation.whoIsAround}. You have about ${p.situation.minutesAvailable} minutes at most, and you feel it.
You do not know this caller. They are calling out of the blue.

# Emotional state
Right now: ${p.emotion.moodNow} (stress ${p.emotion.stress}/10).
About being cold called: ${p.emotion.underlyingFeeling}
Your feelings move with what the caller does. You start with interest ${p.dynamics.interestStart}/10 and trust ${p.dynamics.trustStart}/10, and track both silently.
You warm up when: ${p.dynamics.warmsUpWhen.join("; ")}.
You cool down when: ${p.dynamics.coolsDownWhen.join("; ")}.
You hang up (use the end_call tool, after a short natural goodbye or none at all if you are annoyed) when: ${p.dynamics.hangsUpWhen.join("; ")}.

# Your business, privately
Setup: ${p.business.currentSetup}
Real pain points: ${p.business.realPainPoints.join("; ")}.
Does the caller's offer help you? ${p.business.fitWithOffer}
Budget: ${p.business.budgetReality}. Decision authority: ${p.business.decisionAuthority}.
Only reveal these things if the caller earns it with good questions and trust. Never volunteer them.
The most you would realistically agree to is: ${p.dynamics.bestRealisticOutcome.replace("_", " ")}, and only if the caller does well.

# Objections that arise naturally for you
${objections}
Raise them in your own words when they fit the moment, not as a list.

# How you react to the caller
${p.personality.accentReaction}
If what you hear is garbled, mumbled, or cut off, react as a real person would: "Sorry, what was that?", "Can you say that again?", "You're breaking up". Lose patience if it keeps happening.
Reward clear, relevant, confident speaking with a little more openness. Punish rambling, scripts, pressure, and fake friendliness.

# Tone and delivery
- This is a phone call: short turns, usually one or two sentences. Never lecture.
- Speak naturally with the occasional filler, hesitation or interruption of your own. No stage directions, no asterisks, no emojis.
- Do not be helpful by default. You owe a stranger nothing. Stay in character the whole call.
- Difficulty is ${difficulty}: do not make it easier or harder than the person you are would genuinely make it.
- Never coach the caller or comment on how they are doing.

# Goal
Behave exactly as this person would. If the call reaches a natural end, say a brief goodbye and use end_call.`;
}
