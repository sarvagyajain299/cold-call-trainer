# Cold Call Trainer — project context

Handoff document for a new Claude chat with no memory of the build. Written 2026-10-26 (build started 2026-10-25). Facts were checked against the code, the live ElevenLabs agent and a fresh test run on 2026-10-26. Anything not checked is marked **unverified**.

---

## 1. TL;DR

- **What:** a local laptop web app where one person practises cold calls by voice against AI "prospects". Each prospect is a different, emotionally realistic human. After the call the app produces a coaching scorecard.
- **For whom:** one user (an Indian professional newly in Dubai) preparing to cold call business owners in the US, UK, Australia, Europe and the Gulf. See section 2.
- **Status:** steps 1 to 4 of the plan are built and tested, plus extras (call history, People pages, "call same person again"). Step 5 is **not started**: the user chose to practise first and will come back with feedback.
- **Health (2026-10-26):** `npm test` passes 30 tests in 5 files. No git commits beyond the scaffold (everything is uncommitted, no remote).
- **First thing a new chat should do:** read sections 5, 6 and 7, then ask the user what felt off in practice before building anything. Do not start step 5 unless asked.

Paths:

| What | Where |
|---|---|
| App | `C:\Users\sarva\Cold calling Trainer\cold-call-trainer` |
| This file | `C:\Users\sarva\Cold calling Trainer\PROJECT_CONTEXT.md` |
| Original plan (outside the repo, partly outdated, see 5.3) | `C:\Users\sarva\.claude\plans\i-want-to-practice-crispy-parasol.md` |
| Claude memory for this project | `C:\Users\sarva\.claude\projects\C--Users-sarva-Cold-calling-Trainer\memory\` |
| Run it | `cd cold-call-trainer` then `npm run dev` (port 3000) |

---

## 2. The user and their goals

**Who:** an Indian professional who lived in India all their life and recently moved to Dubai. They need to start selling a service for their business (the business itself is irrelevant to the app; it is entered as a "project").

**The problem:** they have almost no cold-calling experience (one failed attempt). They often mumble, so people ask them to repeat themselves. They want to build confidence before calling real people.

**Who they will call:** business owners in the US, UK, Australia, Europe and the GCC (Gulf).

**What they asked for:**
- A system they can talk to that acts like a real human who is being cold called, with human emotions the system works out itself (the user deliberately did not list them).
- A different human each call: different place (home, office, gym, out with family, driving...), mood, personality. Situations must **not** be hard-coded; the examples the user gave were only examples.
- Input is a short prospect profile (business, location, role...).
- After the call: transcript, rating, a conversion score, how objections were handled, where they messed up, where they were right, what to improve, and feedback on **tone and energy** (monotone, joyful, flat...).
- Practice with 50 to 100 prospects on a laptop.
- The offer (what they sell) is saved once as a preset before a session or "project". The scorer uses it.

**Working-style preferences the user showed:**
- Wants concise, step by step answers; questions answered before big builds.
- Wants to be told costs (they asked how much credit to add and whether they had enough).
- Wants open-source options considered when researching (they asked after a plan that compared only paid APIs).
- Skill installs: always ask global vs project-local first; copy files, never symlink or junction (from `C:\Users\sarva\.claude\CLAUDE.md`). They chose project-local for the ElevenLabs skills.
- Wants to see it working and practise before more building. They test the real app by voice and report what they hear.
- Pronouns: use they/them.

---

## 3. Architecture and tech stack

### 3.1 Stack

| Part | Choice | Why |
|---|---|---|
| Voice call engine | **ElevenLabs Agents**, browser SDK `@elevenlabs/react`, connected by **signed-URL WebSocket** | Most voices and accents, natural turn-taking, can interrupt, has an `end_call` tool so the prospect can hang up |
| Prospect brain during the call | Claude Sonnet 5.5 (`claude-sonnet-5-5`) chosen inside the ElevenLabs agent, temperature 0.8 | Fast enough for live speech, stays in character |
| Persona generator and coach | **Claude Opus 5.5** (`claude-opus-5-5`) via `@anthropic-ai/sdk`, structured output with Zod (`messages.parse` + `zodOutputFormat`) | Strongest reasoning for inventing people and coaching |
| Speech clarity | **Deepgram nova-3**, plain `fetch` to `/v1/listen` | Per-word confidence shows which words were hard to understand; also pace, fillers, pauses |
| Tone and energy (listening) | **Gemini** audio understanding via `@google/genai`; tries `gemini-3.6-flash`, falls back to `gemini-2.5-flash` | Claude cannot hear audio; Gemini can judge warmth, confidence, energy |
| Tone and energy (measured) | `pitchy` + Web Audio in the browser, sampled 10 times a second | Free, objective pitch and loudness numbers |
| App | **Next.js 16.4.3** (App Router, TypeScript, Tailwind 4), React 19.3 | One codebase for UI and server routes, keys stay server side |
| Storage | **SQLite** via `better-sqlite3` + `drizzle-orm`; tables created by raw SQL in `lib/db.ts` | Free, local, no setup |
| Tests | **vitest** (`vitest.config.mts`, includes `lib/**/*.test.ts`) | Pure logic is unit tested |

The app has **no login**. It is meant to run only on the user's laptop. Do not deploy it publicly as is (any visitor could trigger paid API calls).

### 3.2 One call, start to scorecard (data flow)

1. Home page, **Start a call** on a project, goes to `/session/new?preset=ID`. The form (`SessionForm`) calls the server action `createSession`, which inserts a `sessions` row (status `setup`) and redirects to `/call/[id]`.
2. The call page (`CallScreen`, client component) immediately calls `POST /api/call/prepare`. That runs `generatePersona` (Opus 5.5, effort `low`, about 23 seconds), stores the persona JSON on the session, and returns `{ ready: true }`. The persona is **never** sent to the browser. A module-level `inFlight` map stops duplicate generation.
3. The **Call** button stays disabled until prepare finishes. On click: the browser asks for the mic, then calls `POST /api/call/start`.
4. `start` requires a saved persona, fetches an ElevenLabs signed URL, and atomically flips the session `setup` to `live` (a second call returns 409). It returns `{ signedUrl, dynamicVariables: { pickup_line }, overrides: { agent: { prompt, language }, tts: { voiceId } } }`.
5. The browser calls the SDK `startSession({ signedUrl, connectionType: "websocket", dynamicVariables, overrides })`. On connect it starts a `MediaRecorder` (webm/opus) of the user's mic and the voice sampler (`[seconds, rmsDb, pitchHz, clarity]` every 100 ms).
6. The call ends when the user hangs up, the prospect uses `end_call`, or the line drops. `finish()` runs once: stops recording, posts voice samples (`/api/call/[id]/voice`), the audio (`/audio`), and the ElevenLabs conversation id (`/end`, status becomes `scoring`).
7. The call screen shows a **self-review** box ("what went well, what would you redo?"), saved by `POST /api/call/[id]/review`, then goes to `/report/[id]`.
8. The report page calls `POST /api/report/[id]` if no report exists. `generateReportFor` (`lib/scoring.ts`):
   - fetches the transcript from the ElevenLabs conversation API (voice tags like `[sighs]` are stripped into "cues");
   - reads the saved recording and voice samples from `recordings/`;
   - runs Deepgram and Gemini in parallel (a failure in either only removes that section);
   - computes speech metrics, voice metrics and per-turn pace;
   - runs **two parallel Opus calls** (verdict and evidence), clamps scores, drops any quote not found in the transcript;
   - saves the whole `StoredReport` as JSON in `sessions.report`, status `done`.
9. `router.refresh()` shows `ReportView`. **Call again** (`redoCall`) copies the persona into a new session for another try with the same person.

---

## 4. How it behaves

### 4.1 Persona engine (`lib/persona.ts`)

- Code rolls random **dials** (numbers only, no scenarios): openness 0-10, patience 0-10, mood -5 to +5, attention (`full`/`split`/`minimal`), offer fit (`strong`/`partial`/`none`). Difficulty (`easy`/`realistic`/`brutal`) shifts them:

| Difficulty | Openness | Patience | Offer fit strong/partial/none |
|---|---|---|---|
| easy | 5-9 | 6-10 | 55 / 35 / 10 % |
| realistic | 2-7 | 3-8 | 30 / 40 / 30 % |
| brutal | 0-4 | 1-5 | 15 / 35 / 50 % |

- **Claude invents everything else**: name, role, business, city and country, accent, where they are and what they were doing, who is around, how many minutes they have, mood and its cause, personality, history with cold callers, reaction to unfamiliar accents, the business reality and honest fit with the offer, 2 to 4 objections with real reasons, what warms or cools them, what makes them hang up, and the best realistic outcome.
- **Variety guard:** the last 8 personas are passed to the generator so it avoids repeating people.
- **Hidden until the report.** The user does not see who they called until the scorecard. `start` never returns the persona.
- **Stable voice per person** (`lib/voices.ts`): an FNV-1a hash of `name|city` picks one of two voices for the person's gender. Currently only 4 voices exist (male George and Daniel, female Sarah and Charlotte) and **region is ignored**, so a Gulf and a UK prospect sound the same. This is the main thing step 5 should fix.

### 4.2 The live-call prompt (`buildAgentPrompt`)

Sent as a per-call override. Sections: Personality, Environment, Emotional state (with warm-up, cool-down and hang-up triggers), Business privately (reveal only if the caller earns it), Objections, How you react to the caller, Tone and delivery, Goal. Key rules in it: never reveal being an AI; short phone-style turns; if the caller is garbled say "Sorry, what was that?" and lose patience if it repeats; hang up with `end_call` when the hang-up triggers fire; do not coach the caller.

### 4.3 The ElevenLabs agent (read live via the API on 2026-10-26)

- Agent id `agent_9101m5qxjatces6rssv9hymdjpv8`. It lives in `.env.local` as `ELEVENLABS_AGENT_ID` (not a secret by itself, but the key is).
- Name "Cold Call Prospect"; LLM `claude-sonnet-5-5`; temperature 0.8; TTS model `eleven_v4_turbo`; turn eagerness `normal`; max call length 900 seconds; auth enabled (signed URL required).
- **First message is `{{pickup_line}}`** with placeholder "Hello?". Each call fills `pickup_line` from the persona. See gotcha 7.1.
- Built-in tool `end_call` enabled.
- Overrides enabled for prompt, language and voice id (the dashboard also flags `first_message` as allowed, but the platform rejects it at runtime).
- If the agent ever has to be recreated: `POST /v1/convai/agents/create`; `built_in_tools.end_call` needs `name`, `description` and `params: { system_tool_type: "end_call" }` or the API returns a 422.

### 4.4 The coaching rubric (`lib/rubric.ts`)

Based on Gong cold-call research (reason-for-call about 2x better; "did I catch you at a bad time" about 40% worse), the 30 Minutes to President's Club / *Cold Calling Sucks* approach, and tactical empathy. Nine areas: (1) first 10 seconds, including getting the prospect's name right; (2) status and mindset; (3) problem-first message; (4) listening and discovery, including missed buying signals; (5) objection handling; (6) close and next step; (7) voice delivery (pace 140-160 wpm, trailing off, rising inflection, fillers); (8) cross-cultural fit by region and Indian-English phrases that confuse listeners; (9) call control. A calibration guide says 5/10 is a competent professional, most beginners are 2 to 4, and the conversion score is the chance of reaching the call's goal given this prospect's hidden fit.

### 4.5 The scorecard (`lib/report.ts`, `components/ReportView.tsx`)

Two Opus calls run in parallel (one huge schema is rejected by the API):
- **Verdict:** headline, overall rating 0-10, conversion score 0-100 with reasoning, outcome, wins, exactly three top fixes (each with a practice drill), one "focus for next call", six stage scores (opener, reason for call, discovery, value pitch, objection handling, close), goal clarity, call control, cultural fit, feedback on the user's own review.
- **Evidence:** 6-12 key moments (exact quote, win or miss, a "better line"), objections (real or reflex, how handled, better response), missed signals, voice assessment, and the **persona reveal** (who they were, how they felt over time, the hidden truth).
- **Measurements** shown beside it: pace, share of words understood clearly, fillers, longest unbroken run, flatness, share of sentences that trail off, share ending on a rising pitch.
- **Quote verification** (`lib/reportVerify.ts`): any quote not found in the transcript is dropped, and the number dropped is shown. Pattern borrowed from the open-source real-time-call-trainer-oss.
- Every moment has a play button that seeks the user's recording (`GET /api/call/[id]/audio`, supports Range). The recording contains **only the user's microphone**, not the prospect.
- Calibration check on 2026-10-25: a real 3.7-minute call scored 3/10 with a 9% conversion chance and sensible, specific fixes.

### 4.6 Navigation and other features

- `/` home: projects, recent calls (last 10), buttons to People and All calls.
- `/calls`: all calls newest first with rating, conversion and outcome.
- `/people` and `/people/[key]`: calls grouped by person (see 4.7).
- **Call again** (`redoCall`, in `lib/actions.ts`): same person, same mood and situation, no new Anthropic cost. The prospect does **not** remember earlier calls. It appears on scorecards and person pages; interrupted calls get "Retry with the same person".

### 4.7 People pages (`lib/people.ts`)

- A person = a saved persona. Calls are grouped by `sha256(persona JSON)` (first 12 hex characters), so only "Call again" links calls together.
- A person appears only after their **first scorecard**, because their identity is hidden until then. Everything else is listed under "Waiting for a first scorecard" with a state: `ready`, `interrupted` (started but never connected) or `needs_scoring`.
- Person page: who they are (from the latest scorecard), call count, best rating, trend line (`components/Trend.tsx`), all calls, latest focus, Call again.

---

## 5. Build status

### 5.1 Plan steps

| Step | Scope | Status |
|---|---|---|
| 1 Setup | Next.js app, dependencies, ElevenLabs skills copied project-local, `.env.example`, ElevenLabs agent created | Done |
| 2 Presets and profiles | Create projects, create calls with a prospect profile and difficulty | Done |
| 3 Live call | Persona generation, call screen, recording, end-of-call saving | Done |
| 4 Scorecard | Transcript, Deepgram, Gemini, Opus coach, report page, replay, self-review | Done |
| Extras beyond the plan | All calls page, People pages, Call again, stable voice per person, prepare-while-you-read, hang-up safety (a call can only start once) | Done |
| 5 Polish | Region voices, cross-call coaching, charts, ambient sound, visual polish | **Not started** (user is practising first) |

Verified 2026-10-26: `npm test` gives 30 passing tests in 5 files (validation 4, persona 7, analysis 13, voices 2, people 4). Type-check and lint were clean at the last change.

### 5.2 File map (app folder `cold-call-trainer/`)

| Path | What it does |
|---|---|
| `app/page.tsx` | Home: projects, recent calls |
| `app/presets/new/page.tsx` | New project form |
| `app/session/new/page.tsx` | New call form (paste a prospect) |
| `app/call/[id]/page.tsx` | Call page, loads `CallScreen` |
| `app/report/[id]/page.tsx` | Scorecard page; generates the report if missing |
| `app/calls/page.tsx` | All calls history |
| `app/people/page.tsx`, `app/people/[key]/page.tsx` | People list and person detail |
| `app/api/call/prepare/route.ts` | Generates and stores the persona |
| `app/api/call/start/route.ts` | Claims the session, mints signed URL, returns overrides |
| `app/api/call/[id]/audio/route.ts` | POST saves the recording; GET streams it with Range |
| `app/api/call/[id]/voice/route.ts` | Saves pitch and loudness samples |
| `app/api/call/[id]/end/route.ts` | Saves the ElevenLabs conversation id, status `scoring` |
| `app/api/call/[id]/review/route.ts` | Saves the user's self-review |
| `app/api/report/[id]/route.ts` | Triggers report generation |
| `components/CallScreen.tsx` | Mic, recording, voice sampler, call controls, self-review |
| `components/ReportView.tsx` | The scorecard UI with replay buttons |
| `components/GenerateReport.tsx` | "Your coach is reviewing the call" progress screen |
| `components/PresetForm.tsx`, `SessionForm.tsx`, `Trend.tsx` | Forms and the trend line |
| `lib/persona.ts` | Dials, persona schema, generator, live-call prompt |
| `lib/voices.ts` | Voice choice (4-voice fallback, TODO) |
| `lib/report.ts` | Report schemas, the two Opus calls, score clamping, quote verification |
| `lib/scoring.ts` | Orchestrates one report; `StoredReport` type |
| `lib/rubric.ts` | The coaching rubric and calibration guide |
| `lib/transcript.ts` | Fetches and cleans the ElevenLabs transcript |
| `lib/deepgram.ts`, `lib/tone.ts` | Deepgram words; Gemini tone |
| `lib/speechMetrics.ts`, `lib/voiceMetrics.ts` | Pure maths: clarity, pace, fillers; pitch, flatness, trailing off |
| `lib/reportVerify.ts` | Quote checking |
| `lib/people.ts` | Groups calls into people |
| `lib/actions.ts` | Server actions: `createPreset`, `createSession`, `redoCall` |
| `lib/db.ts`, `db/schema.ts` | SQLite connection, table creation (raw SQL), Drizzle schema |
| `lib/validation.ts`, `lib/format.ts`, `lib/anthropic.ts` | Zod input rules, shared formatting, Anthropic client and model id |
| `lib/*.test.ts` | The 30 unit tests |
| `.claude/skills/` | 13 ElevenLabs skills copied project-local from `elevenlabs/skills` (`skills-lock.json` records them) |
| `trainer.db` (+ `-wal`, `-shm`) | The database (git-ignored) |
| `recordings/` | `<sessionId>.webm` (the user's voice) and `<sessionId>.voice.json` |
| `AGENTS.md` | Auto-written by `next dev`: "this is not the Next.js you know" |

Database tables: `presets` (id, name, offer, price, ideal_customer, call_goal, created_at) and `sessions` (id, preset_id, profile, difficulty, persona JSON, conversation_id, status `setup|live|scoring|done`, report JSON, self_review, created_at). Input rules: an offer needs at least 10 characters, a prospect profile at least 20.

### 5.3 Where the code differs from the original plan

- Plan: WebRTC token and a first-message override. Code: signed-URL WebSocket and a `{{pickup_line}}` dynamic variable.
- Plan: routes `/api/persona` and `/api/signed-url`. Code: `/api/call/prepare` and `/api/call/start`.
- Plan: shadcn/ui. Code: plain Tailwind (no shadcn installed).
- Plan: one scorer call. Code: two parallel calls.
- Plan: persona at default effort. Code: effort `low` (23 s instead of 40 s).
- Unused dependencies still installed: `@deepgram/sdk` (code uses `fetch`) and `drizzle-kit` (tables are created by raw SQL, no migrations). Safe to remove.

---

## 6. What is left

### 6.1 Step 5 (only when the user asks), in recommended order

1. **Region-matched voices.** The ElevenLabs key now has `voices_read` (checked 2026-10-26: `/v2/voices` and `/v1/shared-voices` respond). Build a catalog from the shared library (filter by accent: british, american, australian, irish, german, french, dutch, arabic...) keyed by the persona's `region` and `gender`, keep the stable-hash selection, and keep the 4 fallback voices. Edit `lib/voices.ts`. The generator already outputs `region`, `accent` and `voiceBrief`, which are currently unused for voice choice.
2. **Cross-call coaching.** Pin the last "focus for next call" on the call screen before dialling; after 5+ calls, a "habits across calls" section ("you skipped the ask in 4 of 6 calls").
3. **Progress charts** across all calls (rating, clarity, pace, fillers). The `dataviz` skill applies. `Trend.tsx` is a minimal start.
4. **Ambient background sound** per situation. Needs the ElevenLabs **Sound Effects** key permission (unverified whether it is granted); the persona already has `situation.soundscape`.
5. **Visual polish.** The UI is plain Tailwind. The `impeccable`, `emil-design-eng` and `dataviz` skills were identified as useful.
6. **Drill mode** (optional): short repeated reps, for example 10 openers or 10 "not interested" replies in a row.
7. **Edit and delete projects**; there is only create today.
8. **Backups** (see 9.4).

### 6.2 Known limitations and ideas not built

- A prospect does not remember earlier calls (even on Call again).
- Voices ignore region until 6.1 step 1 is done.
- Persona takes about 23 seconds (hidden while the user reads the brief). The scorecard takes about 90 seconds.
- Gemini tone: model names change; `lib/tone.ts` tries two models and, if both fail, the report simply omits the listener's notes.
- If Anthropic credit runs out, persona and report generation fail with a billing error.
- ElevenLabs free-tier credits are small (see section 8).
- Recording and ElevenLabs transcript times are assumed to line up (both start when the call connects). Unverified to the second; replay buttons start 1 second early.
- The user's own mic is recorded by a second `getUserMedia` stream; echo cancellation is on, noise suppression is off. Headphones are recommended so the prospect's voice does not leak into the recording.
- No authentication, single user, local only.
- No fallback Anthropic model: the optional server-side `fallbacks` parameter (suggested by the claude-api skill for Opus 5.5) was deliberately skipped. A refusal throws an error and the UI shows "try again".
- Housekeeping, none of it urgent: see 7.5 for git and file clutter.

---

## 7. Gotchas and hard-won lessons

### 7.1 ElevenLabs rejects the `first_message` override
- **Symptom:** the call connected and ended after about 1 second; transcript empty; termination reason "Override for field 'first_message' is not allowed by config" (WebSocket close code 1008).
- **Cause:** the platform accepts the connection and sends `conversation_initiation_metadata`, then closes. The agent settings read back as "allowed", and re-applying them did not help.
- **Why it was missed:** early Node probes closed the socket right after the metadata message, so they looked successful. The fix for a probe is to wait about 4 seconds and watch for a close event.
- **Fix:** the agent's first message is `{{pickup_line}}`; each call passes `dynamicVariables: { pickup_line }`. Overriding prompt, language and voice id works fine.

### 7.2 WebRTC token vs signed URL
The first attempt used the WebRTC conversation token (`/v1/convai/conversation/token`). The final code uses a signed URL (`/v1/convai/conversation/get-signed-url`) with `connectionType: "websocket"`. Both hit the same override rejection; the signed URL is simply what is deployed and tested.

### 7.3 Opus structured output limits
- A single report schema with every field returned a 400 "compiled grammar is too large". The report is two parallel calls (verdict and evidence).
- `output_config.effort`: persona `low` (about 23 s; `medium` took about 40 s with no visible quality gain), report `high`.
- Anthropic credit is prepaid. A valid key with zero credit passes a `/v1/models` check and still fails on `messages`.

### 7.4 Next.js 16 with Cache Components (`cacheComponents: true`)
- Read the docs in `node_modules/next/dist/docs/` before writing Next code. This version differs from older knowledge.
- Do **not** write `export const dynamic = "force-dynamic"` (build error). Read request-time data (DB queries, `searchParams`) in an async component that calls `await connection()` first, wrapped in `<Suspense>`.
- A `page.tsx` cannot export extra names (move helpers to `lib/`).
- `notFound()` inside a `<Suspense>` still returns HTTP 200 but renders the 404 page (curl shows 200; the content is correct).
- React lint rule `react-hooks/set-state-in-effect` forbids calling `setState` synchronously in an effect body (async callbacks are fine).
- Server actions are in `lib/actions.ts` (`"use server"`); `redoCall.bind(null, id)` is used as a form action.

### 7.5 Git and file clutter (found 2026-10-26, not yet fixed)
- The app folder has a git repo with only the "Initial commit from Create Next App". All build work is uncommitted; there is no remote.
- `.gitignore` covers `.env*` and `trainer.db*`, but **not** `recordings/` (the user's voice recordings), `dev.log` or `bash.exe.stackdump`. Add `recordings/` to `.gitignore` before any commit or push.

### 7.6 ElevenLabs key permissions
- The key was created Agents-only on purpose. `voices_read` has since been granted (verified). The key had no `user_read` (so the credit balance cannot be read through the API; the user must check the dashboard) and **Sound Effects** is unverified.
- Conversation details (transcript, cost, termination reason) are readable with the current key via `GET /v1/convai/conversations/{id}`; this is the fastest way to debug a failed call.

### 7.7 Calls and sessions
- Do **not** call `/api/call/start` twice for one session: the first call claims it (`setup` to `live`) and the second returns 409. A call that failed after `start` is "used up".
- Free reset of a used call that already has a saved persona (no Anthropic cost): `UPDATE sessions SET status='setup', conversation_id=NULL WHERE id=?` (and `report=NULL` to rescore). Or use the **Call again** button, which creates a new session.
- The transcript from ElevenLabs contains vocal tags such as `[sighs]` and sometimes empty trailing turns; `lib/transcript.ts` cleans both.

### 7.8 Browser automation and testing notes
- The Chrome automation tab group changes between sessions; fetch tab ids again with `tabs_context_mcp`. Screenshots can time out if the tab is in the background.
- Pressing **Call** in the user's browser from automation uses their real microphone and plays the prospect through their speakers. During testing the user heard and even spoke on two such calls, and each costs a little ElevenLabs credit. Prefer Node probes for protocol checks.

### 7.9 Windows quirks
- Node cannot read paths like `/tmp/x.json` or Git-Bash `/c/...` passed as strings in `node -e`; use relative paths from the project folder.
- Git Bash has no `/usr/bin/time`; use `date +%s` to time commands.
- `npx tsx` scripts with top-level `await` must be `.mts`.
- Running Node scripts that open `trainer.db` should be done from the app folder.

---

## 8. Accounts, keys and costs

### 8.1 Env vars (`.env.local` in the app folder; never print, log or commit values)

| Variable | Service | Needed permissions or notes |
|---|---|---|
| `ELEVENLABS_API_KEY` | ElevenLabs | Agents (conversations, signed URL); `voices_read` (granted); Sound Effects for step 5 (unverified) |
| `ELEVENLABS_AGENT_ID` | ElevenLabs | `agent_9101m5qxjatces6rssv9hymdjpv8` |
| `ANTHROPIC_API_KEY` | Anthropic console | Prepaid credit; user added $10 on 2026-10-25 |
| `DEEPGRAM_API_KEY` | Deepgram | Free signup credit |
| `GEMINI_API_KEY` | Google AI Studio | Free tier available |

All five were set and, on 2026-10-25, each key was accepted by its service (checked with HTTP calls that print status only).

### 8.2 Costs

| Item | Number | Measured or estimated |
|---|---|---|
| ElevenLabs credits per minute of call | about 800 | **Measured**: a 224 s call used 2,977 credits |
| ElevenLabs cost in dollars | about $0.30 for that call (platform $0.249 + LLM $0.048), about $0.08 per minute | **Measured** from the conversation metadata |
| ElevenLabs plan of the user | `free` tier | **Measured** (metadata `tier`) |
| Free-tier monthly allowance | about 10,000 credits, roughly 3 calls | **Unverified** (from memory); balance cannot be read via API |
| Opus persona per call | about $0.05-0.10 | Estimate |
| Opus scorecard per call | about $0.30-0.40 | Estimate |
| Anthropic total per call | about $0.35-0.55, so $10 is roughly 20 calls | Estimate; the real balance must be checked in the Anthropic console |
| Deepgram and Gemini per call | cents | Estimate |
| 50-100 calls of about 4 minutes | roughly 160,000-320,000 ElevenLabs credits | Derived from the measured rate |

Advice given to the user: add ElevenLabs money before more than about 3 calls; look at the Creator tier first and watch usage after about 10 calls; check the ElevenLabs Usage page and the Anthropic console for real balances.

---

## 9. How to run, test and verify

### 9.1 Commands (run in `cold-call-trainer/`)

| Task | Command |
|---|---|
| Start the app | `npm run dev` (http://localhost:3000) |
| Unit tests | `npm test` (30 pass, about 0.5 s, free) |
| Type-check | `npx tsc --noEmit` |
| Lint | `npx eslint app components lib` |

### 9.2 Manual test loop

1. Open http://localhost:3000. Create a **project** (what you sell, price, ideal customer, goal of the call).
2. **Start a call** on it, paste a prospect profile, choose a difficulty. Wait until the button changes from "Getting the prospect ready..." to **Call**.
3. Put on headphones, press **Call**, allow the mic, have a real conversation. Hang up (or let the prospect hang up).
4. Write the self-review. The scorecard opens and takes about 90 seconds.
5. Use **Call again**, People or All calls to repeat and compare.

Spending note: each new call costs real money (ElevenLabs minutes plus about $0.35-0.55 of Anthropic). Redos skip the persona cost.

### 9.3 Where data lives

- `trainer.db` plus `trainer.db-wal` and `trainer.db-shm` in the app folder (SQLite in WAL mode).
- `recordings/<sessionId>.webm` (the user's mic) and `<sessionId>.voice.json` (pitch samples).
- Transcripts and costs also exist on ElevenLabs (retrievable by conversation id).
- As of 2026-10-26: 2 projects, 4 sessions, 2 scored calls (Ahmed, a luxury car-rental owner in Dubai, 3/10; Karan, a Dubai car-rental co-owner, 1.5/10). Sarah (a Leeds dentist) was a prospect whose first call never connected; Ahmed also has an unused redo.

### 9.4 Backups

Copy the `recordings/` folder **and** `trainer.db`, `trainer.db-wal` and `trainer.db-shm` together while the app is stopped. As of 2026-10-26 the main `trainer.db` file is only 4 KB and most data sits in the `-wal` file, so copying only `trainer.db` would lose recent calls.

---

## 10. Decisions log

- **ElevenLabs Agents** over OpenAI Realtime (about 10 voices, weak accent control) and Hume EVI (narrower accents). Priority was the most realistic human voices and accents.
- **Claude Opus 5.5** for persona and coach; Sonnet 5.5 inside the live agent for speed.
- **Local SQLite**, no accounts: one user, one laptop, zero setup.
- **Open-source repos used only as patterns, not forked:** real-time-call-trainer-oss gave the quote-verification idea; ai-cold-call-trainer gave the "what a top closer would have said" line. Deferred: Pipecat and LiveKit Agents (more work, Python server; only if ElevenLabs cost becomes a problem) and local open TTS such as Chatterbox, Orpheus, Dia, Kokoro (need a strong GPU, fewer native accents, slower).
- **Hidden persona until the report**, so the user practises cold, like a real call.
- **People are grouped by saved persona** and appear only after their first scorecard, to keep the identity hidden.
- **Prepare the persona while the user reads the brief** instead of after pressing Call, to hide the 23-second wait.
- **Two parallel report calls** because the API rejects one big schema.
- **No Anthropic fallback-model parameter**; refusals show a retry message.
- **Gemini for tone** plus browser-measured pitch, because Claude cannot hear audio.
- **Skills:** the 13 official ElevenLabs skills were copied project-local after the user chose project-local; no symlinks.
- **Step 5 deferred** by the user so they can practise and report what is missing.

---

## 11. Open questions for the user

1. After the first batch of practice calls: what felt unrealistic or missing (voices, pacing, scorecard comments)? This should decide the order of step 5.
2. Which ElevenLabs plan will they use for 50 to 100 calls, and is there a monthly budget?
3. Do they want drill mode (short repeated reps) built, and for which skills first (openers, objections, closes)?
4. Is the Sound Effects permission on the ElevenLabs key, and do they want background noise at all?
5. Do they want any of this on another device or shared with others later? That would need login and deployment changes (see 3.1).
