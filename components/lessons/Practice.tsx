"use client";

import { Check, Keyboard, Mic, Square, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ClipButton } from "@/components/lessons/ClipButton";
import { Group, PrimaryButton, Quote, SecondaryText, TextButton } from "@/components/lessons/ui";
import { MAX_ATTEMPTS, WPM_TARGET, type Attempt, type Lesson } from "@/lib/lessons/model";

type Phase = "idle" | "recording" | "listening" | "checking" | "done";

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function Feedback({ attempt, modelLine, labels }: { attempt: Attempt; modelLine: string; labels: Record<string, string> }) {
  const [showModel, setShowModel] = useState(false);
  const r = attempt.result;
  if (!r) return null;
  const pace = attempt.wpm;
  const paceNote = pace === null ? null : pace < WPM_TARGET.min ? "a little slow" : pace > WPM_TARGET.max ? "a little fast" : "right on target";
  return (
    <div className="flex flex-col gap-3">
      <p className="lesson-fade-up text-[19px] font-semibold leading-snug">{r.verdict}</p>
      {r.comparedToLast && <p className="lesson-fade-up text-[17px] text-ios-label-2">{r.comparedToLast}</p>}
      <Group className="flex flex-col divide-y divide-ios-sep! p-0">
        {r.checks.map((c, i) => (
          <div key={c.id} className="lesson-fade-up flex items-start gap-3 px-4 py-3" style={{ animationDelay: `${i * 120}ms` }}>
            {c.pass ? (
              <span className="lesson-pop mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ios-green text-black" style={{ animationDelay: `${i * 120 + 80}ms` }}>
                <Check size={16} strokeWidth={3} aria-hidden />
              </span>
            ) : (
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ios-fill text-ios-red-text">
                <X size={16} strokeWidth={3} aria-hidden />
              </span>
            )}
            <span className="flex flex-col">
              <span className="text-[17px] font-medium">
                <span className="sr-only">{c.pass ? "Passed: " : "Not yet: "}</span>
                {labels[c.id] ?? c.id}
              </span>
              <span className="text-[15px] text-ios-label-2">{c.reason}</span>
            </span>
          </div>
        ))}
        {pace !== null && (
          <div className="flex items-center justify-between px-4 py-3 text-[15px]">
            <span>Pace</span>
            <span className="text-ios-label-2">
              {pace} wpm · target {WPM_TARGET.min}–{WPM_TARGET.max} · {paceNote}
            </span>
          </div>
        )}
      </Group>
      <p className="text-[17px] leading-snug">
        <span className="font-semibold">Tip: </span>
        {r.tip}
      </p>
      {showModel ? (
        <Group className="lesson-fade-up">
          <SecondaryText>Model line</SecondaryText>
          <p className="mt-1 text-[17px] font-medium">{modelLine}</p>
        </Group>
      ) : (
        <TextButton className="self-start px-0" onClick={() => setShowModel(true)}>
          Show the model line
        </TextButton>
      )}
    </div>
  );
}

export function Practice({
  lesson,
  isReview = false,
  onAttempt,
}: {
  lesson: Lesson;
  isReview?: boolean;
  onAttempt?: (a: Attempt) => void;
}) {
  const p = lesson.data.practice;
  const labels = Object.fromEntries(p.checks.map((c) => [c.id, c.label]));
  const name = lesson.data.prospectName;

  const [mode, setMode] = useState<"voice" | "typed">("voice");
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [typed, setTyped] = useState("");
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [retry, setRetry] = useState<null | (() => void)>(null);

  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const meter = useRef<HTMLSpanElement | null>(null);
  const stopMeter = useRef<(() => void) | null>(null);

  const latest = attempts[attempts.length - 1];
  const used = attempts.filter((a) => a.result).length;
  const canTry = used < MAX_ATTEMPTS;

  useEffect(() => {
    if (phase !== "recording") return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  // False once this screen is left (or hidden by the router): a recording in progress is dropped, never sent.
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      stopMeter.current?.();
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
    };
  }, []);

  const evaluate = async (body: { transcript: string; mode: "voice" | "typed"; durationSec?: number; speakingSec?: number; audioId?: string }) => {
    setPhase("checking");
    setError(null);
    setRetry(null);
    const attemptNumber = Math.min(MAX_ATTEMPTS, used + 1);
    const previousTranscript = attempts.filter((a) => a.result).at(-1)?.transcript ?? null;
    try {
      const res = await fetch("/api/practice/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId: lesson.id, attemptNumber, isReview, previousTranscript, ...body }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.attempt) {
        const a = data.attempt as Attempt;
        setAttempts((xs) => [...xs.filter((x) => x.id !== a.id), a]);
        onAttempt?.(a);
        if (!a.result) {
          setError(a.error ?? "Couldn't check that one. Try again.");
          setRetry(() => () => void evaluate(body));
          setPhase("idle");
          return;
        }
        setPhase("done");
        return;
      }
      setError(data.error ?? "Couldn't check that one. Try again.");
    } catch {
      setError("Couldn't check that one. Try again.");
    }
    setRetry(() => () => void evaluate(body));
    setPhase("idle");
  };

  const start = async () => {
    setError(null);
    setNotice(null);
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setMode("typed");
      setNotice("This browser can't record here, so type your answer instead.");
      return;
    }
    let s: MediaStream;
    try {
      s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true } });
    } catch {
      setMode("typed");
      setNotice("The microphone is blocked, so type your answer instead. You can allow the mic in the browser later.");
      return;
    }
    if (!active.current) {
      s.getTracks().forEach((t) => t.stop()); // permission came after the user left this screen
      return;
    }
    stream.current = s;
    const chunks: Blob[] = [];
    const type = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "";
    const rec = new MediaRecorder(s, type ? { mimeType: type } : undefined);
    rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    rec.onstop = () => active.current && void send(new Blob(chunks, { type: rec.mimeType || "audio/webm" }));
    rec.start(250);
    recorder.current = rec;

    // Live level meter, drawn straight to the DOM so it does not re-render every frame.
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    ctx.createMediaStreamSource(s).connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    let raf = 0;
    const draw = () => {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += v * v;
      const level = Math.min(1, Math.sqrt(sum / buf.length) * 6);
      if (meter.current) meter.current.style.transform = `scaleX(${level.toFixed(3)})`;
      raf = requestAnimationFrame(draw);
    };
    draw();
    stopMeter.current = () => {
      cancelAnimationFrame(raf);
      void ctx.close();
    };

    setSeconds(0);
    setPhase("recording");
  };

  const stop = () => {
    stopMeter.current?.();
    stopMeter.current = null;
    recorder.current?.stop();
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setPhase("listening");
  };

  const send = async (blob: Blob) => {
    try {
      const res = await fetch("/api/practice/transcribe", { method: "POST", headers: { "Content-Type": blob.type || "audio/webm" }, body: blob });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't hear that one. Try again, or type it.");
      if (!data.transcript?.trim()) {
        setError("I didn't catch any words. Try again a little closer to the mic, or type it.");
        setPhase("idle");
        return;
      }
      await evaluate({ transcript: data.transcript, mode: "voice", durationSec: data.durationSec, speakingSec: data.speakingSec, audioId: data.audioId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't hear that one. Try again, or type it.");
      setPhase("idle");
    }
  };

  const busy = phase === "listening" || phase === "checking";

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-[28px] font-bold leading-tight tracking-tight">Your turn. Answer {name} out loud.</h2>
      <Group className="flex flex-col gap-3">
        <Quote who={name}>{p.prospectQuestion}</Quote>
        <div>
          <ClipButton clip={p.clip} label={`${name}'s question`} />
        </div>
      </Group>

      {phase !== "done" && canTry && (
        <div className="flex flex-col items-center gap-3">
          {mode === "voice" ? (
            <>
              <button
                type="button"
                onClick={phase === "recording" ? stop : start}
                disabled={busy}
                aria-label={phase === "recording" ? "Stop recording" : "Start recording your answer"}
                className={`flex h-20 w-20 items-center justify-center rounded-full text-white disabled:opacity-50 ${phase === "recording" ? "mic-pulse bg-[#ff3b30]" : "bg-ios-blue-fill"}`}
              >
                {phase === "recording" ? <Square size={28} fill="currentColor" aria-hidden /> : <Mic size={34} aria-hidden />}
              </button>
              {phase === "recording" ? (
                <div className="flex w-full max-w-[240px] flex-col items-center gap-2">
                  <span className="relative block h-1.5 w-full overflow-hidden rounded-full bg-ios-fill" aria-hidden>
                    <span ref={meter} className="absolute inset-0 origin-left rounded-full bg-ios-green" style={{ transform: "scaleX(0)" }} />
                  </span>
                  <span className="text-[15px] tabular-nums text-ios-label-2">{fmt(seconds)} · tap to stop</span>
                </div>
              ) : (
                <SecondaryText>{busy ? "" : used ? "Tap to try again" : "Tap and speak your answer"}</SecondaryText>
              )}
              {!busy && phase !== "recording" && (
                <TextButton onClick={() => setMode("typed")}>
                  <Keyboard size={18} aria-hidden className="mr-1.5" /> Type instead
                </TextButton>
              )}
            </>
          ) : (
            <form
              className="flex w-full flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (typed.trim()) void evaluate({ transcript: typed.trim(), mode: "typed" });
              }}
            >
              <label htmlFor="typed-answer" className="text-[15px] text-ios-label-2">Type exactly what you would say</label>
              <textarea
                id="typed-answer"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                rows={3}
                className="w-full rounded-[12px] border border-ios-sep! bg-ios-surface px-3 py-2 text-[17px]"
              />
              <div className="flex items-center justify-between gap-2">
                <PrimaryButton type="submit" disabled={busy || !typed.trim()} className="sm:min-w-0">Check my answer</PrimaryButton>
                {typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && (
                  <TextButton onClick={() => setMode("voice")}>
                    <Mic size={18} aria-hidden className="mr-1.5" /> Speak instead
                  </TextButton>
                )}
              </div>
            </form>
          )}
        </div>
      )}

      <div aria-live="polite" className="flex flex-col gap-3">
        {notice && <SecondaryText>{notice}</SecondaryText>}
        {phase === "listening" && <p className="text-[17px] text-ios-label-2">Listening…</p>}
        {phase === "checking" && <p className="text-[17px] text-ios-label-2">Checking…</p>}
        {error && (
          <div className="flex items-center gap-3">
            <p className="text-[17px]">{error}</p>
            {retry && <TextButton onClick={retry}>Try again</TextButton>}
          </div>
        )}
        {latest?.result && phase === "done" && (
          <>
            <Group className="flex flex-col gap-1">
              <SecondaryText>You said{latest.mode === "typed" ? " (typed)" : ""}</SecondaryText>
              <p className="call-quote text-[17px]">“{latest.transcript}”</p>
            </Group>
            <Feedback attempt={latest} modelLine={p.modelLine} labels={labels} />
            {canTry ? (
              <TextButton className="self-start px-0" onClick={() => { setTyped(""); setPhase("idle"); }}>
                Try again ({MAX_ATTEMPTS - used} left)
              </TextButton>
            ) : (
              <SecondaryText>That&apos;s all {MAX_ATTEMPTS} tries for now.</SecondaryText>
            )}
          </>
        )}
      </div>
    </div>
  );
}
