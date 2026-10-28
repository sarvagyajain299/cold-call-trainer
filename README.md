<div align="center">

# 📞 Cold Call Trainer

**Practise cold calls out loud, against a different realistic human every time, and get coached on exactly what to fix.**

`Next.js 16` · `ElevenLabs Agents` · `Claude` · `Deepgram` · `Gemini` · `SQLite`

</div>

---

## 🎯 The Problem

Cold calling is a skill, and the only way to learn it is to do it. But doing it for real is expensive:

- **Every bad call burns a real lead.** A first-timer's first 50 calls are mostly practice, and nobody gets those prospects back.
- **Role-play with friends doesn't work.** They go easy, they are always available, and they never hang up on you.
- **Scripts don't prepare you for people.** Real prospects are distracted, annoyed, rushed, curious or suspicious, and it depends on the day.
- **You can't hear yourself.** Mumbling, filler words, a flat voice and a rushed pace are invisible to the speaker but obvious to the listener.
- **Calling across cultures is harder.** Different accents, expectations and politeness norms across the US, UK, Australia, Europe and the Gulf.

The result: low confidence, high anxiety, and no honest feedback loop.

## 💡 The Solution

Cold Call Trainer is a **voice-first practice arena** that runs on your laptop.

1. **Save your offer once** as a project (what you sell, to whom).
2. **Describe a prospect** in one line (business, city, role) and pick a difficulty.
3. **Pick up the phone.** An AI invents a full person on the spot: mood, surroundings, personality, history with salespeople, hidden objections. They speak in a matching voice and can interrupt you, get irritated, warm up, or hang up.
4. **Hang up and read your scorecard**: conversion score, objection handling, what you did right, where you slipped, and how you sounded.

> You don't see who you called until the report. Just like the real thing.

## ✨ What Makes It Different

| | |
|---|---|
| 🎭 **Nothing is scripted** | Code only rolls numeric dials (openness, patience, mood, attention, offer fit). Claude invents everything else, so no two calls repeat. |
| 🗣️ **Real conversation** | Live voice with natural turn-taking, interruptions, and the ability to end the call on you. |
| 🎙️ **It hears you** | Per-word confidence shows which words were unclear. Pace, fillers and pauses are measured, not guessed. |
| 🎚️ **Tone and energy** | Pitch and loudness are sampled 10 times a second, and an audio model judges warmth, confidence and energy (monotone, flat, joyful...). |
| 🧾 **Evidence-checked coaching** | Every quote in the report is verified against the transcript. Invented quotes are dropped. |
| 🔁 **Try again** | Call the same person again with the same persona to practise a fix. |
| 📚 **History and trends** | Past calls, people you've spoken to, and score trends over time. |

## 🧭 How It Helps

- **Build confidence safely.** Fail 100 times in private so the real calls feel familiar.
- **Fix the right things.** The report points at specific moments and specific words, not vague advice like "sound more confident."
- **Get clearer.** Speech clarity metrics make mumbling and rushing visible so you can correct them.
- **Learn to handle objections.** Prospects raise real objections with real reasons, and you see how each one landed.
- **Prepare for your market.** Practise on prospects from the places you'll actually call.
- **Save money.** Practice calls cost cents, not leads.

## 🔄 How a Call Works

```
 Project (your offer)
        │
        ▼
 New session ──► Claude invents a persona (hidden from you)
        │
        ▼
 Live call  ◄──► ElevenLabs voice agent  (you speak, they react)
        │             records your mic + pitch/loudness samples
        ▼
 Hang up ──► quick self-review ("what would I redo?")
        │
        ▼
 Scorecard ◄── transcript + Deepgram clarity + Gemini tone + Claude coaching
```

## 🧱 Tech Stack

| Layer | Tool |
|---|---|
| App | Next.js 16 (App Router), React 19, TypeScript, Tailwind 4 |
| Live voice | ElevenLabs Agents (browser SDK, signed-URL WebSocket) |
| Persona and coaching | Anthropic Claude (structured output with Zod) |
| Speech clarity | Deepgram nova-3 |
| Tone and energy | Google Gemini audio understanding + in-browser pitch analysis (`pitchy`) |
| Storage | SQLite (`better-sqlite3` + Drizzle) |
| Tests | Vitest |

## 🚀 Run It Locally

```bash
npm install
cp .env.example .env.local   # then fill in your keys
npm run dev                  # http://localhost:3000
npm test                     # unit tests
```

Environment variables (see `.env.example`):

```
ELEVENLABS_API_KEY=
ELEVENLABS_AGENT_ID=
ANTHROPIC_API_KEY=
DEEPGRAM_API_KEY=
GEMINI_API_KEY=
```

> ⚠️ **Local use only.** There is no login. If deployed publicly, any visitor could trigger paid API calls. Never commit `.env.local`.

## 🗺️ Status

- ✅ Persona engine, live calls, scorecard, call history, People pages, "call again"
- 🔜 More regional voices and accents (today voices don't vary by region)
- 🔜 Improvements driven by real practice feedback

---

<div align="center">

*Built to turn "I hate cold calling" into "I've done this 100 times."*

</div>
