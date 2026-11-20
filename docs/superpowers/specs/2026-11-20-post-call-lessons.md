# Plan: post-call lessons (teach first, report one tap away)

Step 0 after approval: copy this file to `cold-call-trainer/docs/superpowers/specs/2026-11-20-post-call-lessons.md` (folder does not exist yet; plan mode blocks writing it now).

## Context

The report at `/report/[id]` is accurate but has 15 sections at once, so the user does not learn from it. This adds a teaching layer: after each call the user lands on 3 short lessons (one per "Fix these first" item), each a 6-screen flow, with voice practice checked by Sonnet. The report stays unchanged and one tap away.

## What exploration found

1. **Report data.** `lib/scoring.ts` `generateReportFor` → `lib/report.ts` `analyzeCall` (two parallel Opus calls, `verdictSchema` + `evidenceSchema`, `messages.parse` + `zodOutputFormat`, effort `high`). It is saved as a `StoredReport` JSON in `sessions.report`. Useful fields: `analysis.topFixes[3]` (fix, why, howToPractice, oneLine, tag), `moments[]` (timeSecs, speaker, exact quote, kind, betterLine, tag), `personaReveal.feelings[]` (timeSecs, free-text feeling), `overallRating`, `conversionScore`, `outcome`, `headline`, `transcript: Turn[]` ({role, text, cues, t = start secs}), `meta.durationSecs`. The report is identified by `sessions.id`, so `reportId` = session id.
2. **Audio and timestamps.** `recordings/<id>.webm` holds only the user's mic. `GET /api/call/[id]/audio` streams it with Range, and `ReportView` seeks `currentTime = t - 1`. Turn times are ElevenLabs `time_in_call_secs` (the start of each turn). The full ElevenLabs call audio uses the same clock, so a clip runs from turn `t` to the next turn's `t`.
3. **Call again.** Server action `redoCall(sourceId)` in `lib/actions.ts` copies the persona into a new session and redirects to `/call/[newId]`. No Anthropic cost.
4. **Theme.** `<html class="dark">` is set by a script in `layout.tsx` and by `ThemeToggle.tsx` (localStorage `theme`). CSS vars are in `app/globals.css` with `@custom-variant dark` and `@theme inline`. Body font is Arial.
5. **Cheat sheet.** `lib/sheetModel.ts` is pure (sections incl. `notes` = "My own lines"). `CheatPanel` gets `PanelData {presetId, sections, generated, personal}` from `app/call/[id]/page.tsx` and shows Focus, script steps and objections.
6. **Flow today.** `CallScreen.finish()` saves voice, audio and `/end`, then the self-review, then `router.push('/report/[id]')`. `GenerateReport` (reusable) runs scoring and then calls `router.refresh()`.

### Rajesh data check (read-only DB query, free)
- The renewal answers are at **125s (2:05), 74 words** and **168s (2:48), 81 words**. The report text says "71" (the coach's count). The code will show 74, the computed number.
- The 2:34 quote is inside the 154s turn, and the 3:19 question is inside the 199s turn. The quotes are parts of longer turns, so the ▶ button plays the whole prospect turn (each is about 10 s).
- In the report, fix 1's tagged moments are 125s and **214s** (the updates answer), not 168s. Opus will pick the "Find it" turns from the real turn list, so 125 and 168 should come out. If not, the test shows it.
- The call recording exists. The full call audio is not downloaded yet; a one-time free backfill will fetch it.

## Approach

**Code builds:** the turn lanes, word counts, the "yours" option (fillers and stutters removed), the model option (the coach's `betterLine`), the prospect's real reaction (the next prospect turn), the before/after pair, clip times, wpm, review dates and the gut-check options.
**One Opus call per report (effort `medium`) writes only:** the title, rule, the gut-check reconcile line(s) (see below), the distractor reply, the Find-it turn ids, hint and explanation (told not to state numbers; code shows the word counts beside them), the Choose quote (a turn id plus an exact substring, verified with the `lib/reportVerify.ts` approach), the practice question (a real prospect turn id plus a substring), 3 checks, the model line, the cue-card label, and a 0–4 guarded→open level per feeling (your choice). Any invalid turn id or unverified quote is rejected and that field falls back to code data.
**Sonnet (`claude-sonnet-5-5`, effort `low`) evaluates practice** with your system prompt. Code computes wpm. Zod validates the output.
Both follow the project's existing choice of no `fallbacks` parameter: a refusal shows a retry.

**Gut check: no second "how did it go?" (proposal: reuse the self-review).** Keep the self-review step after the call, because the report's "your review vs reality" section needs it. Then on lesson 1, screen 1:
- If you wrote a self-review, the screen shows "You said:" with your words in quote style, then the Opus reconcile line (for example "You felt it went badly. The coach gave it 4/10, but you got the WhatsApp ask. Both are true."). One button: "Let's find out why".
- Only if the self-review was skipped or empty does it ask the 3-option question ("Went well / Mixed / Went badly"). In that case Opus writes one reconcile line per option.
Removing the self-review instead would empty a report section, so I don't recommend it.

**"Up from last call".** This uses the last scored call in the **same project**: sessions with a `report`, the same `preset_id`, not this session, and a report `createdAt` earlier than this report's `createdAt`, taking the newest one. Comparing by report `createdAt` matches how the report page compares, since a session can be created days before its call. This is a new helper `findPreviousInProject` in `lib/compare.ts`; the existing `findPrevious` matches the same person, not the same project. It shows "Rating 4/10, up 1.5 from last call" or "down …" or "same as". The first call in a project shows plain values with no comparison.

**Skip.** Every lesson screen gets a secondary "Skip" text button that goes to the next screen; skipped screens are recorded in `lessons.data.skipped`. On the practice screen, Skip saves no attempt. The lessons home gives each lesson a "Skip lesson" text button. That sets status `skipped`, which counts as finished for "Start lesson N" ordering, schedules no review, and can be undone with "Start anyway".

## Data model (raw SQL in `lib/db.ts` + Drizzle in `db/schema.ts`)

- `lessons`: id, session_id, ord (1..3), title, rule, data (JSON: gutCheck, findIt, choose, ruleScreen, practice, cueCard, feelingLevels), status (`not_started|in_progress|done|skipped`), screen (last screen index), gut_pick, best_score, review_step (0,1,2), next_review_at, created_at, updated_at.
- `practice_attempts`: id, lesson_id, attempt_number, mode (`voice|typed`), is_review, transcript, audio_path, duration_sec, speaking_sec, wpm, result (JSON: verdict, checks, tip, comparedToLast), score, error, created_at.
- `sessions` + column `cue_card TEXT` (JSON `{label, line, lessonId}`), added with the existing `ALTER TABLE` try/catch.
- Files: `recordings/<sessionId>.call.mp3` (full call), `recordings/practice/<attemptId>.webm`.
- Costs go into `llm_usage`: kind `lessons_generate`, plus `practice_eval:<lessonId>` (the same pattern as `cheatsheet:<presetId>`).

**Review rule:** best score under 7 → review in 1 day (step resets to 0). 7 or more → step 0 gives +3 days, step 1 gives +7 days, after step 2 the lesson is done with no more reviews. Each review attempt updates the score.

## Files

**Add (lib)**
- `lib/lessons/model.ts`: pure code, safe for the client. Types; `turnLanes(turns, duration)`; `wordCount`; `cleanReply` (fillers and stutters); `nextProspectTurn`; `wpm(words, speakingSec)`; `nextReview(best, step, now)`; `shuffle(seed)`.
- `lib/lessons/model.test.ts`: tests for lanes, word counts (Rajesh 125s = 74), cleanup, wpm, review dates.
- `lib/lessons/generate.ts`: builds the code parts, makes the one Opus call, verifies, saves. Uses an `inFlight` map like `scoring.ts`.
- `lib/lessons/evaluate.ts`: the Sonnet call, Zod schema, comparison with the last attempt.
- `lib/lessons/store.ts`: database reads and writes, plus `dueReviews()`.
- `lib/callAudio.ts`: `saveCallAudio(sessionId, conversationId)` fetches `GET /v1/convai/conversations/{id}/audio` (free) and writes the mp3. It retries 3 times over about 30 s, because the audio may not be ready right after the call.
- `lib/deepgram.ts`: add `transcribeAnswer(buf)` (nova-3, `punctuate=true&smart_format=true`, returns text plus the first-to-last word span). The existing function stays as it is.
- `lib/usage.ts`: add `claude-sonnet-5-5`. **Prices are not from memory.** The claude-api skill's model table (cached 2026-11-03) gives Opus 5.5 at $4 in / $20 out / $0.20 cache read, and Sonnet 5.5 at $2 / $10 / $0.10 cache read. Before editing, I fetch Anthropic's official pricing page (free, no API credit) to confirm these numbers and the cache-write prices, which the skill does not list. I will tell you the URL and the numbers I used. If the page confirms $0.20, Opus cache read changes from 0.4 to 0.20. The app uses no prompt caching today, so real logged costs do not change.

**Add (routes)**
- `POST /api/lessons/generate` {reportId}: returns cached lessons if they exist and never regenerates.
- `PATCH /api/lessons/[id]`: status, screen, gut pick.
- `POST /api/practice/transcribe`: audio blob → {transcript, durationSec, speakingSec, audioPath}.
- `POST /api/practice/evaluate` {lessonId, transcript, durationSec, attemptNumber, previousTranscript?, mode, isReview}: always saves the attempt, even when the AI fails.
- `GET /api/call/[id]/call-audio`: streams the mp3 with Range (copy of the existing audio route). If the file is missing it tries `saveCallAudio` once.
- `lib/actions.ts`: add `redoWithCue(sessionId, lessonId)`, which runs `redoCall` and also sets `cue_card` on the new session.

**Add (UI)**
- `app/lessons/[id]/page.tsx`: lessons home. No report yet → `GenerateReport`. No lessons yet → a client step that calls generate. Top bar has × Home and "See full report".
- `app/lessons/[id]/[n]/page.tsx`: the lesson flow. `app/review/[lessonId]/page.tsx`: screen 5 on its own.
- `components/lessons/`: `LessonFlow` (progress dots, ×, buttons, swipe through pointer events, ← → keys, CSS slide and fade at 300 ms, reduced-motion respected), `GutCheck`, `FindIt` + `CallShape` (SVG with two lanes, real `<button>` bars, stepped feelings line), `Choose`, `RuleScreen`, `Practice` + `Recorder` (MediaRecorder, live level meter, timer, typing fallback that switches on automatically when the mic is denied) + `Feedback` (aria-live, checks animate in), `CueCard`, `ClipButton` (one shared `<audio>` that plays from t to the end of the turn), `Quote` (serif italic).
- `app/globals.css`: Apple tokens as CSS vars (`--ios-bg`, `--ios-surface`, `--ios-elevated`, `--ios-label`, `--ios-label-2`, `--ios-sep`, `--ios-blue`, `--ios-orange`, `--ios-green`) under `:root` and `:root.dark`, exposed through `@theme inline`. The system font stack and serif quote font apply only inside a `.lessons` wrapper, so other pages do not change.
- `npm install lucide-react` (you approved it).

**Change**
- `components/CallScreen.tsx`: after the self-review, go to `/lessons/[id]` instead of `/report/[id]`.
- `app/api/call/[id]/end/route.ts`: after saving, `after(() => saveCallAudio(id, conversationId))` from `next/server`. This was checked in the bundled docs (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md`): `after` is stable, works in Route Handlers, runs once the response is sent, and is supported on a Node.js server (how `npm run dev` runs). It does not make the route dynamic. If the download still fails, `/call-audio` retries when the lessons open.
- `app/call/[id]/page.tsx` + `CheatPanel.tsx`: if the session has `cue_card`, show it pinned at the top of the panel ("From your lesson"). Later it can feed into the sheet's `notes`.
- `app/page.tsx`: a "1 line to review" row (or "N lines") when `dueReviews()` finds lessons due, linking to `/review/[lessonId]`.
- The report page and `ReportView` are **not touched**.

## Cost estimate (prices: Opus $4/$20, Sonnet $2/$10 per M tokens)

| Item | Tokens (in / out) | Cost |
|---|---|---|
| Lesson generation, once per call (all 3 lessons), Opus **medium** | ~6k / ~4–6k (incl. thinking) | **~$0.10–0.14** (about $0.04 per lesson) |
| One practice check (Sonnet, low) | ~1.5k / ~500 | **~$0.008 per attempt** |
| Deepgram per answer (~15 s) | — | ~$0.001 (free credit) |
| ElevenLabs call-audio download | — | free |
| **Per call: lessons + 9 attempts (3 per lesson)** | | **~$0.17–0.21** (6 attempts: ~$0.15–0.19) |

**Medium effort puts this above your $0.07–0.12 target**, mostly because of thinking tokens. After the first real run I will show the logged number. If it is too high, the options are: low effort, a smaller context, or fewer attempts. You choose.

**Testing spend (approved cap $1):** generation ~$0.12 + up to 2 reruns ~$0.25. Sonnet vs Opus side-by-side on 3 answers: ~$0.09. End-to-end practice, 9 attempts: ~$0.07. **Total ~$0.55.** Nothing runs before you approve.

## Verification

1. `npm test`, `npx tsc --noEmit`, `npx eslint app components lib` (all free).
2. Backfill the Rajesh call audio (free), then generate the lessons (~$0.05). Check lesson 1: title, rule, Find-it at 125/168, Choose quote at 154s, practice question at 199s, 3 checks, model line.
3. `scripts/compare-eval.mts` runs your 3 test answers (including the "100 AED retainer" one) through Sonnet and Opus and prints them side by side for you.
4. Chrome DevTools at 390×844 and 1440×900, light and dark: all 3 lessons end to end, typed and voice practice, console clean, keys and swipe working, a review scheduled in the DB.
5. Compare the `llm_usage` rows with the estimate above and report the real cost per lesson and per attempt.

## Assumptions

- Gut-check fallback options (used only with no self-review) are fixed by code: "Went well", "Mixed", "Went badly".
- The `yours` option is the real reply cleaned by code (fillers and repeated words removed, cut at about 45 words with "…").
- wpm uses Deepgram's first-to-last word span and falls back to the recording length. Typed answers show no wpm.
- Practice audio is kept in `recordings/practice/` (already git-ignored through `/recordings/`).
- Old calls without saved call audio try the download when opened. If ElevenLabs has deleted it, ▶ is hidden; there is no TTS fallback unless you approve the cost.
