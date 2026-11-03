"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { cheatSheets, presets } from "@/db/schema";
import { generateForPreset } from "@/lib/cheatsheet";
import { applyGenerated, normalizeSheet } from "@/lib/sheetModel";
import { getSheet } from "@/lib/sheetData";

export type SheetResult = { error?: string; ok?: boolean };

const saveInput = z.array(z.object({ id: z.string(), lines: z.array(z.string().max(500)).max(60) })).max(20);

function write(presetId: string, sections: unknown, generated: boolean) {
  const json = JSON.stringify(sections);
  const now = Date.now();
  const existing = db.select().from(cheatSheets).where(eq(cheatSheets.presetId, presetId)).get();
  if (existing) {
    db.update(cheatSheets)
      .set({ sections: json, updatedAt: now, ...(generated ? { generatedAt: now } : {}) })
      .where(eq(cheatSheets.presetId, presetId))
      .run();
  } else {
    db.insert(cheatSheets).values({ presetId, sections: json, generatedAt: generated ? now : null, updatedAt: now }).run();
  }
}

/** Spends Anthropic credit (about $0.10-0.15): writes the offer-specific sections. Edits to generic sections and notes are kept. */
export async function generateSheet(presetId: string): Promise<SheetResult> {
  const preset = db.select().from(presets).where(eq(presets.id, presetId)).get();
  if (!preset) return { error: "Project not found" };
  try {
    const generated = await generateForPreset(preset);
    write(presetId, applyGenerated(getSheet(presetId).sections, generated), true);
  } catch (err) {
    console.error("cheat sheet generation failed", err);
    return { error: "Could not generate the cheat sheet. Try again." };
  }
  revalidatePath(`/cheatsheet/${presetId}`);
  return { ok: true };
}

export async function saveSheet(presetId: string, sections: { id: string; lines: string[] }[]): Promise<SheetResult> {
  const parsed = saveInput.safeParse(sections);
  if (!parsed.success) return { error: "That sheet is too long or malformed." };
  if (!db.select().from(presets).where(eq(presets.id, presetId)).get()) return { error: "Project not found" };
  const cleaned = parsed.data.map((s) => ({ id: s.id, lines: s.lines.map((l) => l.trim()).filter(Boolean) }));
  write(presetId, normalizeSheet(cleaned), false);
  revalidatePath(`/cheatsheet/${presetId}`);
  return { ok: true };
}
