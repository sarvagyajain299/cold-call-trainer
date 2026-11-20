import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { eq } from "drizzle-orm";
import { X } from "lucide-react";
import { db } from "@/lib/db";
import { sessions } from "@/db/schema";
import type { StoredReport } from "@/lib/scoring";
import { findPreviousInProject } from "@/lib/compare";
import { hasCallAudio, saveCallAudio } from "@/lib/callAudio";
import { lessonsForSession } from "@/lib/lessons/store";
import { GenerateReport } from "@/components/GenerateReport";
import { GenerateLessons, LessonRowAction } from "@/components/lessons/HomeParts";
import { FixMark, Group, PrimaryLink, SecondaryText } from "@/components/lessons/ui";
import { lessonHomeSummary } from "@/lib/lessons/summary";

const STATUS = { not_started: "Not started", in_progress: "In progress", done: "Done", skipped: "Skipped" } as const;

async function Loaded({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connection();
  const session = db.select().from(sessions).where(eq(sessions.id, id)).get();
  if (!session) notFound();

  if (!session.report) {
    if (!session.conversationId) {
      return (
        <Group>
          <p>This call has not been recorded yet, so there is nothing to learn from.</p>
          <Link href={`/call/${session.id}`} className="mt-2 inline-block text-ios-blue">Go to the call</Link>
        </Group>
      );
    }
    return (
      <Group>
        <GenerateReport sessionId={session.id} />
      </Group>
    );
  }

  const report = JSON.parse(session.report) as StoredReport;
  // Free: a local copy of the full call for the ▶ buttons, if the save after the call did not happen.
  if (session.conversationId && !(await hasCallAudio(session.id))) await saveCallAudio(session.id, session.conversationId, 1);

  const scored = db
    .select()
    .from(sessions)
    .all()
    .filter((x) => x.report)
    .map((x) => ({ ...x, createdAt: (JSON.parse(x.report as string) as StoredReport).createdAt }));
  const prevRow = findPreviousInProject({ id: session.id, presetId: session.presetId, createdAt: report.createdAt }, scored);
  const prev = prevRow ? (JSON.parse(prevRow.report as string) as StoredReport) : null;
  const summary = lessonHomeSummary(report, prev);

  const lessons = lessonsForSession(session.id);
  const nextLesson = lessons.find((l) => l.status === "not_started" || l.status === "in_progress");
  const name = report.persona.name.split(" ")[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-ios-label-2">Your call with {name}</p>
        <h1 className="text-[26px] font-bold leading-tight tracking-tight">{summary.headline}</h1>
        <ul className="flex flex-col gap-1 text-[17px] text-ios-label-2">
          {summary.lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </div>

      {lessons.length === 0 ? (
        <GenerateLessons sessionId={session.id} />
      ) : (
        <>
          <section aria-label="Lessons">
            <h2 className="mb-2 px-4 text-[13px] font-semibold uppercase tracking-wide text-ios-label-2">3 things to fix</h2>
            <ol className="flex flex-col divide-y divide-ios-sep! overflow-hidden rounded-[14px] bg-ios-surface">
              {lessons.map((l) => (
                <li key={l.id} className="flex items-center gap-3 px-4 py-3">
                  <FixMark size={12} />
                  <Link href={`/lessons/${session.id}/${l.ord}`} className="min-w-0 flex-1 py-1">
                    <span className="block text-[17px] font-medium leading-snug">{l.title}</span>
                    <span className="block text-[15px] text-ios-label-2">
                      Lesson {l.ord} · {STATUS[l.status]}
                      {l.bestScore !== null ? ` · best ${l.bestScore}/10` : ""}
                    </span>
                  </Link>
                  <LessonRowAction lesson={l} />
                </li>
              ))}
            </ol>
          </section>
          <div className="flex flex-col items-center gap-2 sm:items-start">
            {nextLesson ? (
              <PrimaryLink href={`/lessons/${session.id}/${nextLesson.ord}`}>
                {nextLesson.status === "in_progress" ? "Continue" : "Start"} lesson {nextLesson.ord}
              </PrimaryLink>
            ) : (
              <PrimaryLink href={`/report/${session.id}`}>See full report</PrimaryLink>
            )}
            <SecondaryText>About 3 minutes each.</SecondaryText>
          </div>
        </>
      )}
    </div>
  );
}

export default function LessonsHome({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="lessons min-h-dvh">
      <header className="mx-auto flex w-full max-w-[560px] items-center justify-between px-4 pr-32 pt-[max(12px,env(safe-area-inset-top))] pb-2 lg:pr-4">
        <Link href="/" className="inline-flex min-h-[44px] items-center gap-1.5 text-[17px] text-ios-blue">
          <X size={18} aria-hidden /> Home
        </Link>
        <Suspense fallback={null}>
          <ReportLink params={params} />
        </Suspense>
      </header>
      <main className="mx-auto w-full max-w-[560px] px-4 pb-10">
        <Suspense fallback={<SecondaryText>Loading…</SecondaryText>}>
          <Loaded params={params} />
        </Suspense>
      </main>
    </div>
  );
}

async function ReportLink({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Link href={`/report/${id}`} className="inline-flex min-h-[44px] items-center text-[17px] text-ios-blue">
      See full report
    </Link>
  );
}
