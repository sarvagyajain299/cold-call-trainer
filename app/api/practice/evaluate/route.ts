import { randomUUID } from "node:crypto";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { practiceAttempts, presets, sessions } from "@/db/schema";
import { evaluateAnswer } from "@/lib/lessons/evaluate";
import { MAX_ATTEMPTS, wordCount, wpm as wordsPerMinute } from "@/lib/lessons/model";
import { getLesson, toAttempt, updateLesson } from "@/lib/lessons/store";

const body = z.object({
  lessonId: z.string().min(1),
  transcript: z.string().trim().min(1, "Say or type an answer first").max(2000),
  mode: z.enum(["voice", "typed"]),
  attemptNumber: z.number().int().min(1).max(MAX_ATTEMPTS),
  isReview: z.boolean().default(false),
  durationSec: z.number().min(0).max(600).optional(),
  speakingSec: z.number().min(0).max(600).optional(),
  previousTranscript: z.string().max(2000).nullish(),
  audioId: z.string().uuid().optional(),
});

// Always saves the attempt, even when the AI check fails, so nothing you said is lost.
export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const p = parsed.data;
  const lesson = getLesson(p.lessonId);
  if (!lesson) return Response.json({ error: "Lesson not found" }, { status: 404 });

  // Speaking time from Deepgram's word span, else the length of the recording. Typed answers have no pace.
  const speaking = p.mode === "voice" ? p.speakingSec || p.durationSec || 0 : 0;
  const pace = p.mode === "voice" ? wordsPerMinute(wordCount(p.transcript), speaking) : null;

  const session = db.select({ presetId: sessions.presetId }).from(sessions).where(eq(sessions.id, lesson.sessionId)).get();
  const preset = session ? db.select().from(presets).where(eq(presets.id, session.presetId)).get() : undefined;
  const offer = preset ? { offer: preset.offer, price: preset.price } : null;

  let result = null;
  let score: number | null = null;
  let error: string | null = null;
  try {
    const out = await evaluateAnswer(
      { lesson, transcript: p.transcript, previousTranscript: p.previousTranscript, wpm: pace, offer },
      { sessionId: lesson.sessionId, kind: `practice_eval:${lesson.id}` },
    );
    result = out.result;
    score = out.score;
  } catch (err) {
    console.error("practice check failed", err instanceof Error ? err.message : err);
    error = "Couldn't check that one. Try again.";
  }

  const row = {
    id: p.audioId ?? randomUUID(),
    lessonId: lesson.id,
    attemptNumber: p.attemptNumber,
    mode: p.mode,
    isReview: p.isReview ? 1 : 0,
    transcript: p.transcript,
    audioPath: p.audioId ? `recordings/practice/${p.audioId}.webm` : null,
    durationSec: p.durationSec ?? null,
    speakingSec: p.mode === "voice" ? speaking : null,
    wpm: pace,
    result: result ? JSON.stringify(result) : null,
    score,
    error,
    createdAt: Date.now(),
  };
  // Re-checking the same recording after a failed check updates that attempt instead of adding one.
  db.insert(practiceAttempts)
    .values(row)
    .onConflictDoUpdate({ target: practiceAttempts.id, set: { result: row.result, score, error, wpm: pace } })
    .run();
  if (score !== null && !p.isReview && score > (lesson.bestScore ?? -1)) updateLesson(lesson.id, { bestScore: score });

  return Response.json({ attempt: toAttempt(row) }, { status: error ? 502 : 200 });
}
