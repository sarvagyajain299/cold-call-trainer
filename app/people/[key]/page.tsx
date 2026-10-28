import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { sessions } from "@/db/schema";
import { groupPeople } from "@/lib/people";
import { redoCall } from "@/lib/actions";
import { Trend } from "@/components/Trend";
import { dateTime, OUTCOMES, ratingColour } from "@/lib/format";
import type { StoredReport } from "@/lib/scoring";

async function Loaded({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  await connection();
  const rows = db.select().from(sessions).all();
  const person = groupPeople(rows).people.find((p) => p.key === key);
  if (!person) notFound();

  // The coach's description of who they were comes from their most recent scorecard.
  const latestScored = person.calls.find((c) => c.scored);
  const latestReport = latestScored
    ? (JSON.parse(rows.find((r) => r.id === latestScored.id)?.report as string) as StoredReport)
    : null;

  const scored = [...person.calls].reverse().filter((c) => c.scored);
  const ratings = scored.map((c) => c.rating ?? 0);
  const best = Math.max(...ratings);
  const change = ratings[ratings.length - 1] - ratings[0];
  const { persona } = person;

  return (
    <>
      <header className="flex flex-col gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{persona.name}</h1>
          <p className="text-zinc-500">
            {persona.role}, {persona.businessName} · {persona.city}, {persona.country}
          </p>
        </div>
        {latestReport && <p className="text-sm">{latestReport.analysis.personaReveal.whoTheyWere}</p>}
        <form action={redoCall.bind(null, person.latestSessionId)}>
          <button className="rounded-full bg-foreground px-4 py-1.5 text-sm text-background">
            Call {persona.name.split(" ")[0]} again
          </button>
          <p className="mt-1 text-xs text-zinc-500">Same person, same mood and situation. They will not remember earlier calls.</p>
        </form>
      </header>

      <section className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg border p-3">
          <p className="text-2xl font-semibold tabular-nums">{person.scoredCount}</p>
          <p className="text-xs text-zinc-500">{person.scoredCount === 1 ? "call scored" : "calls scored"}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className={`text-2xl font-semibold tabular-nums ${ratingColour(best)}`}>{best}</p>
          <p className="text-xs text-zinc-500">best rating</p>
        </div>
        <div className="flex flex-col items-center justify-center rounded-lg border p-3">
          {ratings.length >= 2 ? (
            <>
              <Trend ratings={ratings} />
              <p className="text-xs text-zinc-500">
                {change > 0 ? "up" : change < 0 ? "down" : "no change"} {change !== 0 && Math.abs(Math.round(change * 10) / 10)} since the first call
              </p>
            </>
          ) : (
            <p className="text-xs text-zinc-500">Call again to see a trend</p>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Calls with {persona.name.split(" ")[0]}</h2>
        <ul className="flex flex-col gap-2">
          {person.calls.map((c) => (
            <li key={c.id}>
              <Link
                href={c.scored ? `/report/${c.id}` : `/call/${c.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <div>
                  <p className="font-medium">{dateTime.format(c.createdAt)}</p>
                  <p className="text-xs text-zinc-500">{c.difficulty}</p>
                </div>
                {c.scored ? (
                  <div className="text-right">
                    <p className={`text-lg font-semibold tabular-nums ${ratingColour(c.rating ?? 0)}`}>{c.rating}/10</p>
                    <p className="text-xs text-zinc-500">
                      {c.conversion}% · {OUTCOMES[c.outcome ?? ""] ?? c.outcome}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500">not scored yet</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {latestReport && (
        <section className="rounded-lg border-2 border-foreground p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Your focus from the latest call</p>
          <p className="mt-1 font-medium">{latestReport.analysis.focusNextCall}</p>
        </section>
      )}
    </>
  );
}

export default function PersonPage({ params }: { params: Promise<{ key: string }> }) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
      <Link href="/people" className="text-sm text-zinc-500">← All people</Link>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <Loaded params={params} />
      </Suspense>
    </main>
  );
}
