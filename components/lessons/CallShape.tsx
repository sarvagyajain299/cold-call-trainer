"use client";

import { useState } from "react";
import { fmtTime, type FeelingStep, type Lane } from "@/lib/lessons/model";

/**
 * The shape of the call: one bar per talking turn on two lanes (You / Prospect), placed by real
 * timestamps, and under them a stepped line of how the prospect felt (guarded at the bottom, open at the top).
 * Tapping a step shows that feeling in words.
 */
export function CallShape({
  lanes,
  steps,
  duration,
  prospectName,
  highlight,
  selected,
  onTap,
}: {
  lanes: Lane[];
  steps: FeelingStep[];
  duration: number;
  prospectName: string;
  highlight: string[];
  selected: string | null;
  onTap?: (id: string) => void;
}) {
  const [feeling, setFeeling] = useState<number | null>(null);

  const lane = (role: Lane["role"]) => (
    <div className="relative h-11 flex-1 rounded-[8px] bg-ios-fill">
      {lanes
        .filter((l) => l.role === role)
        .map((l) => {
          const hot = highlight.includes(l.id);
          const picked = selected === l.id;
          const who = role === "trainee" ? "You" : prospectName;
          return (
            <button
              key={l.id}
              type="button"
              disabled={!onTap}
              onClick={() => onTap?.(l.id)}
              aria-label={`${who} at ${fmtTime(l.start)}, ${l.words} words`}
              aria-pressed={picked || hot}
              className={`absolute top-1 bottom-1 rounded-[4px] transition-transform duration-150 active:scale-y-90 disabled:cursor-default ${
                hot ? "bg-ios-orange" : role === "trainee" ? "bg-ios-label-2" : "bg-ios-sep"
              } ${picked ? "outline-3 outline-offset-2 outline-ios-blue" : ""}`}
              style={{ left: `${l.x * 100}%`, width: `max(5px, calc(${l.w * 100}% - 2px))` }}
            >
              {hot && <span aria-hidden className="absolute -top-3 left-1/2 block h-2 w-2 -translate-x-1/2 rotate-45 bg-ios-orange" />}
            </button>
          );
        })}
    </div>
  );

  // Stepped feelings line in a 100 x 40 box; level 0 (guarded) at the bottom, 4 (open) at the top.
  const y = (level: number) => 36 - level * 8;
  const d = steps.map((s, i) => `${i === 0 ? "M" : "L"}${s.x * 100},${y(s.level)} L${s.x2 * 100},${y(s.level)}`).join(" ");
  const shown = feeling !== null ? steps[feeling] : null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-[13px] font-semibold text-ios-label-2">You</span>
        {lane("trainee")}
      </div>
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0 truncate text-[13px] font-semibold text-ios-label-2">{prospectName}</span>
        {lane("prospect")}
      </div>
      {steps.length > 0 && (
        <div className="flex items-stretch gap-2">
          <span className="flex w-16 shrink-0 flex-col justify-between py-0.5 text-[11px] text-ios-label-2">
            <span>Open</span>
            <span>Guarded</span>
          </span>
          <div className="relative h-16 flex-1">
            <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
              <line x1="0" x2="100" y1="20" y2="20" stroke="var(--ios-sep)" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray="3 3" />
              <path d={d} fill="none" stroke="var(--ios-blue)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
              {shown && (
                <line
                  x1={shown.x * 100}
                  x2={shown.x2 * 100}
                  y1={y(shown.level)}
                  y2={y(shown.level)}
                  stroke="var(--ios-blue)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </svg>
            {steps.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setFeeling(feeling === i ? null : i)}
                aria-label={`How ${prospectName} felt from ${fmtTime(s.t)}: ${s.feeling}`}
                aria-pressed={feeling === i}
                className="absolute inset-y-0 rounded-[4px]"
                style={{ left: `${s.x * 100}%`, width: `${(s.x2 - s.x) * 100}%` }}
              />
            ))}
          </div>
        </div>
      )}
      <div className="flex justify-between pl-[72px] text-[11px] text-ios-label-2">
        <span>0:00</span>
        <span>{fmtTime(duration)}</span>
      </div>
      <p aria-live="polite" className="min-h-[20px] pl-[72px] text-[13px] text-ios-label-2">
        {shown ? (
          <>
            <span className="font-semibold text-ios-label">{fmtTime(shown.t)}</span> · {prospectName} felt: {shown.feeling}
          </>
        ) : (
          `Tap the blue line to see how ${prospectName} felt.`
        )}
      </p>
    </div>
  );
}
