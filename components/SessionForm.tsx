"use client";

import { useActionState, useState } from "react";
import { createSession } from "@/lib/actions";
import { typesForPreset } from "@/lib/prospectTypes";
import type { Preset, ProspectType } from "@/db/schema";

const field = "w-full rounded-lg border bg-transparent px-3 py-2 text-sm";

export function SessionForm({ presets, types, selected }: { presets: Preset[]; types: ProspectType[]; selected?: string }) {
  const [state, action, pending] = useActionState(createSession, undefined);
  const [presetId, setPresetId] = useState(selected && presets.some((p) => p.id === selected) ? selected : presets[0]?.id);
  const [typeId, setTypeId] = useState("");
  const [profile, setProfile] = useState("");
  const saved = typesForPreset(types, presetId);

  const pickType = (id: string) => {
    setTypeId(id);
    const t = saved.find((x) => x.id === id);
    if (t) setProfile(t.profile);
  };

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Project
        <select
          name="presetId"
          value={presetId}
          onChange={(e) => {
            setPresetId(e.target.value);
            setTypeId("");
          }}
          className={field}
          required
        >
          {presets.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </label>
      {saved.length > 0 && (
        <label className="flex flex-col gap-1 text-sm">
          Saved prospect type
          <select value={typeId} onChange={(e) => pickType(e.target.value)} className={field}>
            <option value="">Write my own</option>
            {saved.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
          <span className="text-xs text-zinc-500">Fills the box below. You can still change the text.</span>
        </label>
      )}
      <label className="flex flex-col gap-1 text-sm">
        Who are you calling?
        <textarea
          name="profile"
          rows={6}
          value={profile}
          onChange={(e) => setProfile(e.target.value)}
          className={field}
          placeholder="Business, industry, city and country, the person's role, anything you found online."
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Difficulty
        <select name="difficulty" defaultValue="realistic" className={field}>
          <option value="easy">Easy: friendly, some patience</option>
          <option value="realistic">Realistic: like a normal day of calls</option>
          <option value="brutal">Brutal: busy, sceptical, quick to hang up</option>
        </select>
      </label>
      {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      <button disabled={pending} className="rounded-full bg-foreground px-5 py-2 text-sm text-background disabled:opacity-50">
        {pending ? "Preparing the call…" : "Start the call"}
      </button>
    </form>
  );
}
