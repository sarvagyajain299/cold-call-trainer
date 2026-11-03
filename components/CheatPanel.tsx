"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { panelLines, type Section } from "@/lib/sheetModel";
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
};

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export function CheatPanel({ data, profile, visible, onToggle }: { data: PanelData; profile: string; visible: boolean; onToggle: (v: boolean) => void }) {
  if (!visible) {
    return (
      <aside className="lg:w-72 lg:shrink-0">
        <button onClick={() => onToggle(true)} className="rounded-full border px-4 py-1.5 text-sm">Show cheat sheet</button>
      </aside>
    );
  }

  const lines = panelLines(data.sections);
  const calling = clip(profile.split("\n").find((l) => l.trim()) ?? "", 110);

  return (
    <aside className="flex flex-col gap-3 rounded-lg border p-4 lg:sticky lg:top-6 lg:w-80 lg:shrink-0" aria-label="Cheat sheet">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Cheat sheet</h2>
        <button onClick={() => onToggle(false)} className="text-sm underline">Hide</button>
      </div>

      <dl className="flex flex-col gap-3">
        {calling && (
          <div>
            <dt className="text-xs text-zinc-500">Calling (your notes)</dt>
            <dd className="text-base font-medium leading-snug">{calling}</dd>
          </div>
        )}
        {lines.map((l) => (
          <div key={l.label}>
            <dt className="text-xs text-zinc-500">{l.label}</dt>
            <dd className="text-base font-medium leading-snug">{l.text}</dd>
          </div>
        ))}
        {data.personal.focus && (
          <div>
            <dt className="text-xs text-zinc-500">Your focus</dt>
            <dd className="text-base font-medium leading-snug">{clip(data.personal.focus, 160)}</dd>
          </div>
        )}
      </dl>

      {!data.generated && (
        <p className="text-xs text-zinc-500">
          No sheet written for this offer yet.{" "}
          <Link href={`/cheatsheet/${data.presetId}`} target="_blank" className="underline">Create it</Link> (opens in a new tab).
        </p>
      )}

      <details className="text-sm">
        <summary className="cursor-pointer font-medium">Full cheat sheet</summary>
        <div className="mt-3 max-h-[60vh] overflow-y-auto pr-1">
          <SheetBody sections={data.sections} personal={data.personal} compact />
        </div>
      </details>
    </aside>
  );
}
