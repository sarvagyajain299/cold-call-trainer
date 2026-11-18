"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { presets, prospectTypes } from "@/db/schema";
import { prospectTypeInput } from "@/lib/validation";

export type TypeResult = { error?: string; ok?: boolean };

/** Adds a prospect type (no id) or updates one (with id). Free: no AI. */
export async function saveProspectType(presetId: string, input: { id?: string; label: string; profile: string }): Promise<TypeResult> {
  const parsed = prospectTypeInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!db.select().from(presets).where(eq(presets.id, presetId)).get()) return { error: "Project not found" };

  if (input.id) {
    const res = db
      .update(prospectTypes)
      .set(parsed.data)
      .where(and(eq(prospectTypes.id, input.id), eq(prospectTypes.presetId, presetId)))
      .run();
    if (res.changes === 0) return { error: "That prospect type no longer exists." };
  } else {
    db.insert(prospectTypes).values({ id: randomUUID(), presetId, createdAt: Date.now(), ...parsed.data }).run();
  }
  revalidatePath(`/projects/${presetId}`);
  return { ok: true };
}

export async function deleteProspectType(presetId: string, id: string): Promise<TypeResult> {
  db.delete(prospectTypes).where(and(eq(prospectTypes.id, id), eq(prospectTypes.presetId, presetId))).run();
  revalidatePath(`/projects/${presetId}`);
  return { ok: true };
}
