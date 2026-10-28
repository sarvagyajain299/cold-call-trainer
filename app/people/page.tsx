import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { sessions } from "@/db/schema";
import { groupPeople, type Waiting } from "@/lib/people";
import { redoCall } from "@/lib/actions";
import { Trend } from "@/components/Trend";
import { ratingColour, shortDate as when } from "@/lib/format";

function WaitingItem({ w }: { w: Waiting }) {
  const action =
    w.state === "ready" ? (
      <Link href={`/call/${w.sessionId}`} className="rounded-full border px-3 py-1 text-xs">Start this call</Link>
    ) : w.state === "needs_scoring" ? (
      <Link href={`/report/${w.sessionId}`} className="rounded-full border px-3 py-1 text-xs">Get the scorecard</Link>
    ) : (
      <form action={redoCall.bind(null, w.sessionId)}>
        <button className="rounded-full border px-3 py-1 text-xs">Retry with the same person</button>
      </form>
    );
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
      <div className="min-w-0">
        <p className="line-clamp-1">{w.profile}</p>
        <p className="text-xs text-zinc-500">
          {when.format(w.createdAt)} · {w.difficulty} ·{" "}
          {w.state === "ready" ? "not called yet" : w.state === "needs_scoring" ? "called, not scored" : "the call never connected"}
        </p>
      </div>
      {action}
    </li>
  );
}

async function Everyone() {
  await connection();
  const rows = db.select().from(sessions).all();
  const { people, waiting } = groupPeople(rows);

  return (
    <>
      <section className="flex flex-col gap-3">
        {people.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-sm text-zinc-500">
            Nobody yet. People appear here after their first scorecard, because who they are stays hidden until then.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {people.map((p) => {
              const scored = [...p.calls].reverse().filter((c) => c.scored);
              const latest = scored[scored.length - 1];
              return (
                <li key={p.key}>
                  <Link href={`/people/${p.key}`} className="flex items-center justify-between gap-4 rounded-lg border p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900">
                    <div className="min-w-0">
                      <p className="font-medium">{p.persona.name}</p>
                      <p className="line-clamp-1 text-sm text-zinc-500">
                        {p.persona.role} · {p.persona.city}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {p.scoredCount} {p.scoredCount === 1 ? "call" : "calls"} · last {when.format(p.lastCalledAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-4">
                      <Trend ratings={scored.map((c) => c.rating ?? 0)} />
                      <div className="text-right">
                        <p className={`text-2xl font-semibold tabular-nums ${ratingColour(latest.rating ?? 0)}`}>{latest.rating}</p>
                        <p className="text-xs text-zinc-500">latest /10</p>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {waiting.length > 0 && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-lg font-medium">Waiting for a first scorecard</h2>
            <p className="text-sm text-zinc-500">Their names stay hidden until you have called them.</p>
          </div>
          <ul className="flex flex-col gap-2">
            {waiting.map((w) => (
              <WaitingItem key={w.sessionId} w={w} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

export default function PeoplePage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
      <div className="flex flex-col gap-2">
        <Link href="/" className="text-sm text-zinc-500">← Home</Link>
        <h1 className="text-2xl font-semibold">People you have called</h1>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <Everyone />
      </Suspense>
    </main>
  );
}
