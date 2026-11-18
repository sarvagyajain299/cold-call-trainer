"use client";

import { useState, useTransition } from "react";
import { deleteProspectType, saveProspectType } from "@/lib/prospectTypeActions";
import type { ProspectType } from "@/db/schema";

const field = "w-full rounded-lg border bg-transparent px-3 py-2 text-sm";

type Draft = { id?: string; label: string; profile: string };

function TypeForm({ initial, onSave, onCancel, pending }: { initial: Draft; onSave: (d: Draft) => void; onCancel: () => void; pending: boolean }) {
  const [label, setLabel] = useState(initial.label);
  const [profile, setProfile] = useState(initial.profile);
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <label className="flex flex-col gap-1 text-sm">
        Short name
        <input value={label} onChange={(e) => setLabel(e.target.value)} className={field} placeholder="e.g. Older owner, not online" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Who are you calling?
        <textarea value={profile} onChange={(e) => setProfile(e.target.value)} rows={5} className={field} placeholder="Business, area, the person's age, background, how they use technology..." />
      </label>
      <div className="flex gap-2">
        <button
          onClick={() => onSave({ id: initial.id, label, profile })}
          disabled={pending}
          className="rounded-full bg-foreground px-4 py-1.5 text-sm text-background disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button onClick={onCancel} disabled={pending} className="rounded-full border px-4 py-1.5 text-sm">Cancel</button>
      </div>
    </div>
  );
}

export function ProspectTypes({ presetId, types }: { presetId: string; types: ProspectType[] }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = (d: Draft) =>
    startTransition(async () => {
      const res = await saveProspectType(presetId, d);
      if (res.error) setError(res.error);
      else {
        setError(null);
        setEditing(null);
      }
    });

  const remove = (id: string) =>
    startTransition(async () => {
      await deleteProspectType(presetId, id);
      setConfirmDelete(null);
    });

  return (
    <div className="flex flex-col gap-2">
      {types.length === 0 && editing !== "new" && (
        <p className="text-sm text-zinc-500">No saved types yet. Save the kinds of people you call, then pick one when you start a call.</p>
      )}
      <ul className="flex flex-col gap-2">
        {types.map((t) =>
          editing === t.id ? (
            <li key={t.id}>
              <TypeForm initial={t} onSave={save} onCancel={() => setEditing(null)} pending={pending} />
            </li>
          ) : (
            <li key={t.id} className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
              <p className="font-medium">{t.label}</p>
              <p className="text-zinc-500">{t.profile}</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => { setEditing(t.id); setError(null); }} disabled={pending} className="rounded-full border px-3 py-1 text-xs">Edit</button>
                {confirmDelete === t.id ? (
                  <>
                    <span className="self-center text-xs">Delete this type?</span>
                    <button onClick={() => remove(t.id)} disabled={pending} className="rounded-full border border-red-600 px-3 py-1 text-xs text-red-600">Yes, delete</button>
                    <button onClick={() => setConfirmDelete(null)} disabled={pending} className="rounded-full border px-3 py-1 text-xs">No</button>
                  </>
                ) : (
                  <button onClick={() => setConfirmDelete(t.id)} disabled={pending} className="rounded-full border px-3 py-1 text-xs">Delete</button>
                )}
              </div>
            </li>
          ),
        )}
      </ul>
      {editing === "new" ? (
        <TypeForm initial={{ label: "", profile: "" }} onSave={save} onCancel={() => setEditing(null)} pending={pending} />
      ) : (
        <button onClick={() => { setEditing("new"); setError(null); }} disabled={pending} className="self-start rounded-full border px-4 py-1.5 text-sm">
          Add a prospect type
        </button>
      )}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
