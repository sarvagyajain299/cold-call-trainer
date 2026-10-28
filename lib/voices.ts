import type { Persona } from "@/lib/persona";

// These four IDs are the ones documented in the ElevenLabs agents skill, so they are safe defaults.
// TODO: replace with a catalog built from the shared voice library so each region (US, UK, AU, EU, GCC)
// gets a matching accent. The key now has the voices_read permission.
const FALLBACK = {
  male: ["JBFqnCBsd6RMkjVDRZzb" /* George */, "onwK4e9ZLuTAKqWW03F9" /* Daniel */],
  female: ["EXAVITQu4vr4xnSDxMaL" /* Sarah */, "XB0fDUnXU5powFXDhCwa" /* Charlotte */],
} as const;

// A small, stable string hash (FNV-1a), so the same person always gets the same voice.
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function pickVoice(p: Pick<Persona, "gender" | "name" | "city">): string {
  const pool = FALLBACK[p.gender];
  return pool[hash(`${p.name}|${p.city}`) % pool.length];
}
