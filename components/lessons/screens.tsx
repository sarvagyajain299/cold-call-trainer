"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { CallShape } from "@/components/lessons/CallShape";
import { ClipButton } from "@/components/lessons/ClipButton";
import { FixMark, Group, Quote, SecondaryText, WinMark } from "@/components/lessons/ui";
import { cleanReply, fmtTime, wordCount, type FeelingStep, type GutCheck as Gut, type Lane, type Lesson } from "@/lib/lessons/model";

function Title({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[28px] font-bold leading-tight tracking-tight">{children}</h2>;
}

// 1. Gut check (lesson 1 only)
export function GutCheck({
  gut,
  prospectName,
  pick,
  onPick,
}: {
  gut: Gut;
  prospectName: string;
  pick: string | null;
  onPick: (label: string) => void;
}) {
  if (gut.mode === "review") {
    return (
      <div className="flex flex-col gap-6">
        <Title>Before anything else: how you felt about the {prospectName} call.</Title>
        <Group>
          <Quote who="You said">{gut.selfReview}</Quote>
        </Group>
        <p className="lesson-fade-up text-[19px] leading-snug">{gut.reconcile}</p>
      </div>
    );
  }
  const chosen = gut.options.find((o) => o.label === pick);
  return (
    <div className="flex flex-col gap-6">
      <Title>Before I show you anything: how do you think the {prospectName} call went?</Title>
      <div className="flex flex-col gap-2" role="radiogroup" aria-label="How the call went">
        {gut.options.map((o) => (
          <button
            key={o.label}
            type="button"
            role="radio"
            aria-checked={pick === o.label}
            onClick={() => onPick(o.label)}
            className={`min-h-[52px] rounded-[14px] px-4 text-left text-[17px] ${pick === o.label ? "bg-ios-blue-fill text-ios-on-blue" : "bg-ios-surface"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div aria-live="polite">{chosen && <p className="lesson-fade-up text-[19px] leading-snug">{chosen.reconcile}</p>}</div>
    </div>
  );
}

// 2. Find it: tap a bar to read and hear that turn, then confirm the one that caused the problem.
export function FindIt({
  lesson,
  lanes,
  steps,
  texts,
  duration,
  solved,
  onSolved,
}: {
  lesson: Lesson;
  lanes: Lane[];
  steps: FeelingStep[];
  /** What was said in each turn, by turn index. */
  texts: string[];
  duration: number;
  solved: boolean;
  onSolved: () => void;
}) {
  const f = lesson.data.findIt;
  const name = lesson.data.prospectName;
  const [selected, setSelected] = useState<string | null>(null);
  const [wrong, setWrong] = useState(false);
  const [misses, setMisses] = useState(0);
  const correct = lanes.filter((l) => f.correctTurnIds.includes(l.id));
  const pick = lanes.find((l) => l.id === selected) ?? null;
  const reply = pick?.role === "trainee" ? lanes.slice(pick.index + 1).find((l) => l.role === "prospect") ?? null : null;

  const confirm = () => {
    if (!pick || solved) return;
    if (f.correctTurnIds.includes(pick.id)) {
      setWrong(false);
      onSolved();
    } else {
      setWrong(true);
      setMisses((m) => m + 1);
      if (misses + 1 >= 3) onSolved(); // after three tries, show the answer
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <Title>{f.prompt}</Title>
      <Group>
        <CallShape
          lanes={lanes}
          steps={steps}
          duration={duration}
          prospectName={name}
          highlight={solved ? f.correctTurnIds : []}
          selected={selected}
          onTap={(id) => {
            setSelected(id);
            setWrong(false);
          }}
        />
      </Group>

      {!pick && !solved && <SecondaryText>Tap any bar to read and hear that moment. Then choose the one that caused the problem.</SecondaryText>}

      {pick && (
        <Group key={pick.id} className="lesson-fade-up flex flex-col gap-3">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-ios-label-2">
            {pick.role === "trainee" ? "You" : name} · {fmtTime(pick.start)}
            {pick.role === "trainee" ? ` · ${pick.words} words` : ""}
          </p>
          <p className="call-quote text-[17px] leading-snug">“{cleanReply(texts[pick.index] ?? "", 50)}”</p>
          {reply && (
            <p className="border-l-2 border-ios-sep! pl-3 text-[15px] text-ios-label-2">
              {name} replied: <span className="call-quote">“{cleanReply(texts[reply.index] ?? "", 22)}”</span>
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <ClipButton clip={{ t: pick.start, end: pick.end }} label={`${pick.role === "trainee" ? "you" : name} at ${fmtTime(pick.start)}`} />
            {!solved && pick.role === "trainee" && (
              <button
                type="button"
                onClick={confirm}
                className="inline-flex min-h-[44px] items-center rounded-full bg-ios-fill px-4 text-[15px] font-semibold text-ios-blue"
              >
                This is the one
              </button>
            )}
          </div>
          {!solved && pick.role === "prospect" && <SecondaryText>That&apos;s {name}. The problem is in one of your own turns.</SecondaryText>}
        </Group>
      )}

      <div aria-live="polite" className="flex flex-col gap-3">
        {!solved && wrong && <p className="lesson-fade-up text-[17px] text-ios-label-2">Not that one. {f.hint}</p>}
        {solved && (
          <div className="lesson-fade-up flex flex-col gap-3">
            <ul className="flex flex-wrap gap-2">
              {correct.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(l.id)}
                    className="inline-flex min-h-[36px] items-center gap-2 rounded-full bg-ios-surface px-3 text-[15px]"
                  >
                    <FixMark /> {fmtTime(l.start)} · {l.words} words
                  </button>
                </li>
              ))}
            </ul>
            <p className="text-[17px] leading-snug">{f.explanation}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// 3. Choose
export function Choose({ lesson, solved, onSolved }: { lesson: Lesson; solved: boolean; onSolved: () => void }) {
  const c = lesson.data.choose;
  const [tried, setTried] = useState<number[]>([]);
  const [picked, setPicked] = useState<number | null>(solved ? c.options.findIndex((o) => o.kind === "model") : null);
  const name = lesson.data.prospectName;

  const choose = (i: number) => {
    if (solved) return;
    setPicked(i);
    if (c.options[i].kind === "model") onSolved();
    else setTried((t) => (t.includes(i) ? t : [...t, i]));
  };

  const last = picked !== null ? c.options[picked] : null;
  return (
    <div className="flex flex-col gap-5">
      <Title>{name} said this. What&apos;s the best reply?</Title>
      <Group className="flex flex-col gap-3">
        <Quote who={name}>{c.prospectQuote}</Quote>
        <div>
          <ClipButton clip={c.clip} label={`${name}'s line`} />
        </div>
      </Group>
      <div className="flex flex-col gap-2">
        {c.options.map((o, i) => {
          const isRight = solved && o.kind === "model";
          const isTried = tried.includes(i);
          return (
            <button
              key={i}
              type="button"
              onClick={() => choose(i)}
              aria-pressed={picked === i}
              disabled={solved && !isRight}
              className={`flex min-h-[52px] items-start gap-3 rounded-[14px] px-4 py-3 text-left text-[17px] leading-snug ${
                isRight ? "bg-ios-surface ring-2 ring-ios-green" : isTried ? "bg-ios-surface opacity-55" : "bg-ios-surface"
              } disabled:opacity-45`}
            >
              {isRight && <Check size={20} aria-hidden className="lesson-pop mt-0.5 shrink-0 text-ios-green-text" />}
              <span>
                {o.text}
                {solved && o.kind === "yours" && <span className="mt-1 block text-[13px] text-ios-label-2">What you said, cleaned up</span>}
              </span>
            </button>
          );
        })}
      </div>
      <div aria-live="polite">
        {last && !solved && <p className="lesson-fade-up text-[17px] text-ios-label-2">{c.wrongHint}</p>}
        {solved && (
          <div className="lesson-fade-up flex flex-col gap-3">
            <p className="text-[17px] leading-snug">{c.rightExplanation}</p>
            {c.reaction && (
              <Group className="flex flex-col gap-2">
                <SecondaryText>What {name} really said next</SecondaryText>
                <Quote>{c.reaction.text}</Quote>
                <div>
                  <ClipButton clip={c.reaction.clip} label={`${name}'s reaction`} />
                </div>
              </Group>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// 4. The rule
export function RuleScreen({ lesson }: { lesson: Lesson }) {
  const r = lesson.data.ruleScreen;
  return (
    <div className="flex flex-col gap-6">
      <p className="text-[13px] font-semibold uppercase tracking-wide text-ios-label-2">The rule</p>
      <h2 className="large-title">{lesson.rule}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Group className="flex flex-col gap-2">
          <p className="flex items-center gap-2 text-[15px] font-semibold text-ios-label-2">
            <FixMark /> You said · {r.before.words} words
          </p>
          <p className="call-quote text-[16px] leading-snug">“{cleanReply(r.before.text, 25)}”</p>
          <div>
            <ClipButton clip={r.before.clip} label="what you said" />
          </div>
        </Group>
        <Group className="flex flex-col gap-2">
          <p className="flex items-center gap-2 text-[15px] font-semibold text-ios-label-2">
            <WinMark /> Say instead · {wordCount(r.after.text)} words
          </p>
          <p className="text-[17px] font-medium leading-snug">{r.after.text}</p>
        </Group>
      </div>
    </div>
  );
}
