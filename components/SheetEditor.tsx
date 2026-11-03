"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Section } from "@/lib/sheetModel";
import type { Personal } from "@/lib/sheetData";
import { generateSheet, saveSheet } from "@/lib/sheetActions";
import { SheetBody } from "@/components/SheetBody";

export function SheetEditor({
  presetId,
  initial,
  generatedAt,
  personal,
}: {
  presetId: string;
  initial: Section[];
  generatedAt: number | null;
  personal: Personal;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const beginEdit = () => {
    setDraft(Object.fromEntries(initial.map((s) => [s.id, s.lines.join("\n")])));
    setMessage(null);
    setEditing(true);
  };

  const save = () =>
    start(async () => {
      const res = await saveSheet(
        presetId,
        initial.map((s) => ({ id: s.id, lines: (draft[s.id] ?? "").split("\n") })),
      );
      if (res.error) return setMessage(res.error);
      setEditing(false);
      setMessage("Saved.");
      router.refresh();
    });

  const generate = () => {
    const ok = window.confirm(
      generatedAt
        ? "Regenerate the offer-specific sections? This replaces Reason, Questions, When they say, The ask and Proof, and costs about $0.10-0.15 in Anthropic credit. Your other sections and notes are kept."
        : "Generate the offer-specific sections for this project? This costs about $0.10-0.15 in Anthropic credit and takes about 30 seconds.",
    );
    if (!ok) return;
    setMessage(null);
    start(async () => {
      const res = await generateSheet(presetId);
      if (res.error) return setMessage(res.error);
      setMessage("Generated. Edit anything you like.");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <button onClick={generate} disabled={pending || editing} className="rounded-full bg-foreground px-4 py-1.5 text-sm text-background disabled:opacity-50">
          {pending ? "Working… (up to 30 seconds)" : generatedAt ? "Regenerate for this offer" : "Generate for this offer"}
        </button>
        {!editing && (
          <button onClick={beginEdit} disabled={pending} className="rounded-full border px-4 py-1.5 text-sm disabled:opacity-50">Edit</button>
        )}
        <button onClick={() => window.print()} className="rounded-full border px-4 py-1.5 text-sm">Print</button>
        {message && <span className="text-sm text-zinc-500" role="status">{message}</span>}
      </div>

      {!generatedAt && !editing && (
        <p className="rounded-lg border border-dashed p-3 text-sm text-zinc-500 print:hidden">
          Only the generic parts are filled in so far (opener, where you are from, phrase swaps). Press &ldquo;Generate for this offer&rdquo; to add questions, objection replies, the ask and proof written for what you sell.
        </p>
      )}

      {editing ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-zinc-500">One item per line. Keep it to keywords and short phrases. Empty lines are removed.</p>
          {initial.map((s) => (
            <label key={s.id} className="flex flex-col gap-1">
              <span className="font-semibold">{s.title}</span>
              <span className="text-xs text-zinc-500">{s.hint}</span>
              <textarea
                value={draft[s.id] ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, [s.id]: e.target.value }))}
                rows={Math.max(3, (draft[s.id] ?? "").split("\n").length + 1)}
                className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm"
              />
            </label>
          ))}
          <div className="flex gap-2">
            <button onClick={save} disabled={pending} className="rounded-full bg-foreground px-4 py-1.5 text-sm text-background disabled:opacity-50">
              {pending ? "Saving…" : "Save"}
            </button>
            <button onClick={() => setEditing(false)} disabled={pending} className="rounded-full border px-4 py-1.5 text-sm">Cancel</button>
          </div>
        </div>
      ) : (
        <SheetBody sections={initial} personal={personal} />
      )}
    </div>
  );
}
