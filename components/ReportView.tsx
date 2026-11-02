"use client";

import { useRef, useState, type ReactNode } from "react";
import type { StoredReport } from "@/lib/scoring";
import { redoCall } from "@/lib/actions";
import { HABITS } from "@/lib/habits";
import {
  buildTimeline,
  firstSentence,
  gotTheAsk,
  scoreboardSummary,
  timelineCounts,
  TYPE_LABEL,
  type TimelineType,
} from "@/lib/timeline";

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

const TYPE_STYLE: Record<TimelineType, string> = {
  win: "border-green-300 dark:border-green-900",
  miss: "border-red-300 dark:border-red-900",
  objection: "border-amber-300 dark:border-amber-900",
  signal: "border-blue-300 dark:border-blue-900",
  voice: "border-purple-300 dark:border-purple-900",
  feeling: "border-zinc-300 dark:border-zinc-700",
};

const CHIPS: { type: TimelineType; label: string }[] = [
  { type: "win", label: "Wins" },
  { type: "miss", label: "Misses" },
  { type: "objection", label: "Objections" },
  { type: "signal", label: "Signals" },
  { type: "voice", label: "Voice" },
  { type: "feeling", label: "Feelings" },
];

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

/** Long text, structured: the first sentence is bold, the rest follows. Nothing is cut. */
function Para({ text, className = "" }: { text: string; className?: string }) {
  const lead = firstSentence(text);
  const isWhole = lead.length >= text.trim().length || lead.endsWith("...");
  const rest = isWhole ? "" : text.trim().slice(lead.length).trim();
  return (
    <p className={`text-sm leading-relaxed ${className}`}>
      <span className="font-semibold">{isWhole ? text : lead}</span>
      {rest && <> {rest}</>}
    </p>
  );
}

function Labelled({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <Para text={text} />
    </div>
  );
}

function Accordion({
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  title: string;
  summary?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 p-4 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900"
      >
        <span className="min-w-0">
          <span className="block text-base font-semibold">{title}</span>
          {summary && <span className="mt-0.5 block text-sm text-zinc-500">{summary}</span>}
        </span>
        <span aria-hidden className="mt-1 shrink-0 text-zinc-500">{open ? "▲" : "▼"}</span>
      </button>
      {open && <div className="flex flex-col gap-4 border-t p-4">{children}</div>}
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
      {note && <Para text={note} className="text-zinc-600 dark:text-zinc-400" />}
    </div>
  );
}

const SECTION_IDS = ["worked", "fixes", "timeline", "scores", "voice", "self", "who", "transcript"] as const;

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
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [filters, setFilters] = useState<Set<TimelineType>>(new Set(CHIPS.map((c) => c.type)));
  const [openRows, setOpenRows] = useState<Set<string>>(new Set());
  const [showWhy, setShowWhy] = useState(false);

  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));
  const allOpen = SECTION_IDS.every((id) => open[id]);
  const setAll = (v: boolean) => setOpen(Object.fromEntries(SECTION_IDS.map((id) => [id, v])));

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
        className="shrink-0 rounded-full border px-2 py-0.5 text-xs tabular-nums hover:bg-zinc-100 dark:hover:bg-zinc-900"
        aria-label={`Play your recording from ${mmss(at)}`}
      >
        ▶ {mmss(at)}
      </button>
    ) : (
      <span className="shrink-0 text-xs tabular-nums text-zinc-500">{mmss(at)}</span>
    );

  const timeline = buildTimeline(a);
  const counts = timelineCounts(timeline);
  const shown = timeline.filter((t) => filters.has(t.type));
  const toggleFilter = (t: TimelineType) =>
    setFilters((f) => {
      const n = new Set(f);
      if (n.has(t)) n.delete(t);
      else n.add(t);
      return n;
    });
  const toggleRow = (id: string) =>
    setOpenRows((r) => {
      const n = new Set(r);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const ask = gotTheAsk(a.outcome);
  const askStyle = ask === "Yes" ? "text-green-600 dark:text-green-400" : ask === "Partly" ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";

  const voiceBits = [
    `energy ${a.voice.energy}/10`,
    metrics.speech ? `pace ${metrics.speech.wpm} wpm` : null,
    metrics.speech ? `${Math.round((1 - metrics.speech.lowConfidenceShare) * 100)}% words clear` : null,
    metrics.speech ? `${metrics.speech.fillerCount} fillers` : null,
  ].filter(Boolean);

  return (
    <article className="flex flex-col gap-4">
      {/* DEBRIEF: always visible */}
      <header className="flex flex-col gap-4">
        <div>
          <p className="text-sm text-zinc-500">{projectName} · goal: {callGoal}</p>
          <h1 className="mt-1 text-xl font-semibold leading-snug">{a.headline}</h1>
        </div>
        <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
          <div className="rounded-lg border p-3">
            <p className={`text-3xl font-semibold tabular-nums ${tone10(a.overallRating)}`}>{a.overallRating}</p>
            <p className="text-xs text-zinc-500">Rating out of 10</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className={`text-3xl font-semibold ${askStyle}`}>{ask}</p>
            <p className="text-xs text-zinc-500">Got the ask?</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className={`text-3xl font-semibold tabular-nums ${tone10(a.conversionScore / 10)}`}>{a.conversionScore}%</p>
            <p className="text-xs text-zinc-500">Estimated chance of reaching the goal</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-base font-semibold leading-tight">{OUTCOMES[a.outcome] ?? a.outcome}</p>
            <p className="mt-1 text-xs text-zinc-500">{mmss(meta.durationSecs)} · you spoke {Math.round(meta.traineeWordShare * 100)}% of the words</p>
          </div>
        </div>
        <div>
          <button onClick={() => setShowWhy((v) => !v)} aria-expanded={showWhy} className="text-sm underline">
            {showWhy ? "Hide" : "Why this chance?"}
          </button>
          {showWhy && <Para text={a.conversionReasoning} className="mt-2 text-zinc-700 dark:text-zinc-300" />}
        </div>
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

      {report.hasRecording && (
        <div>
          <p className="mb-1 text-xs text-zinc-500">Your side of the call. Press ▶ next to any moment below to hear it.</p>
          <audio ref={audio} controls preload="none" src={`/api/call/${sessionId}/audio`} className="w-full" />
        </div>
      )}

      <div className="flex justify-end">
        <button onClick={() => setAll(!allOpen)} className="text-sm underline">
          {allOpen ? "Collapse all" : "Expand all"}
        </button>
      </div>

      <Accordion
        title={`What worked (${a.wins.length})`}
        summary={a.wins[0] ? firstSentence(a.wins[0]) : undefined}
        open={!!open.worked}
        onToggle={() => toggle("worked")}
      >
        <ul className="flex flex-col gap-2">
          {a.wins.map((w, i) => (
            <li key={i} className="rounded-lg border border-green-300 p-3 dark:border-green-900"><Para text={w} /></li>
          ))}
        </ul>
      </Accordion>

      <Accordion
        title={`Fix these first (${a.topFixes.length})`}
        summary={a.topFixes.map((f, i) => `${i + 1}. ${(f as { oneLine?: string }).oneLine?.trim() || firstSentence(f.fix)}`).join("  ")}
        open={!!open.fixes}
        onToggle={() => toggle("fixes")}
      >
        <ol className="flex flex-col gap-3">
          {a.topFixes.map((f, i) => {
            const tag = (f as { tag?: string }).tag;
            return (
              <li key={i} className="flex flex-col gap-3 rounded-lg border p-4">
                <p className="text-sm font-semibold">
                  {i + 1}. {f.fix}
                  {tag && HABITS[tag] && <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-normal dark:bg-zinc-800">{HABITS[tag]}</span>}
                </p>
                <Labelled label="Why it matters" text={f.why} />
                <Labelled label="Practice this" text={f.howToPractice} />
              </li>
            );
          })}
        </ol>
      </Accordion>

      <Accordion
        title={`Call timeline (${timeline.length})`}
        summary={CHIPS.filter((c) => counts[c.type]).map((c) => `${counts[c.type]} ${c.label.toLowerCase()}`).join(" · ")}
        open={!!open.timeline}
        onToggle={() => toggle("timeline")}
      >
        <p className="text-xs text-zinc-500">Everything that happened, in order. Words are quoted exactly from the transcript.</p>
        <div className="flex flex-wrap gap-2">
          {CHIPS.filter((c) => counts[c.type]).map((c) => {
            const on = filters.has(c.type);
            return (
              <button
                key={c.type}
                onClick={() => toggleFilter(c.type)}
                aria-pressed={on}
                className={`rounded-full border px-3 py-1 text-xs ${on ? "bg-foreground text-background" : "text-zinc-500"}`}
              >
                {c.label} {counts[c.type]}
              </button>
            );
          })}
        </div>
        <ul className="flex flex-col gap-2">
          {shown.map((t) => {
            const isOpen = openRows.has(t.id);
            const hasMore = !!t.quote || t.detail.length > 0 || !!t.better;
            return (
              <li key={t.id} className={`rounded-lg border p-3 text-sm ${TYPE_STYLE[t.type]}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <Play at={t.timeSecs} />
                  <span className="text-xs font-semibold uppercase">{TYPE_LABEL[t.type]}</span>
                  {t.tag && HABITS[t.tag] && <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800">{HABITS[t.tag]}</span>}
                  {t.score !== undefined && <span className={`text-xs tabular-nums ${tone10(t.score)}`}>{t.score}/10</span>}
                  {t.note && <span className="text-xs text-zinc-500">({t.note})</span>}
                </div>
                {hasMore ? (
                  <button onClick={() => toggleRow(t.id)} aria-expanded={isOpen} className="mt-2 flex w-full items-start justify-between gap-2 text-left">
                    <span>{t.oneLine}</span>
                    <span aria-hidden className="shrink-0 text-zinc-500">{isOpen ? "▲" : "▼"}</span>
                  </button>
                ) : (
                  <p className="mt-2">{t.oneLine}</p>
                )}
                {isOpen && (
                  <div className="mt-3 flex flex-col gap-3 border-t pt-3">
                    {t.quote && (
                      <p className="italic">
                        “{t.quote}” <span className="not-italic text-xs text-zinc-500">{t.speaker === "trainee" ? "You" : report.persona.name.split(" ")[0]}</span>
                      </p>
                    )}
                    {t.detail.map((d) => <Labelled key={d.label} label={d.label} text={d.text} />)}
                    {t.better && (
                      <div className="rounded bg-zinc-100 p-2 dark:bg-zinc-900">
                        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{t.better.label}</p>
                        <p>{t.better.text}</p>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
          {shown.length === 0 && <li className="text-sm text-zinc-500">Nothing selected. Turn a filter on.</li>}
        </ul>
      </Accordion>

      <Accordion
        title="Skills scoreboard"
        summary={scoreboardSummary(a, (s) => STAGES[s] ?? s)}
        open={!!open.scores}
        onToggle={() => toggle("scores")}
      >
        {a.stages.map((s) => (
          <ScoreBar key={s.stage} label={STAGES[s.stage] ?? s.stage} score={s.score} note={s.comment} />
        ))}
        <ScoreBar label="Clarity of the goal" score={a.goalClarity.score} note={a.goalClarity.comment} />
        <ScoreBar label="Call control" score={a.callControl.score} note={a.callControl.comment} />
        <ScoreBar label="Cultural fit" score={a.culturalFit.score} />
        <ul className="list-disc pl-5 text-sm">
          {a.culturalFit.notes.map((n, i) => <li key={i}>{n}</li>)}
        </ul>
      </Accordion>

      <Accordion
        title="Your voice"
        summary={voiceBits.join(" · ")}
        open={!!open.voice}
        onToggle={() => toggle("voice")}
      >
        <p className="text-xs text-zinc-500">Measured from your recording and your microphone, then explained by the coach. Voice moments are in the timeline above.</p>
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
        <Para text={a.voice.summary} />
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
      </Accordion>

      {a.selfReviewFeedback && (
        <Accordion
          title="Your own review vs. reality"
          summary={firstSentence(a.selfReviewFeedback)}
          open={!!open.self}
          onToggle={() => toggle("self")}
        >
          {report.selfReview && <p className="rounded-lg bg-zinc-100 p-3 text-sm italic dark:bg-zinc-900">“{report.selfReview}”</p>}
          <Para text={a.selfReviewFeedback} />
        </Accordion>
      )}

      <Accordion
        title="Who you were really talking to"
        summary={`${report.persona.name}, ${report.persona.role} · ${report.persona.city}`}
        open={!!open.who}
        onToggle={() => toggle("who")}
      >
        <p className="text-xs text-zinc-500">Hidden until now. How they felt through the call is in the timeline.</p>
        <p className="text-sm font-semibold">{report.persona.name}, {report.persona.role} · {report.persona.city}</p>
        <Para text={a.personaReveal.whoTheyWere} />
        <div className="rounded bg-zinc-100 p-3 dark:bg-zinc-900">
          <Labelled label="The hidden truth" text={a.personaReveal.hiddenTruth} />
        </div>
      </Accordion>

      <Accordion
        title="Full transcript"
        summary={`${report.transcript.length} turns`}
        open={!!open.transcript}
        onToggle={() => toggle("transcript")}
      >
        <ul className="flex flex-col gap-2 text-sm">
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
        {meta.droppedQuotes > 0 && (
          <p className="text-xs text-zinc-500">{meta.droppedQuotes} coach comment(s) were removed because their quotes could not be found in the transcript.</p>
        )}
      </Accordion>
    </article>
  );
}
