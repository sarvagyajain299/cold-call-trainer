import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { presets, sessions } from "@/db/schema";
import type { StoredReport } from "@/lib/scoring";

const OUTCOMES: Record<string, string> = {
  meeting_booked: "Meeting booked",
  callback_agreed: "Callback agreed",
  info_requested: "Asked for info",
  brushed_off: "Brushed off",
  hung_up: "Hung up on you",
  ended_neutral: "Ended neutrally",
};

const when = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function scoreColour(n: number) {
  if (n >= 7) return "text-green-600 dark:text-green-400";
  if (n >= 4) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

async function AllCalls() {
  await connection();
  const rows = db
    .select({ s: sessions, projectName: presets.name })
    .from(sessions)
    .leftJoin(presets, eq(presets.id, sessions.presetId))
    .orderBy(desc(sessions.createdAt))
    .all();

  if (rows.length === 0) return <p className="text-sm text-zinc-500">No calls yet.</p>;

  return (
    <ul className="flex flex-col gap-2">
      {rows.map(({ s, projectName }) => {
        const report = s.report ? (JSON.parse(s.report) as StoredReport) : null;
        const href = s.status === "setup" || s.status === "live" ? `/call/${s.id}` : `/report/${s.id}`;
        return (
          <li key={s.id}>
            <Link href={href} className="flex items-center justify-between gap-4 rounded-lg border p-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900">
              <div className="min-w-0">
                <p className="line-clamp-1 font-medium">{report ? `${report.persona.name}, ${report.persona.role}` : s.profile}</p>
                <p className="line-clamp-1 text-zinc-500">
                  {when.format(s.createdAt)} · {projectName ?? "deleted project"} · {s.difficulty}
                </p>
              </div>
              <div className="shrink-0 text-right">
                {report ? (
                  <>
                    <p className={`text-lg font-semibold tabular-nums ${scoreColour(report.analysis.overallRating)}`}>
                      {report.analysis.overallRating}/10
                    </p>
                    <p className="text-xs text-zinc-500">
                      {report.analysis.conversionScore}% · {OUTCOMES[report.analysis.outcome] ?? report.analysis.outcome}
                    </p>
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
  );
}

export default function CallsPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <Link href="/" className="text-sm text-zinc-500">← Home</Link>
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">All calls</h1>
        <Link href="/people" className="text-sm underline">View by person</Link>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <AllCalls />
      </Suspense>
    </main>
  );
}
