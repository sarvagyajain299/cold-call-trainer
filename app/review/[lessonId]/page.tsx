import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { X } from "lucide-react";
import { hasCallAudio } from "@/lib/callAudio";
import { getLesson } from "@/lib/lessons/store";
import { ReviewFlow } from "@/components/lessons/HomeParts";

async function Loaded({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;
  await connection();
  const lesson = getLesson(lessonId);
  if (!lesson) notFound();
  return (
    <>
      <p className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-ios-label-2">Review · {lesson.title}</p>
      <p className="mb-4 text-[17px] text-ios-label-2">{lesson.rule}</p>
      <ReviewFlow lesson={lesson} hasAudio={await hasCallAudio(lesson.sessionId)} />
    </>
  );
}

export default function ReviewPage({ params }: { params: Promise<{ lessonId: string }> }) {
  return (
    <div className="lessons min-h-dvh">
      <header className="mx-auto flex w-full max-w-[560px] px-4 pt-[max(12px,env(safe-area-inset-top))] pb-2">
        <Link href="/" aria-label="Close review" className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-ios-fill">
          <X size={20} aria-hidden />
        </Link>
      </header>
      <main className="mx-auto w-full max-w-[560px] px-4 pb-6">
        <Suspense fallback={null}>
          <Loaded params={params} />
        </Suspense>
      </main>
    </div>
  );
}
