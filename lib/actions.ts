"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { presets, sessions } from "@/db/schema";
import { presetInput, sessionInput } from "@/lib/validation";
import { attemptsFor, completeLesson, getLesson } from "@/lib/lessons/store";
import { cueLine } from "@/lib/lessons/model";

export type FormState = { error?: string } | undefined;

export async function createPreset(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = presetInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  db.insert(presets)
    .values({ id: randomUUID(), createdAt: Date.now(), ...parsed.data })
    .run();
  revalidatePath("/");
  redirect("/");
}

// Starts a fresh call against the same prospect: same person, mood and situation, so you can try again.
// The persona is copied, so no new one is generated and nothing is spent on Anthropic.
function copySession(sourceId: string, extra: { cueCard?: string } = {}): string {
  const source = db.select().from(sessions).where(eq(sessions.id, sourceId)).get();
  if (!source?.persona) throw new Error("That call has no prospect to reuse");

  const id = randomUUID();
  db.insert(sessions)
    .values({
      id,
      presetId: source.presetId,
      profile: source.profile,
      difficulty: source.difficulty,
      persona: source.persona,
      createdAt: Date.now(),
      ...extra,
    })
    .run();
  revalidatePath("/calls");
  return id;
}

export async function redoCall(sourceId: string) {
  redirect(`/call/${copySession(sourceId)}`);
}

// "Try it on [prospect] again" from a lesson: the same call again, with the lesson's line pinned on the script.
export async function redoWithCue(sessionId: string, lessonId: string) {
  const lesson = getLesson(lessonId);
  if (!lesson || lesson.sessionId !== sessionId) throw new Error("Lesson not found");
  const line = cueLine(lesson.data.cueCard.line, attemptsFor(lesson.id));
  const cueCard = JSON.stringify({ label: lesson.data.cueCard.label, line, lessonId: lesson.id });
  if (lesson.status !== "done") completeLesson(lesson);
  redirect(`/call/${copySession(sessionId, { cueCard })}`);
}

export async function createSession(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = sessionInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const id = randomUUID();
  db.insert(sessions).values({ id, createdAt: Date.now(), ...parsed.data }).run();
  redirect(`/call/${id}`);
}
