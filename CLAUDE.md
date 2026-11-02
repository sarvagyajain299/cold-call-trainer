# Cold Call Trainer

Read `PROJECT_CONTEXT.md` in this folder first: full plan, what is built, what is left, gotchas, costs.

- App: Next.js 16. Run: `npm run dev` (port 3000). Tests: `npm test`.
- Planned next work is in `SCORECARD_MEMORY_CHEATSHEET_PLAN.md` (scorecard redesign, memory between calls, cheat sheet). It is a plan only: do not start building until the user says "start phase N". Do not start the old "step 5" work unless asked.

Rules:
1. Never print, log or commit API keys. They live in `.env.local`; env var names are fine to mention.
2. This Next.js version has breaking changes and Cache Components on. Read `node_modules/next/dist/docs/` before writing Next code.
3. Ask the user before installing any skill (global vs project-local). Copy files; never symlink.

The user wants short, step-by-step answers and to be told costs before spending credits. Use they/them.
