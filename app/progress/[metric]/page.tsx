import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions } from "@/db/schema";
import type { StoredReport } from "@/lib/scoring";
import { metricPoints } from "@/lib/progress";
import { MetricChart } from "@/components/MetricChart";
import { ABOUT } from "@/lib/about";

const RANGE: Record<string, [number, number]> = {
  "/10": [0, 10],
  "%": [0, 100],
  "/100": [0, 100],
  " wpm": [60, 240],
  "/min": [0, 10],
};

const when = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

async function Detail({ params }: { params: Promise<{ metric: string }> }) {
  const { metric } = await params;
  await connection();
  const rows = db
    .select()
    .from(sessions)
    .orderBy(asc(sessions.createdAt))
    .all()
    .filter((r) => r.report)
    .map((r) => ({ id: r.id, createdAt: r.createdAt, difficulty: r.difficulty, report: JSON.parse(r.report as string) as StoredReport }))
    // The call happens just before it is scored, so the scorecard time is when it really took place
    // (a session can be created days before the call is made).
    .sort((a, b) => a.report.createdAt - b.report.createdAt);

  const found = metricPoints(rows, metric);
  if (!found) notFound();
  const { def, points } = found;
  const [min, max] = RANGE[def.unit] ?? [0, 10];
  const shown = (v: number) => (def.unit === "/10" || def.unit === "/100" ? `${v}` : `${v}${def.unit}`);

  return (
    <>
      <h1 className="text-2xl font-semibold">{def.label}</h1>
      <p className="text-sm text-zinc-500">
        {def.better === "higher" ? "Higher is better." : def.better === "lower" ? "Lower is better." : `Closer to ${def.target}${def.unit} is better.`} {points.length} scored calls.
      </p>
      {points.length < 2 ? (
        <p className="text-sm text-zinc-500">A chart needs at least two calls with this reading.</p>
      ) : (
        <MetricChart points={points} min={min} max={max} unit={def.unit} target={def.better === "target" ? def.target : undefined} label={def.label} />
      )}
      {ABOUT[def.key] && (
        <section className="flex flex-col gap-3 rounded-lg border p-4 text-sm">
          <h2 className="text-lg font-semibold">About this measure</h2>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">What it is</p>
            <p>{ABOUT[def.key].what}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">How it is calculated</p>
            <p>{ABOUT[def.key].how}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">What affects it</p>
            <p>{ABOUT[def.key].affects}</p>
          </div>
          <p className="text-xs text-zinc-500">
            An arrow appears only when it changes by at least {def.step}
            {def.unit === "/10" || def.unit === "/100" ? "" : def.unit}, which is treated as more than normal scoring noise.
          </p>
        </section>
      )}
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Every call</h2>
        <ul className="flex flex-col gap-2">
          {[...points].reverse().map((p, i, arr) => {
            const before = arr[i + 1];
            const delta = before ? Math.round((p.value - before.value) * 10) / 10 : null;
            return (
              <li key={p.sessionId}>
                <Link href={`/report/${p.sessionId}`} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900">
                  <span className="min-w-0">
                    <span className="block font-medium">{p.name}</span>
                    <span className="block text-xs text-zinc-500">{when.format(p.createdAt)} · {p.difficulty}</span>
                  </span>
                  <span className="shrink-0 text-right tabular-nums">
                    {shown(p.value)}
                    {delta !== null && <span className="block text-xs text-zinc-500">{delta >= 0 ? "+" : ""}{delta}</span>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

export default function MetricPage({ params }: { params: Promise<{ metric: string }> }) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <Link href="/progress" className="text-sm text-zinc-500">← All progress</Link>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <Detail params={params} />
      </Suspense>
    </main>
  );
}
