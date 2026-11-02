# Plan: scorecard redesign, memory between calls, cheat sheet

Status: **PLAN ONLY. Nothing in this file has been built.** The user must say "start phase N" before any work begins.
Written 2026-11-03 after the user reviewed the live app. Read `PROJECT_CONTEXT.md` first for the system as it exists today.

## 1. Why this plan exists
The user used the app and gave feedback:
- The scorecard is **too much, too chaotic**. They like all the information and want **none of it removed**, only presented better.
- **Memory between calls** is wanted (the coach should know earlier calls).
- Instead of live "hand-holding" during a call, they want a **cheat sheet** to look at before and during the call.

Measured on the real scorecards (2026-11-03): about 4,500-5,000 words of coaching for a call with about 550 words of conversation (8-10x). 12+ sections, about 15 scores, up to 10 key moments, up to 7 objections, fixes averaging 190-260 words each, everything open at once with equal weight. Even a 13-second call produced about 2,600 words.

Also observed: the Ahmed redo improved opener 1 to 3 and reason-for-call 2 to 4, but the scorecard did not mention it, and its new focus was unrelated to the first call's focus. The coach never sees earlier calls.

## 2. Decisions the user made (do not re-ask)
| Topic | Decision |
|---|---|
| Information | Keep **all** of it. Presentation changes only. (Earlier idea of trimming what the coach writes is dropped.) |
| Memory scope | **Both**: per person (compare with the last call with the same prospect) **and** across everyone (overall trend and habits). Shown separately. |
| Live guidance | **No live nudges / hand-holding.** A cheat sheet instead. |
| Cheat sheet | **Generated for the project's offer, then editable.** |
| Cheat sheet during the call | **Side panel next to the call, with a hide switch.** (Remember the choice; default shown.) |
| Building | Nothing is built until the user says so. |
| Compaction | Recommended after this file is saved. The user compacts with `/compact`. |

## 3. Part A: Scorecard layout (no information removed)
Principle: a short summary first; everything else one click away.

```
DEBRIEF (always visible)
  headline | rating | got the ask? | outcome | duration
  FOCUS for next call (one line)        [Call again]
  vs last call: opener 1->3 up  reason 2->4 up  pace down
  audio player
v What worked (5)          one-line summary
v Fix these first (3)      one-line summary
v Call timeline (all items) filter chips: Wins | Misses | Objections | Signals | Voice | Feelings
v Skills scoreboard        weakest / best in the summary line
v Your voice               pace, clarity, energy in the summary line
v Who you really talked to
v Full transcript
[Expand all]
```

Rules:
1. **One timeline replaces five sections.** Key moments, objections, missed signals, voice issues and the prospect's feelings all have `timeSecs`. Merge into one chronological list with filter chips. Each row is one line (time, tag, quote); clicking expands what / why / better line (or objection / how handled / better response, or meaning / what to do). Keep the play button on every row.
2. **Every collapsed section header shows a one-line summary** computed from existing data (no new AI call where avoidable), for example "weakest: opener 1/10, best: discovery 5/10".
3. **Long text is structured, not shortened.** Show existing fields as labelled blocks; put the 200-word conversion reasoning behind "Why this chance?"; bold each paragraph's first sentence.
4. **Additions to what the coach writes (nothing removed):** a `oneLine` summary and a `tag` (habit, see section 5) on every moment / fix / objection / missed signal. Old reports without these fields fall back to the first sentence and show no tag.
5. The decision about the percentage: the page keeps "chance of reaching the goal" but labels it an estimate; add a plain "Got the ask? Yes / Partly / No" next to it. (Open item 1 below.)
6. Constraints: mobile-friendly; follow the Next.js 16 Cache Components rules in `PROJECT_CONTEXT.md` (no `export const dynamic`; request-time data after `await connection()` inside `<Suspense>`).
7. Use the `impeccable`, `emil-design-eng` and `dataviz` skills for the visual pass if helpful. Ask the user before installing any skill.

## 4. Part B: Memory between calls
No new data capture is needed: every stored report already holds scores, focus, fixes and voice metrics.

Three layers:
1. **Free comparison (no AI).**
   - Per person: chips next to each score vs the last call with the same persona (`personaKey` in `lib/people.ts`). Shown only if a previous scored call exists.
   - Across everyone: a progress section with trend lines for rating, stage scores, pace, clarity, fillers, trailing off, monotone score, talk share, plus habit counts.
   - Flag when difficulty or project differs between the compared calls.
   - Show an arrow only for a real change. The threshold must be set after the score-variance test (section 7).
2. **A coach that remembers.** Give the **verdict call only** a *history brief* built by code, capped at about 1,200 tokens: the last 5 scored calls (date, person, rating, stage scores, focus, fix titles) plus, for the same person, the previous focus, fixes and 2 key quotes. New output fields: `lastFocusCheck` (focus text, verdict done / partly / not, evidence quote and time, comment). Verify any quote with the existing `quoteAppears` check against the correct transcript.
3. **Habits you can count.** The coach tags every miss from a fixed list (draft below). Counting tags in code gives exact statements like "no ask in 4 of your last 6 calls". Send the coach only the top 3 counts.

Never send old full reports to the model (about 5,000 tokens each).

Cost note: the history brief adds about 1,300 input tokens to one call, roughly $0.005 (estimate).

### Draft habit tags (finalise in Phase 3, about 25-28)
wrong_name, no_reason_for_call, rushed_opener, bad_time_opener, apologetic_language, vague_offer, jargon, pitch_too_long, discounting_too_early, closed_questions, missed_buying_signal, talked_over_prospect, no_silence_after_question, argued_with_objection, accepted_brush_off, no_ask, vague_ask_no_day_time, weak_contact_details, unclear_goal, monologue, trailing_off, rising_end_unsure, fillers, pace_too_fast, flat_voice, confusing_phrases, no_proof, dodged_where_from, lost_control_after_derail.

## 5. Part C: Cheat sheet
Goal: a reference to read **before** the call and glance at **during** it. Not live prompts: static, no latency, no cost per call.

Before the call (full page):
- Opener skeleton: name, company, reason for the call, pause.
- Open-question bank.
- Objection table: "not interested", "send me info", "already have someone", "price", "who are you / where from".
- The ask: a specific day and time pattern.
- Answer to "where are you calling from?" and swaps for phrases that confuse Western listeners ("revert", "do the needful", "kindly").
- **Offer-specific part generated once per project** from the project's offer, price, ideal customer and goal (Opus, about $0.10-0.20, estimate), stored in the database, **editable**. Use keywords and short phrases, not scripts (the coach's own rubric penalises sounding scripted). Regenerate only on request.
- **Personal block** from memory: last call's focus and the top 3 recurring habits.
- Printable (print stylesheet) so it also works on real calls.

During the call: a **side panel next to the call screen** with a hide switch (remember the choice). It shows about 6 large lines (prospect name, the 4-step opener, the focus, the ask) and a drawer for the full sheet. The scorecard records whether the sheet was shown, so calls can be compared fairly.

Rules:
- It must **never show the hidden persona** (that spoils the exercise). Only the user's pasted profile, the project, and general regional norms.
- **Save to my cheat sheet:** a button on every "better line" / "better response" in a scorecard adds it to the project's editable cheat sheet.
- Optional later: a pre-call per-prospect section generated from the pasted profile only.

## 6. Cost analysis (estimates, not measured)
Opus 5.5 prices: $4 per million input, $20 per million output.
- Scorecard today: input about 12,000 tokens across two parallel calls (about $0.05); output plus thinking about 12,000-17,000 tokens (about $0.25-0.35). So input is roughly 10-15% of the cost.
- Memory adds about $0.005. Tags and one-line summaries add about 750 output tokens (about $0.015).
- Per full call overall: ElevenLabs about $0.30, prospect about $0.10, scorecard about $0.30-0.40.
- Prompt caching, cheaper models and batching were judged **not worth it now** (savings under half a cent). Revisit only if input grows. Do not change the coach model without the user's say.
- **First action: log real usage** (see Phase 0) so decisions use measured numbers.

## 7. Build order (my estimates of build effort)
| Phase | What | Estimate | Done when |
|---|---|---|---|
| 0 | Cost meter: table `llm_usage` (session, kind, model, input, output, cache_read, time); log every Claude call; show cost per call | about 30 min | A new call shows its real token counts and cost |
| 1 | Scorecard layout (accordions, merged timeline with filters, summaries) **plus** generation additions (`oneLine`, `tag`) | about 2 h | Old reports render with fallbacks; a re-scored call shows tags and summaries; nothing from the old page is missing |
| 2 | Free comparison chips and the progress section | about 1 h | Ahmed's second scorecard shows opener up 2 vs the first |
| 3 | Coach memory (history brief, `lastFocusCheck`) and habit counts; run the **variance test** (re-score one call twice, about $0.35) to set the arrow threshold | about 1.5 h | A redo scorecard states whether last time's focus was followed, with a verified quote |
| 4 | Cheat sheet: generation per project, editor, call-screen side panel with hide switch, print view, "used" flag | about 2 h | A new project gets a sheet; edits persist; panel hides and the choice persists |
| 5 | "Save to my cheat sheet" button on better lines | about 30 min | A saved line appears in the project's sheet |

Verification for every phase: `npx tsc --noEmit`, `npx eslint app components lib`, `npm test`, and a browser check of the real scorecards. Re-scoring existing calls costs about $0.35 each (estimate); ask the user before spending credits.

## 8. Risks
- **Score noise:** LLM scores can vary by about a point between runs; do the variance test before showing arrows.
- **Unequal comparisons:** prospects differ in difficulty and offer fit; flag mismatches and prefer same-person comparisons for chips.
- **Old reports lack new fields** (`oneLine`, `tag`): use fallbacks; backfill tags later (batch pricing is fine for that) or count only from new calls.
- **Cheat sheet sounding scripted:** keep it as keywords and short phrases; let the user edit freely.
- **Layout complexity on a phone:** test narrow widths.

## 9. Open items for the user
1. Keep the "chance of reaching the goal" percentage next to a new "Got the ask? Yes / Partly / No", or replace the percentage? (Default: keep both, label the percentage an estimate.)
2. Should the cheat sheet panel default to shown or hidden? (Default: shown.)
3. Re-score the 3 existing calls with the new layout in Phase 1 (about $1 in credit, estimate) so the redesign can be checked on real data?

## 10. Not in this plan (still available later)
Region-matched voices (the key has `voices_read`; `lib/voices.ts` still has a 4-voice fallback), ambient background sound (needs the ElevenLabs Sound Effects permission), edit/delete projects, drill mode, live AI hints (rejected for now), backups, `.gitignore` for `recordings/`. See `PROJECT_CONTEXT.md` section 6.
