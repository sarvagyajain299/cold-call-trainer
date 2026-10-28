import type { Turn } from "@/lib/transcript";

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * True when every fragment of the quote (split on "...") appears in the transcript.
 * The scorer is told to quote exactly; this guarantees the report never shows words nobody said.
 */
export function quoteAppears(quote: string, turns: Turn[], role?: Turn["role"]): boolean {
  const haystack = normalize(turns.filter((t) => !role || t.role === role).map((t) => t.text).join(" \n "));
  const fragments = quote
    .split(/\.{2,}|…/)
    .map(normalize)
    .filter((f) => f.split(" ").length >= 2);
  if (fragments.length === 0) return false;
  return fragments.every((f) => haystack.includes(f));
}

/** Keep only items whose quote really appears; returns the survivors and how many were dropped. */
export function keepVerified<T extends { quote: string }>(
  items: T[],
  turns: Turn[],
  role?: Turn["role"],
): { kept: T[]; dropped: number } {
  const kept = items.filter((i) => quoteAppears(i.quote, turns, role));
  return { kept, dropped: items.length - kept.length };
}
