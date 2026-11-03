import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { cheatSheets, sessions } from "@/db/schema";
import { normalizeSheet, type Section } from "@/lib/sheetModel";
import { countHabits, type HabitCount } from "@/lib/progress";
import type { StoredReport } from "@/lib/scoring";

export type StoredSheet = { sections: Section[]; generatedAt: number | null; exists: boolean };

export function getSheet(presetId: string): StoredSheet {
  const row = db.select().from(cheatSheets).where(eq(cheatSheets.presetId, presetId)).get();
  if (!row) return { sections: normalizeSheet(null), generatedAt: null, exists: false };
  let raw: unknown = null;
  try {
    raw = JSON.parse(row.sections);
  } catch {
    // fall back to defaults
  }
  return { sections: normalizeSheet(raw), generatedAt: row.generatedAt, exists: true };
}

export type Personal = {
  focus: string | null;
  focusFrom: string | null;
  habits: HabitCount[];
};

/** From the user's own scorecards: the last focus they were given and their top recurring habits. */
export function getPersonal(): Personal {
  const reports = db
    .select()
    .from(sessions)
    .all()
    .filter((s) => s.report)
    .map((s) => JSON.parse(s.report as string) as StoredReport)
    .sort((a, b) => b.createdAt - a.createdAt);
  if (reports.length === 0) return { focus: null, focusFrom: null, habits: [] };
  return {
    focus: reports[0].analysis.focusNextCall,
    focusFrom: reports[0].persona.name.split(" ")[0],
    habits: countHabits(reports, 10).slice(0, 3),
  };
}
