# Build: post-call lessons (teach first, report one tap away)

## Read this first: ground rules for this session

- **Plan only first.** Explore the code and write the plan. Write no code, run no migrations and make no paid API calls (Anthropic, ElevenLabs, Deepgram, Gemini) until I approve the plan.
- Read `CLAUDE.md` and `PROJECT_CONTEXT.md` first. This is Next.js 16 with Cache Components on; read `node_modules/next/dist/docs/` before writing Next code. Never print or log API keys.
- Tell me the cost before anything spends credit. Testing on my Rajesh report is approved up to about $1 in total, but only after I approve the plan.
- Save the plan to `docs/superpowers/specs/` so it can be reviewed in another session.

## Decisions already made (don't re-ask)

- **Transcription:** use Deepgram (already in the app, `lib/deepgram.ts`). Do not add ElevenLabs Scribe.
- **Prospect audio:** the app records only my microphone. ElevenLabs keeps the full call audio with both voices, downloadable for free via `GET /v1/convai/conversations/{conversation_id}/audio` (checked: returns audio/mpeg). Save a local copy in `recordings/` right after each call, because ElevenLabs keeps it only for a limited time. Use it for every "hear what the prospect said" button. Only fall back to generating the voice with ElevenLabs TTS if the clip is missing, and tell me the cost first.
- **Models:** Opus (`claude-opus-5-5`) for writing lessons. Sonnet (`claude-sonnet-5-5`) for practice checks. Log every AI call's cost with the existing `lib/usage.ts` (add Sonnet's prices there).
- **Code does most of each lesson.** Build the "Find it", "The rule" and before/after screens from existing report and transcript data with code (turns, timestamps, word counts, fixes, better lines, feelings). Only ask the AI for what doesn't exist yet: the gut-check reconcile line, the wrong-answer option, the 3 practice checks, the practice question and the rule wording.
- **Generate lessons when I first open them,** not automatically after every call. Cache them; never regenerate on a revisit.
- **Cost target:** about $0.07 to $0.12 extra per call in total (lessons plus 2 to 3 practice attempts per lesson). Show the real cost per lesson and per attempt in the plan's estimate.
- **Storage:** the app uses local SQLite (`lib/db.ts`, tables created by raw SQL, `db/schema.ts` for Drizzle). Use the same approach.

## Context

This repo is my cold-calling trainer, a Next.js / React app. I do roleplay cold calls against AI prospect personas (voice via ElevenLabs). After each call, an AI coach produces a long report at `/report/[id]`. It includes the headline, rating, "Got the ask?", conversion chance, focus for next call, last focus check, an audio player of my side of the call with ▶ timestamps, "What worked", "Fix these first (3)" with why and practice text, a call timeline (wins, misses, objections, signals, voice, feelings), skills scoreboard, voice metrics, my own review vs. reality, "Who you were really talking to" with the hidden truth, and the full transcript. There is also a "Call [prospect] again" button that starts a new roleplay with the same persona, and a Day/Night toggle.

The report is accurate but overwhelming. It's 15 sections at once and I don't learn from it. I want a teaching layer on top of it, like a real human coach going through the call with me step by step.

**Before writing the plan:** explore the codebase and find:
1. How the report data is generated and stored (the coach prompt, its output shape, DB tables).
2. How the per-moment audio clips and timestamps work.
3. How "Call [prospect] again" starts a roleplay.
4. How the Day/Night theme is implemented.
5. How the cheat sheet works (`lib/sheetModel.ts`, `components/CheatPanel.tsx`), because the cue card in screen 6 should feed into it later.

Then write a short plan: files to add or change, data model changes, API routes, cost estimate, and open questions. **Wait for my OK.** Do not break or remove the existing report page.

## What to build

After a call ends, I land on **Lessons**, not the report. The report stays exactly as it is, one tap away ("See full report" in the top bar of the lessons screen, and on the final screen).

- **One lesson per "Fix these first" item**, so usually 3 lessons, done in order. Each takes about 3 minutes.
- A **lessons home** screen for this call: the headline in one sentence, rating and conversion chance shown as "up from last call" (not giant numbers), then the 3 lessons as a list with status (not started, in progress, done). The primary button is "Start lesson 1".
- Each lesson is a **full-screen, focused flow**: one idea per screen, one primary button per screen, progress dots at the top, and a close (×) back to the lessons home. Back and next work by button, swipe on touch, and ← → keys on desktop.

### The 6 screens of a lesson

Use real data from the report. Never invent facts about the call.

1. **Gut check** (lesson 1 only). "Before I show you anything: how do you think the [prospect] call went?" Three options. Whatever I pick, the reply reconciles it with the real result. Example: "The coach gave it 4/10, but you hit the goal. Both are true. Let's find out why."

2. **Find it.** Show "the shape of the call": two horizontal lanes (You / Prospect), one bar per talking turn, positioned and sized by transcript timestamps. Under them, a stepped line of the prospect's feelings over time (from the persona reveal's feelings: guarded at the bottom, open at the top). Ask me to tap the turn I think caused this lesson's problem.
   - Wrong tap: a gentle hint ("Look for the longest bars on your line").
   - Right tap: highlight the relevant turns and explain in 1–2 sentences (for example, "Those two bars are your renewal answers: 71 and 81 words. His guard went straight back up.").
   - A ▶ button plays the real call audio for that moment.

3. **Choose.** Show what the prospect said (quoted exactly, with ▶ to hear it from the saved call audio) and three possible replies: a cleaned-up version of what I actually said, the coach's better line, and one plausible but wrong reply. Shuffle the order. A wrong pick gives a hint and lets me try again. The right pick explains why in 1–2 sentences and quotes the prospect's real reaction.

4. **The rule.** One short, memorable rule in large type (for example, "One question. One sentence. One number. Then stop talking."). Below it, a before/after pair: "You said · 71 words" vs "Say instead · 18 words", with word counts computed, not hardcoded.

5. **Your turn: AI coaching practice.** This is the most important screen.
   - Play the prospect's question. If the prospect really said it in the call, play that clip from the saved call audio. Show the text too.
   - A big mic button records my spoken answer with MediaRecorder. Show a live level meter and timer, and tap to stop. Also offer "Type instead" as a fallback, and use it automatically if mic permission is denied.
   - Transcribe with Deepgram.
   - Send to `POST /api/practice/evaluate` (below). Show the feedback as:
     - a one-line verdict
     - 3 checks with pass/fail and a short reason, specific to this lesson's rule (for example "One sentence", "Has an exact number", "No surprise costs or contract words")
     - my words per minute (from audio duration and word count) against a 140–160 target
     - one coach tip
     - a "Model line" reveal
   - "Try again" up to 3 attempts per session, with feedback comparing each attempt to the last ("Shorter than last time, and now it has the number"). Then "Continue".
   - Save every attempt: transcript, audio path if stored, checks, score 0–10, wpm, timestamp.

6. **Take it with you.** A cue card with the model line (or my best attempt if it scored at least 8). Two buttons: "Try it on [prospect] again", which starts the existing roleplay with the same persona and the cue card visible on the cheat sheet panel, and "Next lesson". After the last lesson: "See full report".

### Spaced review

Track each lesson's best practice score. If it's under 7, queue the practice screen (screen 5 alone) as a review the next day. If it's 7 or above, review in 3 days, then 7. On app home, show "1 line to review" when something is due. Keep this simple: a `next_review_at` per lesson is fine.

## Data and API

**Lesson generation.** `POST /api/lessons/generate { reportId }` produces the lessons for a report and stores them. It runs the first time I open the lessons for a call. Code builds everything it can from the report and transcript; Opus with structured output (Zod-validated, via `messages.parse` + `zodOutputFormat` like the rest of the app) writes only the missing parts. Generate once and cache. Suggested shape (adapt to the codebase):

```ts
type Lesson = {
  id: string; reportId: string; order: number;            // 1..3, from "Fix these first"
  title: string;                                           // "Answer money questions in one sentence"
  rule: string;                                            // the big one-line rule
  gutCheck?: { question: string; options: string[]; reconcile: string }; // lesson 1 only
  findIt: { prompt: string; correctTurnIds: string[]; hint: string; explanation: string; audioTimestamp?: number };
  choose: { prospectQuote: string; prospectTimestamp?: number;
            options: { text: string; kind: "yours" | "model" | "distractor" }[];
            rightExplanation: string; wrongHint: string };
  ruleScreen: { before: { text: string; timestamp?: number }; after: string };
  practice: { prospectQuestion: string; prospectTimestamp?: number; context: string;
              checks: { id: string; label: string; criterion: string }[]; // exactly 3
              modelLine: string };
  cueCard: { label: string; line: string };
  status: "not_started" | "in_progress" | "done"; bestScore?: number; nextReviewAt?: string;
};
```

Turn lanes and feelings come from the existing transcript and report data. Compute them, don't ask the AI.

**Practice evaluation.** `POST /api/practice/evaluate { lessonId, transcript, durationSec, attemptNumber, previousTranscript? }` returns `{ verdict, checks: [{id, pass, reason}], score, wpm, tip, comparedToLast? }`. Uses Sonnet. Compute wpm in code, not with the AI. Coach system prompt:

> You are a warm, direct cold-calling coach. The rep just answered a prospect's question out loud. Judge only against this lesson's rule and its 3 checks. Use the prospect's real situation and fears from the context. Be specific: quote the rep's words. Keep the verdict to one sentence and the tip to one sentence. Never be harsh, never pad. If the rep introduced a new cost, commitment or jargon the prospect would fear, fail the relevant check and say why in the prospect's terms. Score 0–10.

Validate the output with Zod. On AI failure, show "Couldn't check that one. Try again." and keep the attempt.

Persist lessons, attempts and review dates in SQLite like the reports.

## Teaching principles (follow these in every screen)

- Ask before telling. Let me guess or find it before you explain.
- One idea per screen. Never more than about 40 words of body text on a lesson screen.
- Feedback within a second for taps. AI feedback shows a calm "Listening…" / "Checking…" state.
- Kind, specific feedback. Wrong answers get a hint, not a red wall.
- Always end with something I take into my next call.
- Quotes from the call appear in a distinct italic style, so "what was said" is always visually different from "what the coach says".

## Design: Apple-inspired

Take inspiration from Apple's Human Interface Guidelines (clarity, deference, depth). It should feel like a native Apple app, but don't copy Apple logos, icons or any specific Apple screen. The `impeccable` skill is installed and fits this work.

- **Type:** the system font stack (`-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif`). Large-title style headings (about 34px bold, tight tracking) and 17px body text. Quotes from the call in a serif italic (for example `"New York", ui-serif, Georgia, serif`). Tabular numbers. `text-wrap: balance` on headings.
- **Color:** Apple-style system palette, following my existing Day/Night toggle:
  - Light: background `#F2F2F7`, grouped surface `#FFFFFF`, label `#000000`, secondary label `rgba(60,60,67,0.6)`, separator `rgba(60,60,67,0.29)`.
  - Dark: background `#000000`, grouped surface `#1C1C1E`, elevated `#2C2C2E`, label `#FFFFFF`, secondary `rgba(235,235,245,0.6)`.
  - Accent is system blue (`#007AFF` light / `#0A84FF` dark). Wins are blue and fixes are orange (`#FF9500` / `#FF9F0A`), always with a shape or icon as well as the color: a circle for wins, a diamond for fixes. Success is green (`#34C759` / `#30D158`).
  - No gradients, no glow, no heavy shadows.
  - Put all of this in CSS variables or Tailwind theme tokens, not hardcoded hex values in components.
- **Layout:** mobile-first, and it must work on desktop and phone. Lesson content is centred, max about 560px wide. Grouped, inset rounded sections (12–16px radius) like iOS Settings. Generous whitespace. One primary filled button per screen (pill-shaped, full-width on phone); secondary actions are plain text buttons.
- **Motion:** soft spring transitions between lesson screens (slide plus fade, about 300ms). The mic button pulses gently while recording. Small check animation when a practice check passes. Animate only transform and opacity, never `transition: all`. Respect `prefers-reduced-motion`.
- **Touch and accessibility:** 44px minimum targets, visible `:focus-visible` rings, real `<button>`s, `aria-live="polite"` for feedback, labels on icon-only buttons, and 4.5:1 text contrast in both themes. Safe-area insets on phones.
- **Icons:** a clean outline icon set already in the repo (or `lucide-react`; ask before installing). No emoji.

## Test case

Use my existing Rajesh Nair / Spotless Shield report as the first test (session `59081054-6957-4e16-ab2c-97d317431f17`, ElevenLabs conversation `conv_6301m7v4z7qmegca8jyvb0htj123`). Expected lesson 1:
- Title: "Answer money questions in one sentence"
- Rule: "One question. One sentence. One number. Then stop talking."
- Find it: my turns at 2:05 (71 words) and 2:48 (81 words)
- Choose: Rajesh at 2:34, "After one year, what exactly will I pay, in dirhams? I don't like surprises, I had one already."
- Practice question: Rajesh at 3:19, "Who will update it? I don't have time for computer work." (play his real clip)
  - Checks: under about 20 words; no new costs or contract/retainer words; tells him he has nothing to do.
  - Model line: "You won't have to do anything. Any change, just WhatsApp me."
  - If I answer "we can handle it for a monthly retainer of 100 AED…", the evaluator should fail the no-new-costs check and point out that 1,200 a year is more than the website itself.
- During testing, run the same 3 practice answers through both Sonnet and Opus and show me the feedback side by side, so I can confirm Sonnet is good enough.

## Done means

- After a call I land on the lessons home. The full report is one tap away and unchanged.
- All 3 lessons for the Rajesh report work end to end on a phone-sized and a desktop viewport, in light and dark mode.
- Voice practice records, transcribes, gets AI feedback, saves attempts, and falls back to typing.
- The full call audio is saved locally after each call and plays in the lessons.
- Reviews get scheduled.
- Unit tests for the code-built parts (turn lanes, word counts, wpm, review dates). Types pass, lint passes, no console errors.
- The real cost per lesson and per attempt is logged and matches the estimate.
- Give me a short summary of what you built, what you assumed, and anything you need from me.
