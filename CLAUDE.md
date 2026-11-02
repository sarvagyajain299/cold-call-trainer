# Cold Call Trainer

Read `PROJECT_CONTEXT.md` in this folder first: full plan, what is built, what is left, gotchas, costs.

- App: Next.js 16. Run: `npm run dev` (port 3000). Tests: `npm test`.
- Do not start "step 5" work unless the user asks; they are practising first.

Rules:
1. Never print, log or commit API keys. They live in `.env.local`; env var names are fine to mention.
2. This Next.js version has breaking changes and Cache Components on. Read `node_modules/next/dist/docs/` before writing Next code.
3. Ask the user before installing any skill (global vs project-local). Copy files; never symlink.

The user wants short, step-by-step answers and to be told costs before spending credits. Use they/them.
