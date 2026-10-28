import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { presets, sessions } from "@/db/schema";
import type { StoredReport } from "@/lib/scoring";

async function Projects() {
  await connection();
  const all = db.select().from(presets).orderBy(desc(presets.createdAt)).all();

  if (all.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-sm text-zinc-500">
        No projects yet. Create one so the coach knows what you are selling.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {all.map((p) => (
        <li key={p.id} className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <p className="font-medium">{p.name}</p>
            <p className="line-clamp-1 text-sm text-zinc-500">{p.offer}</p>
          </div>
          <Link
            href={`/session/new?preset=${p.id}`}
            className="rounded-full bg-foreground px-4 py-1.5 text-sm text-background"
          >
            Start a call
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function RecentCalls() {
  await connection();
  const recent = db.select().from(sessions).orderBy(desc(sessions.createdAt)).limit(10).all();

  if (recent.length === 0) return <p className="text-sm text-zinc-500">No calls yet.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {recent.map((s) => {
        const rating = s.report ? (JSON.parse(s.report) as StoredReport).analysis.overallRating : null;
        const href = s.status === "setup" || s.status === "live" ? `/call/${s.id}` : `/report/${s.id}`;
        const label = s.status === "done" ? `scored ${rating}/10` : s.status === "scoring" ? "ready to score" : s.status === "setup" ? "not called yet" : s.status;
        return (
          <li key={s.id}>
            <Link href={href} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900">
              <span className="line-clamp-1">{s.profile}</span>
              <span className="shrink-0 text-zinc-500">
                {s.difficulty} · {label}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Cold Call Trainer</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Save what you sell once. Paste a prospect. Pick up the phone.
        </p>
        <nav className="mt-4 flex gap-2 text-sm">
          <Link href="/people" className="rounded-full border px-4 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-900">People</Link>
          <Link href="/calls" className="rounded-full border px-4 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-900">All calls</Link>
        </nav>
      </header>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Your projects</h2>
          <Link href="/presets/new" className="rounded-full border px-4 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900">
            New project
          </Link>
        </div>
        <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
          <Projects />
        </Suspense>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Recent calls</h2>
          <Link href="/calls" className="text-sm underline">See all calls and scorecards</Link>
        </div>
        <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
          <RecentCalls />
        </Suspense>
      </section>
    </main>
  );
}
