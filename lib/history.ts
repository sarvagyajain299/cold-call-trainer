// "Memory" for the coach. Built by code from the scorecards already stored, never by an AI, and kept small
// (about 1,200 tokens). Old full reports are NEVER sent to the model.

import { countHabits } from "@/lib/progress";
import { HABITS } from "@/lib/habits";
import { quoteAppears } from "@/lib/reportVerify";
import type { StoredReport } from "@/lib/scoring";
import type { Turn } from "@/lib/transcript";

export type PriorCall = { sessionId: string; createdAt: number; difficulty: string; report: StoredReport };

export type FocusCheck = {
  focus: string;
  verdict: "followed" | "partly" | "not_followed" | "no_previous";
  evidenceQuote: string;
  evidenceTimeSecs: number;
  comment: string;
};

export type History = {
  text: string;
  /** The focus the trainee was given after their most recent earlier call. */
  lastFocus: { focus: string; personName: string; createdAt: number };
};

const MAX_CHARS = 4800; // about 1,200 tokens
const MAX_CALLS = 5;

const clip = (s: string, n: number) => {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
};

const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);

function callLine(c: PriorCall): string {
  const a = c.report.analysis;
  const stages = a.stages.map((s) => `${s.stage} ${s.score}`).join(", ");
  const fixes = a.topFixes.map((f) => clip(f.fix, 110)).join(" | ");
  return `- ${day(c.createdAt)}, ${c.report.persona.name} (${c.difficulty}): rating ${a.overallRating}, goal chance ${a.conversionScore}%. Stages: ${stages}. Focus given: "${clip(a.focusNextCall, 200)}". Fixes: ${fixes}.`;
}

/** `priorNewestFirst` must only contain scored calls from BEFORE the one being scored. */
export function buildHistory(priorNewestFirst: PriorCall[], samePersonNewestFirst: PriorCall[]): History | null {
  if (priorNewestFirst.length === 0) return null;
  // A redo is practised against the focus from that same person's last call; otherwise use the latest call overall.
  const latest = samePersonNewestFirst[0] ?? priorNewestFirst[0];

  const habits = countHabits(priorNewestFirst.map((c) => c.report), 10).slice(0, 3);
  const habitText = habits.length
    ? habits.map((h) => `- ${HABITS[h.id] ?? h.id}: appeared in ${h.calls} of the last ${h.outOf} tagged calls`).join("\n")
    : "";

  const same = samePersonNewestFirst[0];
  let sameText = "";
  if (same) {
    const a = same.report.analysis;
    const quotes = a.moments
      .filter((m) => m.kind === "miss")
      .slice(0, 2)
      .map((m) => `"${clip(m.quote, 140)}" (${m.speaker}, ${m.timeSecs}s)`)
      .join("; ");
    sameText = `# The same prospect last time (${same.report.persona.name}, ${day(same.createdAt)})
Focus given: "${clip(a.focusNextCall, 200)}". Fixes: ${a.topFixes.map((f) => clip(f.fix, 110)).join(" | ")}.${quotes ? ` Key misses: ${quotes}.` : ""}
`;
  }

  const build = (n: number) => {
    const lines = priorNewestFirst.slice(0, n).map(callLine).join("\n");
    return `# The trainee's recent earlier calls (newest first). Use them to judge progress; do not repeat advice they have clearly fixed.
${lines}
${habitText ? `\n# Habits that keep recurring (counted by code)\n${habitText}\n` : ""}${sameText ? `\n${sameText}` : ""}
# The focus to check this time
After their last call the trainee was told to focus on: "${clip(latest.report.analysis.focusNextCall, 200)}" (call with ${latest.report.persona.name}, ${day(latest.createdAt)}).`;
  };

  let n = Math.min(MAX_CALLS, priorNewestFirst.length);
  let text = build(n);
  while (text.length > MAX_CHARS && n > 1) text = build(--n);

  return {
    text,
    lastFocus: { focus: latest.report.analysis.focusNextCall, personName: latest.report.persona.name, createdAt: latest.createdAt },
  };
}

/** Code is the authority on what the previous focus was; the quote must really appear in this call. */
export function finalizeFocusCheck(check: FocusCheck | undefined, history: History | null, turns: Turn[]): FocusCheck {
  if (!history || !check || check.verdict === "no_previous") {
    return { focus: "", verdict: "no_previous", evidenceQuote: "", evidenceTimeSecs: 0, comment: "" };
  }
  const verified = check.evidenceQuote.trim() !== "" && quoteAppears(check.evidenceQuote, turns);
  return {
    focus: history.lastFocus.focus,
    verdict: check.verdict,
    evidenceQuote: verified ? check.evidenceQuote : "",
    evidenceTimeSecs: verified ? check.evidenceTimeSecs : 0,
    comment: check.comment,
  };
}
