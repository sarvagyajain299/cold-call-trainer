"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { redoWithCue } from "@/lib/actions";
import { CallAudioProvider } from "@/components/lessons/ClipButton";
import { Practice } from "@/components/lessons/Practice";
import { Choose, FindIt, GutCheck, RuleScreen } from "@/components/lessons/screens";
import { Group, PrimaryButton, SecondaryText, TextButton } from "@/components/lessons/ui";
import { cueLine, type Attempt, type FeelingStep, type Lane, type Lesson } from "@/lib/lessons/model";
type ScreenId = "gut" | "find" | "choose" | "rule" | "practice" | "cue";

const patch = (id: string, body: Record<string, unknown>) =>
  fetch(`/api/lessons/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => undefined);

export function LessonFlow({
  lesson,
  lanes,
  steps,
  texts,
  duration,
  hasAudio,
  pastAttempts,
  totalLessons,
}: {
  lesson: Lesson;
  lanes: Lane[];
  steps: FeelingStep[];
  texts: string[];
  duration: number;
  hasAudio: boolean;
  pastAttempts: Attempt[];
  totalLessons: number;
}) {
  const router = useRouter();
  const screens: ScreenId[] = [...(lesson.data.gutCheck ? (["gut"] as const) : []), "find", "choose", "rule", "practice", "cue"];
  const home = `/lessons/${lesson.sessionId}`;
  const isLast = lesson.ord >= totalLessons;
  const next = isLast ? `/report/${lesson.sessionId}` : `/lessons/${lesson.sessionId}/${lesson.ord + 1}`;
  const name = lesson.data.prospectName;

  const [idx, setIdx] = useState(Math.min(Math.max(0, lesson.screen), screens.length - 1));
  const [dir, setDir] = useState<"next" | "prev">("next");
  // A finished lesson can be browsed freely; otherwise "ask before telling" holds the button until you answer.
  const [solved, setSolved] = useState<Set<ScreenId>>(() => new Set(lesson.status === "done" ? screens : idx > 0 ? screens.slice(0, idx) : []));
  const [gutPick, setGutPick] = useState<string | null>(lesson.gutPick);
  const [attempts, setAttempts] = useState<Attempt[]>(pastAttempts);
  const [leaving, setLeaving] = useState(false);

  const id = screens[idx];
  const gated = id === "find" || id === "choose" || (id === "gut" && lesson.data.gutCheck?.mode === "pick") || id === "practice";
  const ready = !gated || solved.has(id);

  useEffect(() => {
    if (lesson.status === "not_started") void patch(lesson.id, { status: "in_progress" });
  }, [lesson.id, lesson.status]);

  const solve = useCallback((s: ScreenId) => setSolved((cur) => (cur.has(s) ? cur : new Set(cur).add(s))), []);

  const go = useCallback(
    (to: number) => {
      if (to < 0 || to >= screens.length) return;
      setDir(to > idx ? "next" : "prev");
      setIdx(to);
      void patch(lesson.id, { screen: to });
      window.scrollTo({ top: 0 });
    },
    [idx, screens.length, lesson.id],
  );

  const forward = useCallback(() => {
    if (ready) go(idx + 1);
  }, [ready, go, idx]);

  const skip = () => {
    void patch(lesson.id, { skippedScreen: idx });
    solve(id);
    go(idx + 1);
  };

  const finish = async () => {
    setLeaving(true);
    await patch(lesson.id, { status: "done", screen: idx });
    router.push(next);
  };

  // ← → on desktop (not while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT" || t.isContentEditable)) return;
      if (e.key === "ArrowRight" && idx < screens.length - 1) forward();
      if (e.key === "ArrowLeft") go(idx - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [forward, go, idx, screens.length]);

  // Swipe on touch: a clear horizontal flick of 60px or more.
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") touch.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const s = touch.current;
    touch.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0 && idx < screens.length - 1) forward();
    if (dx > 0) go(idx - 1);
  };

  const label: Record<ScreenId, string> = {
    gut: "Let's find out why",
    find: "Continue",
    choose: "Continue",
    rule: "Got it",
    practice: "Continue",
    cue: isLast ? "See full report" : "Next lesson",
  };

  const line = cueLine(lesson.data.cueCard.line, attempts);

  return (
    <CallAudioProvider src={`/api/call/${lesson.sessionId}/call-audio`} available={hasAudio}>
      <div className="lessons flex min-h-dvh flex-col">
        <header className="sticky top-0 z-10 bg-ios-bg/95 backdrop-blur-sm">
          <div className="mx-auto flex w-full max-w-[560px] items-center gap-3 px-4 pr-32 pt-[max(12px,env(safe-area-inset-top))] pb-3 lg:pr-4">
            <Link href={home} aria-label="Close lesson" className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-ios-fill">
              <X size={20} aria-hidden />
            </Link>
            <ol className="flex flex-1 justify-center gap-2" aria-label={`Lesson ${lesson.ord}, screen ${idx + 1} of ${screens.length}`}>
              {screens.map((s, i) => (
                <li
                  key={s}
                  aria-current={i === idx ? "step" : undefined}
                  className={`h-2 rounded-full transition-transform duration-300 ${i === idx ? "w-6 bg-ios-blue" : i < idx ? "w-2 bg-ios-label-2" : "w-2 bg-ios-sep"}`}
                />
              ))}
            </ol>
            <span className="w-11 text-right text-[13px] text-ios-label-2">{lesson.ord}/{totalLessons}</span>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-[560px] flex-1 flex-col px-4 pb-6" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
          <p className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-ios-label-2">{lesson.title}</p>
          <section key={id} className={`flex-1 ${dir === "next" ? "lesson-in-next" : "lesson-in-prev"}`}>
            {id === "gut" && lesson.data.gutCheck && (
              <GutCheck
                gut={lesson.data.gutCheck}
                prospectName={name}
                pick={gutPick}
                onPick={(p) => {
                  setGutPick(p);
                  solve("gut");
                  void patch(lesson.id, { gutPick: p });
                }}
              />
            )}
            {id === "find" && <FindIt lesson={lesson} lanes={lanes} steps={steps} texts={texts} duration={duration} solved={solved.has("find")} onSolved={() => solve("find")} />}
            {id === "choose" && <Choose lesson={lesson} solved={solved.has("choose")} onSolved={() => solve("choose")} />}
            {id === "rule" && <RuleScreen lesson={lesson} />}
            {id === "practice" && (
              <Practice
                lesson={lesson}
                onAttempt={(a) => {
                  setAttempts((xs) => [...xs.filter((x) => x.id !== a.id), a]);
                  if (a.result) solve("practice");
                }}
              />
            )}
            {id === "cue" && (
              <div className="flex flex-col gap-6">
                <h2 className="text-[28px] font-bold leading-tight tracking-tight">Take it with you.</h2>
                <Group className="flex flex-col gap-3 border border-ios-sep! py-6">
                  <p className="text-[13px] font-semibold uppercase tracking-wide text-ios-label-2">{lesson.data.cueCard.label}</p>
                  <p className="text-[24px] font-semibold leading-snug">{line}</p>
                  <SecondaryText>{line === lesson.data.cueCard.line ? "The model line" : "Your own best answer"} · {lesson.rule}</SecondaryText>
                </Group>
                <form action={redoWithCue.bind(null, lesson.sessionId, lesson.id)}>
                  <button type="submit" className="inline-flex min-h-[50px] w-full items-center justify-center rounded-full border border-ios-blue! px-6 text-[17px] font-semibold text-ios-blue sm:w-auto">
                    Try it on {name} again
                  </button>
                </form>
                <SecondaryText>Starts the same call again, with this card pinned on your script.</SecondaryText>
              </div>
            )}
          </section>

          <footer className="sticky bottom-0 mt-6 flex flex-col items-center gap-1 bg-ios-bg/95 pt-3 pb-[max(8px,env(safe-area-inset-bottom))] backdrop-blur-sm sm:flex-row-reverse sm:justify-between">
            {id === "cue" ? (
              <PrimaryButton onClick={finish} disabled={leaving}>{leaving ? "Opening…" : label.cue}</PrimaryButton>
            ) : (
              <PrimaryButton onClick={forward} disabled={!ready}>{label[id]}</PrimaryButton>
            )}
            <div className="flex gap-2">
              {idx > 0 && <TextButton onClick={() => go(idx - 1)}>Back</TextButton>}
              {id !== "cue" && !ready && <TextButton onClick={skip}>Skip</TextButton>}
            </div>
          </footer>
        </main>
      </div>
    </CallAudioProvider>
  );
}
