import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, PERSONA_MODEL } from "@/lib/anthropic";
import { db } from "@/lib/db";
import { presets } from "@/db/schema";
import { logUsage } from "@/lib/usage";
import { quoteAppears } from "@/lib/reportVerify";
import type { Turn } from "@/lib/transcript";
import type { StoredReport } from "@/lib/scoring";
import {
  cleanReply,
  clipFor,
  nextProspectTurn,
  nextTraineeTurn,
  shuffle,
  turnId,
  turnIndex,
  wordCount,
  type Check,
  type GutCheck,
  type Lesson,
  type LessonData,
} from "@/lib/lessons/model";
import { getReport, insertLessons, lessonsForSession } from "@/lib/lessons/store";

// One Opus call per scorecard writes only the words that do not exist yet. Everything else
// (turns, word counts, clip times, the user's own reply, the coach's better line, the prospect's
// real reaction) is taken from the stored report by code.

export const lessonWritingSchema = z.object({
  lessons: z
    .array(
      z.object({
        title: z.string().describe("Short action title in plain words, e.g. 'Answer money questions in one sentence'"),
        rule: z.string().describe("One memorable rule of at most 12 words, e.g. 'One question. One sentence. One number. Then stop talking.'"),
        findItTurnIds: z.array(z.string()).describe("1 to 3 ids of TRAINEE turns that show this problem most clearly, e.g. ['t13','t15']"),
        findItPrompt: z.string().describe("The question asking the trainee to tap the turn that caused the problem, at most 14 words"),
        findItHint: z.string().describe("A gentle hint after a wrong tap, at most 12 words, e.g. 'Look for the longest bars on your line.'"),
        findItExplanation: z
          .string()
          .describe("1 to 2 sentences on why those turns were the problem and how the prospect reacted. Do NOT state word counts or other numbers; the app shows them."),
        chooseProspectTurnId: z.string().describe("Id of the PROSPECT turn the trainee replied to badly (the trainee turn right after it shows this problem)"),
        chooseProspectQuote: z.string().describe("The key words of that prospect turn, copied EXACTLY from it, at most 30 words"),
        distractor: z.string().describe("A plausible but wrong reply to that prospect line that breaks this lesson's rule in a different way, under 30 words"),
        chooseRightExplanation: z.string().describe("1 to 2 sentences on why the better reply works for THIS prospect"),
        chooseWrongHint: z.string().describe("A kind hint after a wrong pick, at most 15 words, pointing at the rule without giving the answer"),
        practiceProspectTurnId: z
          .string()
          .describe("Id of a real PROSPECT turn, different from the choose turn, with a question this rule applies to. Empty string if none fits."),
        practiceQuestion: z.string().describe("If a turn id is given: the question copied EXACTLY from that turn. Otherwise a short question this prospect would plausibly ask."),
        practiceContext: z.string().describe("1 to 2 sentences on the prospect's real situation and fears that matter for this answer"),
        checks: z
          .array(
            z.object({
              id: z.string().describe("short kebab-case id"),
              label: z.string().describe("At most 6 words, e.g. 'Under about 20 words'"),
              criterion: z.string().describe("Exactly what passes, so a grader can decide from the transcript alone"),
            }),
          )
          .describe("Exactly 3 checks for the practice answer, specific to this rule and this prospect's fears"),
        modelLine: z.string().describe("The ideal spoken answer to the practice question, at most 20 words, using only facts from the offer and the call"),
        cueLabel: z.string().describe("A 2 to 5 word label naming the moment of the PRACTICE question (the cue card holds the model line for it), e.g. 'When he asks about updates'"),
      }),
    )
    .describe("One lesson per fix, in the same order as the fixes"),
  gutReconcileReview: z
    .string()
    .describe("If the trainee wrote a self-review: 1 to 2 short sentences reconciling it with the real result (rating and outcome), ending on a forward note. Empty string if there is no self-review."),
  gutReconcileWell: z.string().describe("Reply if the trainee says the call went well, 1 to 2 short sentences reconciling it with the real result"),
  gutReconcileMixed: z.string().describe("Reply if the trainee says the call was mixed"),
  gutReconcileBadly: z.string().describe("Reply if the trainee says the call went badly"),
  feelingLevels: z
    .array(z.number())
    .describe("For each prospect feeling listed, in order: 0 = guarded or hostile, 1 = wary, 2 = neutral, 3 = interested, 4 = open and warm"),
});

export type LessonWriting = z.infer<typeof lessonWritingSchema>;

const SYSTEM = `You are a world-class cold-call coach turning a scored practice call into three short lessons, one per fix. The trainee is an Indian professional in Dubai who is new to cold calling. Write plainly and kindly, like a human coach sitting next to them. Never invent facts about the call: every turn id must come from the transcript list, every quote must be copied exactly, and every price or detail in a model line must come from the offer or the call.`;

function turnList(turns: Turn[]): string {
  return turns
    .map((t, i) => `[${turnId(i)} ${Math.round(t.t)}s ${t.role === "trainee" ? "TRAINEE" : "PROSPECT"} ${wordCount(t.text)}w] ${t.text}`)
    .join("\n");
}

export function buildPrompt(report: StoredReport, offer: { name: string; offer: string; price: string; callGoal: string }, selfReview: string | null) {
  const a = report.analysis;
  const p = report.persona;
  return `# The offer
Project: ${offer.name}
Offer: ${offer.offer}
Price: ${offer.price || "not specified"}
Goal of the call: ${offer.callGoal}

# The prospect (now revealed)
${p.name}, ${p.role} at ${p.businessName}, ${p.city}.
Who they were: ${a.personaReveal.whoTheyWere}
Hidden truth: ${a.personaReveal.hiddenTruth}
Pain points: ${p.business.realPainPoints.join("; ")}
Objections: ${p.objections.map((o) => `"${o.objection}" (really: ${o.realReason})`).join("; ")}

# Result
Headline: ${a.headline}
Rating: ${a.overallRating}/10. Chance of the goal: ${a.conversionScore}%. Outcome: ${a.outcome}.
Trainee's self-review: ${selfReview?.trim() || "(none)"}

# The three fixes (one lesson each, in this order)
${a.topFixes.map((f, i) => `${i + 1}. [${f.tag}] ${f.oneLine}\n   Fix: ${f.fix}\n   Why: ${f.why}`).join("\n")}

# Coach's key moments
${a.moments.map((m) => `${Math.round(m.timeSecs)}s ${m.speaker} ${m.kind}${m.tag ? ` [${m.tag}]` : ""}: "${m.quote}"${m.betterLine ? ` -> better: "${m.betterLine}"` : ""}`).join("\n")}

# Prospect feelings over the call (give one level each, in this order)
${a.personaReveal.feelings.map((f, i) => `${i + 1}. ${Math.round(f.timeSecs)}s: ${f.feeling}`).join("\n")}

# Transcript (turn id, start time, speaker, word count)
${turnList(report.transcript)}

# Your task
Write one lesson per fix, in order. Pick turn ids only from the transcript list above. For "find it", pick the trainee turns that best show the problem. For "choose", pick the prospect turn the trainee answered badly. For practice, prefer a real prospect question from the call that this rule applies to, different from the choose turn. Make the 3 checks concrete enough to grade from a transcript.`;
}

const roleAt = (turns: Turn[], id: string, role: Turn["role"]) => {
  const i = turnIndex(id);
  return i >= 0 && i < turns.length && turns[i].role === role ? i : -1;
};

/** The substring of `text` that the model quoted, if it really appears; otherwise null. */
function verifiedQuote(quote: string, turn: Turn): string | null {
  const q = quote.trim().replace(/^["“]|["”]$/g, "");
  if (!q) return null;
  return quoteAppears(q, [turn]) ? q : null;
}

/** Trainee turns the coach tagged with this habit: the fallback when the model's ids are wrong. */
function taggedTurns(report: StoredReport, tag: string): number[] {
  const turns = report.transcript;
  const out = new Set<number>();
  for (const m of report.analysis.moments) {
    if (m.speaker !== "trainee" || m.tag !== tag) continue;
    let best = -1;
    turns.forEach((t, i) => {
      if (t.role === "trainee" && t.t <= m.timeSecs + 1) best = i;
    });
    if (best >= 0) out.add(best);
  }
  if (out.size === 0) {
    let longest = -1;
    turns.forEach((t, i) => {
      if (t.role === "trainee" && (longest < 0 || wordCount(t.text) > wordCount(turns[longest].text))) longest = i;
    });
    if (longest >= 0) out.add(longest);
  }
  return [...out].sort((x, y) => x - y);
}

/** The coach's better line for a trainee turn, from the report's moments. */
function betterLineFor(report: StoredReport, index: number): string | null {
  const turn = report.transcript[index];
  const next = report.transcript[index + 1]?.t ?? Infinity;
  const m = report.analysis.moments.find(
    (x) => x.speaker === "trainee" && x.kind === "miss" && x.betterLine && x.timeSecs >= turn.t - 1 && x.timeSecs < next,
  );
  return m?.betterLine ?? null;
}

export type Built = { lessons: Omit<Lesson, "id" | "sessionId" | "status" | "screen" | "gutPick" | "bestScore" | "reviewStep" | "nextReviewAt">[]; rejected: string[] };

/** Turns the model's writing into lessons, keeping only what checks out against the real call. */
export function assembleLessons(report: StoredReport, w: LessonWriting, selfReview: string | null, seed: string): Built {
  const turns = report.transcript;
  const dur = report.meta.durationSecs;
  const fixes = report.analysis.topFixes;
  const rejected: string[] = [];
  const prospectName = report.persona.name.split(" ")[0];
  const levels = report.analysis.personaReveal.feelings.map((_, i) => {
    const v = w.feelingLevels[i];
    return Number.isFinite(v) ? Math.max(0, Math.min(4, Math.round(v))) : 2;
  });

  if (w.lessons.length < fixes.length) throw new Error("The coach wrote fewer lessons than there are fixes");

  const lessons = fixes.map((fix, i) => {
    const l = w.lessons[i];
    const tag = `lesson ${i + 1}`;

    // Find it
    let findIdx = [...new Set(l.findItTurnIds.map((id) => roleAt(turns, id, "trainee")).filter((x) => x >= 0))].sort((a, b) => a - b);
    if (findIdx.length === 0) {
      rejected.push(`${tag}: find-it turns ${l.findItTurnIds.join(",")}`);
      findIdx = taggedTurns(report, fix.tag);
    }

    // Choose: the prospect line, the reply the trainee really gave, the coach's better line, the real reaction
    let chooseIdx = roleAt(turns, l.chooseProspectTurnId, "prospect");
    if (chooseIdx < 0 || !nextTraineeTurn(turns, chooseIdx)) {
      rejected.push(`${tag}: choose turn ${l.chooseProspectTurnId}`);
      chooseIdx = -1;
      for (let k = findIdx[0] - 1; k >= 0; k--) {
        if (turns[k].role === "prospect") {
          chooseIdx = k;
          break;
        }
      }
    }
    const chooseTurn = turns[Math.max(0, chooseIdx)];
    let quote = verifiedQuote(l.chooseProspectQuote, chooseTurn);
    if (!quote) {
      rejected.push(`${tag}: choose quote`);
      quote = chooseTurn.text;
    }
    const yoursAt = nextTraineeTurn(turns, chooseIdx);
    const yoursIdx = yoursAt?.index ?? findIdx[0];
    const reaction = nextProspectTurn(turns, yoursIdx);
    const model = betterLineFor(report, yoursIdx) ?? l.modelLine;

    // The rule's before/after: the first find-it turn against the coach's line for it
    const beforeIdx = findIdx[0];
    const after = betterLineFor(report, beforeIdx) ?? l.modelLine;

    // Practice: a real prospect question when the model found one that checks out
    let practiceIdx = l.practiceProspectTurnId ? roleAt(turns, l.practiceProspectTurnId, "prospect") : -1;
    let question = l.practiceQuestion.trim();
    if (practiceIdx >= 0) {
      const q = verifiedQuote(question, turns[practiceIdx]);
      if (q) question = q;
      else {
        rejected.push(`${tag}: practice quote`);
        practiceIdx = -1;
      }
    } else if (l.practiceProspectTurnId) {
      rejected.push(`${tag}: practice turn ${l.practiceProspectTurnId}`);
    }

    const checks: Check[] = l.checks.slice(0, 3);
    if (checks.length < 3) throw new Error(`The coach gave ${checks.length} practice checks for lesson ${i + 1}`);

    let gutCheck: GutCheck | undefined;
    if (i === 0) {
      gutCheck =
        selfReview?.trim() && w.gutReconcileReview.trim()
          ? { mode: "review", selfReview: selfReview.trim(), reconcile: w.gutReconcileReview.trim() }
          : {
              mode: "pick",
              options: [
                { label: "Went well", reconcile: w.gutReconcileWell },
                { label: "Mixed", reconcile: w.gutReconcileMixed },
                { label: "Went badly", reconcile: w.gutReconcileBadly },
              ],
            };
    }

    const data: LessonData = {
      prospectName,
      gutCheck,
      findIt: {
        prompt: l.findItPrompt,
        correctTurnIds: findIdx.map(turnId),
        hint: l.findItHint,
        explanation: l.findItExplanation,
        clip: clipFor(turns, findIdx[0], dur),
      },
      choose: {
        prospectQuote: quote,
        clip: clipFor(turns, chooseIdx, dur),
        options: shuffle(
          [
            { text: cleanReply(turns[yoursIdx].text), kind: "yours" as const },
            { text: model, kind: "model" as const },
            { text: l.distractor, kind: "distractor" as const },
          ],
          `${seed}:${i}`,
        ),
        rightExplanation: l.chooseRightExplanation,
        wrongHint: l.chooseWrongHint,
        reaction: reaction ? { text: reaction.turn.text, clip: clipFor(turns, reaction.index, dur)! } : undefined,
      },
      ruleScreen: {
        before: { text: cleanReply(turns[beforeIdx].text, 60), words: wordCount(turns[beforeIdx].text), clip: clipFor(turns, beforeIdx, dur) },
        after: { text: after, words: wordCount(after) },
      },
      practice: {
        prospectQuestion: question,
        clip: practiceIdx >= 0 ? clipFor(turns, practiceIdx, dur) : undefined,
        context: l.practiceContext,
        checks,
        modelLine: l.modelLine,
      },
      cueCard: { label: l.cueLabel, line: l.modelLine },
      feelingLevels: levels,
      skipped: [],
    };
    return { ord: i + 1, title: l.title, rule: l.rule, data };
  });

  return { lessons, rejected };
}

async function write(report: StoredReport, sessionId: string, presetId: string, selfReview: string | null): Promise<LessonWriting> {
  const preset = db.select().from(presets).where(eq(presets.id, presetId)).get();
  const offer = { name: preset?.name ?? "", offer: preset?.offer ?? "", price: preset?.price ?? "", callGoal: preset?.callGoal ?? "" };
  const res = await anthropic.messages.parse({
    model: PERSONA_MODEL,
    max_tokens: 16000,
    system: SYSTEM,
    messages: [{ role: "user", content: buildPrompt(report, offer, selfReview) }],
    output_config: { effort: "medium", format: zodOutputFormat(lessonWritingSchema) },
  });
  await logUsage(sessionId, "lessons_generate", PERSONA_MODEL, res.usage);
  if (res.stop_reason === "refusal" || !res.parsed_output) throw new Error("The coach did not return valid lessons");
  return res.parsed_output as LessonWriting;
}

const inFlight = new Map<string, Promise<Lesson[]>>();

/** Lessons for a scored call. Made once with one Opus call, then always read from the database. */
export function generateLessons(sessionId: string): Promise<Lesson[]> {
  const existing = lessonsForSession(sessionId);
  if (existing.length) return Promise.resolve(existing);
  const running = inFlight.get(sessionId);
  if (running) return running;
  const job = (async () => {
    const found = getReport(sessionId);
    if (!found) throw new Error("This call has no scorecard yet");
    if (!found.report.analysis.topFixes.length) throw new Error("This scorecard has no fixes to teach");
    const writing = await write(found.report, sessionId, found.presetId, found.selfReview);
    const built = assembleLessons(found.report, writing, found.selfReview, sessionId);
    if (built.rejected.length) console.warn("lessons: replaced unverified fields with call data:", built.rejected.join("; "));
    const now = Date.now();
    insertLessons(
      built.lessons.map((l) => ({
        id: randomUUID(),
        sessionId,
        ord: l.ord,
        title: l.title,
        rule: l.rule,
        data: JSON.stringify(l.data),
        createdAt: now,
        updatedAt: now,
      })),
    );
    return lessonsForSession(sessionId);
  })().finally(() => inFlight.delete(sessionId));
  inFlight.set(sessionId, job);
  return job;
}
