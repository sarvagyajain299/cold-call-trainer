"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Group, PrimaryButton, SecondaryText, TextButton } from "@/components/lessons/ui";
import { Practice } from "@/components/lessons/Practice";
import { CallAudioProvider } from "@/components/lessons/ClipButton";
import type { Lesson } from "@/lib/lessons/model";

/** First visit: asks the coach to write the lessons (one Opus call), then shows them. */
export function GenerateLessons({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const run = useCallback(() => {
    setError(null);
    fetch("/api/lessons/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reportId: sessionId }) })
      .then(async (res) => {
        if (res.ok) return router.refresh();
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not write the lessons.");
      })
      .catch(() => setError("Could not reach the server."));
  }, [sessionId, router]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    run();
  }, [run]);

  return (
    <Group className="flex flex-col gap-3" >
      <div aria-live="polite">
        {error ? (
          <>
            <p className="text-[17px]">{error}</p>
            <PrimaryButton className="mt-3" onClick={run}>Try again</PrimaryButton>
          </>
        ) : (
          <>
            <p className="text-[17px] font-semibold">Your coach is turning the call into 3 short lessons…</p>
            <SecondaryText className="mt-1">This takes about a minute, once. After that they open instantly.</SecondaryText>
          </>
        )}
      </div>
    </Group>
  );
}

/** "Skip lesson" or, for a skipped one, "Start anyway". */
export function LessonRowAction({ lesson }: { lesson: Pick<Lesson, "id" | "status" | "sessionId" | "ord"> }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const set = async (status: "skipped" | "in_progress") => {
    setBusy(true);
    await fetch(`/api/lessons/${lesson.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, screen: 0 }) }).catch(() => undefined);
    if (status === "in_progress") router.push(`/lessons/${lesson.sessionId}/${lesson.ord}`);
    else router.refresh();
    setBusy(false);
  };
  if (lesson.status === "done") return null;
  return lesson.status === "skipped" ? (
    <TextButton disabled={busy} onClick={() => set("in_progress")}>Start anyway</TextButton>
  ) : (
    <TextButton disabled={busy} onClick={() => set("skipped")} className="text-ios-label-2">Skip lesson</TextButton>
  );
}

/** A due review: the practice screen on its own. "Done" schedules the next review from today's best try. */
export function ReviewFlow({ lesson, hasAudio }: { lesson: Lesson; hasAudio: boolean }) {
  const router = useRouter();
  const [ids, setIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const done = async () => {
    setBusy(true);
    await fetch(`/api/lessons/${lesson.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reviewDone: ids }) }).catch(() => undefined);
    router.push("/");
  };
  return (
    <CallAudioProvider src={`/api/call/${lesson.sessionId}/call-audio`} available={hasAudio}>
      <Practice lesson={lesson} isReview onAttempt={(a) => a.result && setIds((xs) => (xs.includes(a.id) ? xs : [...xs, a.id]))} />
      <div className="sticky bottom-0 mt-6 bg-ios-bg/95 pt-3 pb-[max(8px,env(safe-area-inset-bottom))]">
        <PrimaryButton onClick={done} disabled={busy}>{ids.length ? "Done" : "Done for today"}</PrimaryButton>
      </div>
    </CallAudioProvider>
  );
}
