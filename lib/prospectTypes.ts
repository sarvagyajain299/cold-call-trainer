// Pure helpers for saved prospect types (safe to import from client components).
import type { ProspectType } from "@/db/schema";

/** The saved types for one project, oldest first, so the dropdown order matches the project page. */
export function typesForPreset(all: ProspectType[], presetId: string | undefined): ProspectType[] {
  if (!presetId) return [];
  return all.filter((t) => t.presetId === presetId).sort((a, b) => a.createdAt - b.createdAt);
}
