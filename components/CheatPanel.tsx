"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { objectionReplies, scriptBlanks, scriptSteps, type Section } from "@/lib/sheetModel";
import type { Personal } from "@/lib/sheetData";
import { SheetBody } from "@/components/SheetBody";

const KEY = "cheatsheet-panel";
const EVENT = "cheatsheet-panel-change";
let memory: boolean | null = null; // used if localStorage is blocked

function read(): boolean {
  if (memory !== null) return memory;
  try {
    return localStorage.getItem(KEY) !== "hidden";
  } catch {
    return true;
  }
}

/** Shown by default; the choice is remembered on this computer. */
export function usePanelPref(): [boolean, (v: boolean) => void] {
  const visible = useSyncExternalStore(
    (cb) => {
      window.addEventListener(EVENT, cb);
      window.addEventListener("storage", cb);
      return () => {
        window.removeEventListener(EVENT, cb);
        window.removeEventListener("storage", cb);
      };
    },
    read,
    () => true,
  );
  const set = (v: boolean) => {
    memory = v;
    try {
      localStorage.setItem(KEY, v ? "shown" : "hidden");
    } catch {
      // the in-memory value still applies for this visit
    }
    window.dispatchEvent(new Event(EVENT));
  };
  return [visible, set];
}

export type PanelData = {
  presetId: string;
  sections: Section[];
  generated: boolean;
  personal: Personal;
  /** A line from a lesson, pinned at the top for this call ("Try it on ... again"). */
  cueCard?: { label: string; line: string } | null;
};

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export function CheatPanel({ data, profile, visible, onToggle }: { data: PanelData; profile: string; visible: boolean; onToggle: (v: boolean) => void }) {
  if (!visible) {
    return (
      <aside className="lg:w-72 lg:shrink-0">
        <button onClick={() => onToggle(true)} className="rounded-full border px-4 py-1.5 text-sm">Show script</button>
      </aside>
    );
  }

  const steps = scriptSteps(data.sections);
  const objections = objectionReplies(data.sections);
  const blanks = scriptBlanks(data.sections);
  const calling = clip(profile.split("\n").find((l) => l.trim()) ?? "", 110);

  return (
    <aside className="flex flex-col gap-3 rounded-lg border p-4 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:w-96 lg:shrink-0 lg:overflow-y-auto" aria-label="Call script">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Call script</h2>
        <button onClick={() => onToggle(false)} className="text-sm underline">Hide</button>
      </div>

      {data.cueCard && (
        <section className="rounded-lg border-2 border-orange-400! p-3" aria-label="From your lesson">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">From your lesson · {data.cueCard.label}</p>
          <p className="mt-1 text-base font-semibold leading-snug">{data.cueCard.line}</p>
        </section>
      )}

      {calling && <p className="text-xs text-zinc-500">Calling: {calling}</p>}
      {data.personal.focus && (
        <p className="text-sm"><span className="font-semibold">Focus: </span>{clip(data.personal.focus, 160)}</p>
      )}

      {blanks.length > 0 && (
        <p className="rounded-lg border border-dashed p-2 text-xs text-zinc-500">
          Still to fill in: {blanks.join(", ")}.{" "}
          <Link href={`/cheatsheet/${data.presetId}`} target="_blank" className="underline">Edit script</Link> (opens in a new tab).
        </p>
      )}

      <ol className="flex flex-col gap-3">
        {steps.map((s) => (
          <li key={s.id}>
            <p className="text-xs font-semibold text-zinc-500">{s.title}</p>
            {s.lines.map((l, i) => (
              <p key={i} className="text-base font-medium leading-snug">{l}</p>
            ))}
            <p className="text-xs text-zinc-500">{s.hint}</p>
          </li>
        ))}
      </ol>

      {objections.length > 0 && (
        <section className="border-t pt-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">When they say...</h3>
          <p className="text-xs text-zinc-500">Pause. Acknowledge. Then ask.</p>
          <ul className="mt-2 flex flex-col gap-2">
            {objections.map((o, i) => (
              <li key={i} className="text-sm leading-snug">
                {o.they && <span className="font-semibold">{o.they} </span>}
                {o.you}
              </li>
            ))}
          </ul>
        </section>
      )}

      {!data.generated && (
        <p className="text-xs text-zinc-500">
          No objection replies written for this offer yet.{" "}
          <Link href={`/cheatsheet/${data.presetId}`} target="_blank" className="underline">Create them</Link> (opens in a new tab).
        </p>
      )}

      <details className="text-sm">
        <summary className="cursor-pointer font-medium">Backup cheat sheet</summary>
        <div className="mt-3 max-h-[60vh] overflow-y-auto pr-1">
          <SheetBody sections={data.sections} compact hideScript />
        </div>
      </details>
    </aside>
  );
}
