import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { presets, sessions } from "@/db/schema";
import type { StoredReport } from "@/lib/scoring";
import { getSheet } from "@/lib/sheetData";
import { scriptBlanks } from "@/lib/sheetModel";
import { summarise } from "@/lib/projectSummary";
import { dateTime, OUTCOMES, ratingColour } from "@/lib/format";

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="text-sm">{value || "Not set"}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

async function Loaded({ params }: { params: Promise<{ presetId: string }> }) {
  const { presetId } = await params;
  await connection();
  const preset = db.select().from(presets).where(eq(presets.id, presetId)).get();
  if (!preset) notFound();

  const rows = db.select().from(sessions).where(eq(sessions.presetId, presetId)).orderBy(desc(sessions.createdAt)).all();
  const calls = rows.map((s) => ({ s, report: s.report ? (JSON.parse(s.report) as StoredReport) : null }));
  const summary = summarise(
    rows.length,
    calls.flatMap(({ s, report }) => (report ? [{ createdAt: s.createdAt, rating: report.analysis.overallRating, focus: report.analysis.focusNextCall }] : [])),
  );
  const blanks = scriptBlanks(getSheet(presetId).sections);

  return (
    <>
      <header className="flex flex-col gap-3">
        <div>
          <p className="text-sm text-zinc-500">Project</p>
          <h1 className="text-2xl font-semibold">{preset.name}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/session/new?preset=${preset.id}`} className="rounded-full bg-foreground px-4 py-1.5 text-sm text-background">
            Start a call
          </Link>
          <Link href={`/cheatsheet/${preset.id}`} className="rounded-full border px-4 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900">
            Script &amp; cheat sheet
          </Link>
        </div>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">What you sell</h2>
        <dl className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Fact label="Offer" value={preset.offer} />
          </div>
          <Fact label="Price" value={preset.price} />
          <Fact label="Goal of the call" value={preset.callGoal} />
          <div className="sm:col-span-2">
            <Fact label="Ideal customer" value={preset.idealCustomer} />
          </div>
        </dl>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Script</h2>
        {blanks.length > 0 ? (
          <p className="rounded-lg border border-dashed p-3 text-sm">
            <span className="font-semibold">Not ready: {blanks.length} {blanks.length === 1 ? "blank" : "blanks"} to fill.</span>{" "}
            <span className="text-zinc-500">{blanks.join(", ")}.</span>{" "}
            <Link href={`/cheatsheet/${preset.id}`} className="underline">Fill them in</Link>
          </p>
        ) : (
          <p className="rounded-lg border p-3 text-sm">
            <span className="font-semibold">Ready.</span> Every step has real words.{" "}
            <Link href={`/cheatsheet/${preset.id}`} className="underline">Rehearse it</Link>
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Results</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Calls" value={String(summary.calls)} />
          <Stat label="Scored" value={String(summary.scored)} />
          <Stat label="Average" value={summary.average === null ? "–" : `${summary.average}/10`} />
          <Stat label="Best" value={summary.best === null ? "–" : `${summary.best}/10`} />
        </div>
        {summary.latestFocus && (
          <p className="rounded-lg border-2 border-foreground p-3 text-sm">
            <span className="font-semibold">Focus for your next call: </span>
            {summary.latestFocus}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Calls</h2>
        {calls.length === 0 ? (
          <p className="text-sm text-zinc-500">No calls for this project yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {calls.map(({ s, report }) => {
              const href = s.status === "setup" || s.status === "live" ? `/call/${s.id}` : `/report/${s.id}`;
              return (
                <li key={s.id}>
                  <Link href={href} className="flex items-center justify-between gap-4 rounded-lg border p-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900">
                    <div className="min-w-0">
                      <p className="line-clamp-1 font-medium">{report ? `${report.persona.name}, ${report.persona.role}` : s.profile}</p>
                      <p className="line-clamp-1 text-zinc-500">
                        {dateTime.format(s.createdAt)} · {s.difficulty}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {report ? (
                        <>
                          <p className={`text-lg font-semibold tabular-nums ${ratingColour(report.analysis.overallRating)}`}>
                            {report.analysis.overallRating}/10
                          </p>
                          <p className="text-xs text-zinc-500">{OUTCOMES[report.analysis.outcome] ?? report.analysis.outcome}</p>
                        </>
                      ) : (
                        <p className="text-xs text-zinc-500">
                          {s.status === "setup" ? "not called yet" : s.status === "scoring" ? "ready to score" : s.status}
                        </p>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

export default function ProjectPage({ params }: { params: Promise<{ presetId: string }> }) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
      <Link href="/" className="text-sm text-zinc-500">← Home</Link>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <Loaded params={params} />
      </Suspense>
    </main>
  );
}
