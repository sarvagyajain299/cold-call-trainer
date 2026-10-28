"use client";

import { useRef, type ReactNode } from "react";
import type { StoredReport } from "@/lib/scoring";
import { redoCall } from "@/lib/actions";

const OUTCOMES: Record<string, string> = {
  meeting_booked: "Meeting booked",
  callback_agreed: "Callback agreed",
  info_requested: "Asked you to send information",
  brushed_off: "Brushed off",
  hung_up: "Prospect hung up",
  ended_neutral: "Ended neutrally",
};

const STAGES: Record<string, string> = {
  opener: "Opener",
  reason_for_call: "Reason for the call",
  discovery: "Discovery",
  value_pitch: "Value pitch",
  objection_handling: "Objection handling",
  close: "Close / next step",
};

const mmss = (secs: number) => `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, "0")}`;

function tone10(n: number) {
  if (n >= 7) return "text-green-600 dark:text-green-400";
  if (n >= 4) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function bar10(n: number) {
  if (n >= 7) return "bg-green-500";
  if (n >= 4) return "bg-amber-500";
  return "bg-red-500";
}

function Section({ title, children, hint }: { title: string; children: ReactNode; hint?: string }) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {hint && <p className="text-sm text-zinc-500">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function ScoreBar({ label, score, note }: { label: string; score: number; note?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className={`tabular-nums ${tone10(score)}`}>{score}/10</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div className={`h-1.5 rounded-full ${bar10(score)}`} style={{ width: `${score * 10}%` }} />
      </div>
      {note && <p className="text-sm text-zinc-600 dark:text-zinc-400">{note}</p>}
    </div>
  );
}

export function ReportView({
  sessionId,
  projectName,
  callGoal,
  report,
}: {
  sessionId: string;
  projectName: string;
  callGoal: string;
  report: StoredReport;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const { analysis: a, meta, metrics } = report;

  const seek = (secs: number) => {
    const el = audio.current;
    if (!el) return;
    el.currentTime = Math.max(0, secs - 1);
    void el.play();
  };

  const Play = ({ at }: { at: number }) =>
    report.hasRecording ? (
      <button
        onClick={() => seek(at)}
        className="rounded-full border px-2 py-0.5 text-xs tabular-nums hover:bg-zinc-100 dark:hover:bg-zinc-900"
        aria-label={`Play your recording from ${mmss(at)}`}
      >
        ▶ {mmss(at)}
      </button>
    ) : (
      <span className="text-xs tabular-nums text-zinc-500">{mmss(at)}</span>
    );

  return (
    <article className="flex flex-col gap-10">
      <header className="flex flex-col gap-4">
        <div>
          <p className="text-sm text-zinc-500">{projectName} · goal: {callGoal}</p>
          <h1 className="mt-1 text-xl font-semibold leading-snug">{a.headline}</h1>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg border p-3">
            <p className={`text-3xl font-semibold tabular-nums ${tone10(a.overallRating)}`}>{a.overallRating}</p>
            <p className="text-xs text-zinc-500">Rating out of 10</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className={`text-3xl font-semibold tabular-nums ${tone10(a.conversionScore / 10)}`}>{a.conversionScore}%</p>
            <p className="text-xs text-zinc-500">Chance of reaching the goal</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-base font-semibold leading-tight">{OUTCOMES[a.outcome] ?? a.outcome}</p>
            <p className="mt-1 text-xs text-zinc-500">{mmss(meta.durationSecs)} · you spoke {Math.round(meta.traineeWordShare * 100)}% of the words</p>
          </div>
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{a.conversionReasoning}</p>
        {report.hasRecording && (
          <div>
            <p className="mb-1 text-xs text-zinc-500">Your side of the call. Press ▶ next to any moment below to hear it.</p>
            <audio ref={audio} controls preload="none" src={`/api/call/${sessionId}/audio`} className="w-full" />
          </div>
        )}
      </header>

      <section className="rounded-lg border-2 border-foreground p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Focus for your next call</p>
        <p className="mt-1 text-base font-medium">{a.focusNextCall}</p>
        <form action={redoCall.bind(null, sessionId)} className="mt-3">
          <button className="rounded-full bg-foreground px-4 py-1.5 text-sm text-background">
            Call {report.persona.name.split(" ")[0]} again
          </button>
          <p className="mt-1 text-xs text-zinc-500">Same person, same mood and situation. They will not remember this call.</p>
        </form>
      </section>

      <Section title="What worked">
        <ul className="flex flex-col gap-2 text-sm">
          {a.wins.map((w, i) => (
            <li key={i} className="rounded-lg border border-green-300 p-3 dark:border-green-900">{w}</li>
          ))}
        </ul>
      </Section>

      <Section title="Fix these first" hint="In order of impact.">
        <ol className="flex flex-col gap-3">
          {a.topFixes.map((f, i) => (
            <li key={i} className="rounded-lg border p-4 text-sm">
              <p className="font-semibold">{i + 1}. {f.fix}</p>
              <p className="mt-1 text-zinc-600 dark:text-zinc-400">{f.why}</p>
              <p className="mt-2"><span className="font-medium">Practice: </span>{f.howToPractice}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Stage by stage">
        <div className="flex flex-col gap-4">
          {a.stages.map((s) => (
            <ScoreBar key={s.stage} label={STAGES[s.stage] ?? s.stage} score={s.score} note={s.comment} />
          ))}
          <ScoreBar label="Clarity of the goal" score={a.goalClarity.score} note={a.goalClarity.comment} />
          <ScoreBar label="Call control" score={a.callControl.score} note={a.callControl.comment} />
        </div>
      </Section>

      <Section title="Key moments" hint="Words are quoted exactly from the transcript.">
        <ul className="flex flex-col gap-3">
          {a.moments.map((m, i) => (
            <li key={i} className={`rounded-lg border p-3 text-sm ${m.kind === "win" ? "border-green-300 dark:border-green-900" : "border-red-300 dark:border-red-900"}`}>
              <div className="flex items-center gap-2">
                <Play at={m.timeSecs} />
                <span className="text-xs font-semibold uppercase">{m.kind === "win" ? "Win" : "Miss"}</span>
                <span className="text-xs text-zinc-500">{m.speaker === "trainee" ? "You" : "Prospect"}</span>
              </div>
              <p className="mt-2 italic">“{m.quote}”</p>
              <p className="mt-1">{m.what}</p>
              <p className="mt-1 text-zinc-600 dark:text-zinc-400">{m.why}</p>
              {m.betterLine && (
                <p className="mt-2 rounded bg-zinc-100 p-2 dark:bg-zinc-900"><span className="font-medium">A top closer would say: </span>{m.betterLine}</p>
              )}
            </li>
          ))}
        </ul>
      </Section>

      {a.objections.length > 0 && (
        <Section title="How you handled objections">
          <ul className="flex flex-col gap-3">
            {a.objections.map((o, i) => (
              <li key={i} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <Play at={o.timeSecs} />
                  <span className={`tabular-nums ${tone10(o.score)}`}>{o.score}/10</span>
                </div>
                <p className="mt-2 italic">“{o.quote}” <span className="not-italic text-xs text-zinc-500">{o.realObjection ? "(real objection)" : "(reflex brush-off)"}</span></p>
                <p className="mt-1">{o.howHandled}</p>
                <p className="mt-2 rounded bg-zinc-100 p-2 dark:bg-zinc-900"><span className="font-medium">Better: </span>{o.betterResponse}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {a.missedSignals.length > 0 && (
        <Section title="Signals you missed" hint="Moments the prospect handed you an opening.">
          <ul className="flex flex-col gap-3">
            {a.missedSignals.map((s, i) => (
              <li key={i} className="rounded-lg border p-3 text-sm">
                <Play at={s.timeSecs} />
                <p className="mt-2 italic">“{s.quote}”</p>
                <p className="mt-1">{s.meaning}</p>
                <p className="mt-1 text-zinc-600 dark:text-zinc-400"><span className="font-medium">Do this: </span>{s.whatToDo}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Your voice" hint="Measured from your recording and your microphone, then explained by the coach.">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {(
            [
              ["Energy", a.voice.energy],
              ["Confidence", a.voice.confidence],
              ["Warmth", a.voice.warmth],
              ["Clarity", a.voice.clarity],
            ] as const
          ).map(([label, v]) => (
            <ScoreBar key={label} label={label} score={v} />
          ))}
        </div>
        <p className="text-sm">{a.voice.summary}</p>
        {a.voice.issues.length > 0 && (
          <ul className="flex flex-col gap-2 text-sm">
            {a.voice.issues.map((v, i) => (
              <li key={i} className="flex items-start gap-2"><Play at={v.timeSecs} /><span>{v.note}</span></li>
            ))}
          </ul>
        )}
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg border p-3 text-sm sm:grid-cols-3">
          {metrics.speech && (
            <>
              <div><dt className="text-xs text-zinc-500">Pace</dt><dd>{metrics.speech.wpm} words/min</dd></div>
              <div><dt className="text-xs text-zinc-500">Words understood clearly</dt><dd>{Math.round((1 - metrics.speech.lowConfidenceShare) * 100)}%</dd></div>
              <div><dt className="text-xs text-zinc-500">Fillers (um, uh)</dt><dd>{metrics.speech.fillerCount}</dd></div>
              <div><dt className="text-xs text-zinc-500">Longest stretch without a break</dt><dd>{metrics.speech.longestRunSecs}s</dd></div>
            </>
          )}
          {metrics.voice && metrics.voice.sentences > 0 && (
            <>
              <div><dt className="text-xs text-zinc-500">Flatness (lower is livelier)</dt><dd>{metrics.voice.monotoneScore}/100</dd></div>
              <div><dt className="text-xs text-zinc-500">Sentences that trail off</dt><dd>{Math.round(metrics.voice.trailingOffShare * 100)}%</dd></div>
              <div><dt className="text-xs text-zinc-500">Sentences ending on a rise</dt><dd>{Math.round(metrics.voice.risingEndShare * 100)}%</dd></div>
            </>
          )}
          {!metrics.voice && <div className="col-span-full text-xs text-zinc-500">Pitch and loudness readings were not captured on this call.</div>}
        </dl>
      </Section>

      <Section title="Fit for your audience">
        <ScoreBar label="Cultural fit" score={a.culturalFit.score} />
        <ul className="list-disc pl-5 text-sm">
          {a.culturalFit.notes.map((n, i) => <li key={i}>{n}</li>)}
        </ul>
      </Section>

      {a.selfReviewFeedback && (
        <Section title="Your own review vs. reality">
          {report.selfReview && <p className="rounded-lg bg-zinc-100 p-3 text-sm italic dark:bg-zinc-900">“{report.selfReview}”</p>}
          <p className="text-sm">{a.selfReviewFeedback}</p>
        </Section>
      )}

      <Section title="Who you were really talking to" hint="Hidden until now.">
        <div className="rounded-lg border p-4 text-sm">
          <p className="font-semibold">{report.persona.name}, {report.persona.role} · {report.persona.city}</p>
          <p className="mt-1">{a.personaReveal.whoTheyWere}</p>
          <ul className="mt-3 flex flex-col gap-2">
            {a.personaReveal.feelings.map((f, i) => (
              <li key={i} className="flex items-start gap-2">
                <Play at={f.timeSecs} />
                <span><span className="font-medium">{f.feeling}.</span> {f.why}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 rounded bg-zinc-100 p-2 dark:bg-zinc-900"><span className="font-medium">The hidden truth: </span>{a.personaReveal.hiddenTruth}</p>
        </div>
      </Section>

      <Section title="Transcript">
        <details className="rounded-lg border p-3 text-sm">
          <summary className="cursor-pointer font-medium">Show the full transcript</summary>
          <ul className="mt-3 flex flex-col gap-2">
            {report.transcript.map((t, i) => (
              <li key={i} className="flex items-start gap-2">
                <Play at={t.t} />
                <span>
                  <span className="font-medium">{t.role === "trainee" ? "You" : report.persona.name.split(" ")[0]}: </span>
                  {t.text}
                  {t.cues.length > 0 && <span className="text-zinc-500"> ({t.cues.join(", ")})</span>}
                </span>
              </li>
            ))}
          </ul>
        </details>
        {meta.droppedQuotes > 0 && (
          <p className="text-xs text-zinc-500">{meta.droppedQuotes} coach comment(s) were removed because their quotes could not be found in the transcript.</p>
        )}
      </Section>
    </article>
  );
}
