import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions } from "@/db/schema";
import type { StoredReport } from "@/lib/scoring";
import { buildSeries, countHabits, type Series } from "@/lib/progress";
import { Sparkline } from "@/components/Sparkline";

const RANGE: Record<string, [number, number]> = {
  "/10": [0, 10],
  "%": [0, 100],
  "/100": [0, 100],
  " wpm": [60, 240],
  "/min": [0, 10],
};

function Card({ s }: { s: Series }) {
  const [min, max] = RANGE[s.def.unit] ?? [0, 10];
  const arrow = s.direction === "up" ? "▲" : s.direction === "down" ? "▼" : "";
  const tone = s.direction === "same" ? "flat" : s.good ? "good" : "bad";
  const colour = tone === "good" ? "text-green-600 dark:text-green-400" : tone === "bad" ? "text-red-600 dark:text-red-400" : "text-zinc-500";
  return (
    <li>
      <Link href={`/progress/${s.def.key}`} className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-zinc-50 dark:hover:bg-zinc-900">
      <div className="min-w-0">
        <p className="text-sm font-medium">{s.def.label}</p>
        <p className="text-xs text-zinc-500">
          latest {s.latest}{s.def.unit === "/10" || s.def.unit === "/100" ? "" : s.def.unit}
        </p>
        <p className={`text-xs ${colour}`}>
          {s.from} → {s.to} {arrow}{s.direction === "same" ? " no real change" : ""}
        </p>
      </div>
        <Sparkline values={s.values} min={min} max={max} label={s.def.label} tone={tone} />
      </Link>
    </li>
  );
}

async function Progress() {
  await connection();
  const rows = db.select().from(sessions).orderBy(asc(sessions.createdAt)).all().filter((r) => r.report);
  const reports = rows
    .map((r) => JSON.parse(r.report as string) as StoredReport)
    .sort((a, b) => a.createdAt - b.createdAt);

  if (reports.length < 2) {
    return <p className="text-sm text-zinc-500">Progress shows up after your second scored call. So far: {reports.length}.</p>;
  }

  const series = buildSeries(reports);
  const habits = countHabits([...reports].reverse());
  const groups: [string, string, Series[]][] = [
    ["scores", "Overall", series.filter((s) => s.def.group === "scores")],
    ["stages", "Call stages", series.filter((s) => s.def.group === "stages")],
    ["voice", "Voice and delivery", series.filter((s) => s.def.group === "voice")],
  ];

  return (
    <div className="flex flex-col gap-10">
      <p className="text-sm text-zinc-500">
        {reports.length} scored calls. Each line runs from your oldest call to your newest. Click any card for the full chart. The arrows compare your first calls with your latest (an average of up to 3 each).
        An arrow only appears when the change is bigger than normal scoring noise. Prospects differ in difficulty, so read trends, not single calls.
      </p>
      {groups.map(([id, title, list]) => (
        <section key={id} className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <ul className="grid gap-2 sm:grid-cols-2">{list.map((s) => <Card key={s.def.key} s={s} />)}</ul>
        </section>
      ))}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Habits to fix</h2>
        {habits.length === 0 ? (
          <p className="text-sm text-zinc-500">Habit counts start with scorecards made after the redesign. Score a new call to see them.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {habits.slice(0, 10).map((h) => (
              <li key={h.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                <span>{h.label}</span>
                <span className="tabular-nums text-zinc-500">{h.calls} of your last {h.outOf} calls</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function ProgressPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <Link href="/" className="text-sm text-zinc-500">← Home</Link>
      <h1 className="text-2xl font-semibold">Your progress</h1>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <Progress />
      </Suspense>
    </main>
  );
}
