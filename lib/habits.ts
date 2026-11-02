// Fixed vocabulary of calling habits. The coach tags every miss with one of these so that code
// (not the AI) can count them across calls. Draft list from the plan; finalised in Phase 3.

export const HABITS: Record<string, string> = {
  wrong_name: "Wrong or unchecked name",
  no_reason_for_call: "No clear reason for the call",
  rushed_opener: "Rushed opener",
  bad_time_opener: "Asked 'is this a bad time?'",
  apologetic_language: "Apologetic language",
  vague_offer: "Vague offer",
  jargon: "Jargon",
  pitch_too_long: "Pitch too long",
  discounting_too_early: "Discounted too early",
  closed_questions: "Closed questions",
  missed_buying_signal: "Missed buying signal",
  talked_over_prospect: "Talked over the prospect",
  no_silence_after_question: "No silence after a question",
  argued_with_objection: "Argued with an objection",
  accepted_brush_off: "Accepted a brush-off",
  no_ask: "No ask",
  vague_ask_no_day_time: "Vague ask, no day or time",
  weak_contact_details: "Weak contact details",
  unclear_goal: "Unclear goal",
  monologue: "Monologue",
  trailing_off: "Trailing off",
  rising_end_unsure: "Rising end, sounds unsure",
  fillers: "Fillers",
  pace_too_fast: "Pace too fast",
  flat_voice: "Flat voice",
  confusing_phrases: "Confusing phrases",
  no_proof: "No proof",
  dodged_where_from: "Dodged 'where are you from?'",
  lost_control_after_derail: "Lost control after a derail",
};

export const HABIT_IDS = Object.keys(HABITS);

/** Returns a known habit id, or "" (wins, or anything the coach made up). */
export function normalizeTag(tag: string | undefined | null): string {
  const t = (tag ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return t in HABITS ? t : "";
}

export const HABIT_INSTRUCTION = `For every item you give a "oneLine" (a plain summary of at most 15 words) and a "tag": for a miss, fix, objection or missed signal pick the single best habit id from this list, for anything else use an empty string. Habit ids: ${HABIT_IDS.join(", ")}.`;
