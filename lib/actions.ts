"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { presets, sessions } from "@/db/schema";
import { presetInput, sessionInput } from "@/lib/validation";

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
export async function redoCall(sourceId: string) {
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
    })
    .run();
  revalidatePath("/calls");
  redirect(`/call/${id}`);
}

export async function createSession(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = sessionInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const id = randomUUID();
  db.insert(sessions).values({ id, createdAt: Date.now(), ...parsed.data }).run();
  redirect(`/call/${id}`);
}
