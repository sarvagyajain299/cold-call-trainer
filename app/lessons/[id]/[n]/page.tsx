import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { hasCallAudio } from "@/lib/callAudio";
import { attemptsFor, getReport, lessonsForSession } from "@/lib/lessons/store";
import { feelingSteps, turnLanes } from "@/lib/lessons/model";
import { LessonFlow } from "@/components/lessons/LessonFlow";

async function Loaded({ params }: { params: Promise<{ id: string; n: string }> }) {
  const { id, n } = await params;
  await connection();
  const found = getReport(id);
  const lessons = found ? lessonsForSession(id) : [];
  const lesson = lessons.find((l) => l.ord === Number(n));
  if (!found || !lesson) redirect(`/lessons/${id}`);

  const { report } = found;
  const duration = report.meta.durationSecs;
  return (
    <LessonFlow
      lesson={lesson}
      lanes={turnLanes(report.transcript, duration)}
      steps={feelingSteps(report.analysis.personaReveal.feelings, lesson.data.feelingLevels, duration)}
      texts={report.transcript.map((t) => t.text)}
      duration={duration}
      hasAudio={await hasCallAudio(id)}
      pastAttempts={attemptsFor(lesson.id)}
      totalLessons={lessons.length}
    />
  );
}

export default function LessonPage({ params }: { params: Promise<{ id: string; n: string }> }) {
  return (
    <Suspense fallback={<div className="lessons min-h-dvh" />}>
      <Loaded params={params} />
    </Suspense>
  );
}
