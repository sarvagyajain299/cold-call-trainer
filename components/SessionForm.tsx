"use client";

import { useActionState } from "react";
import { createSession } from "@/lib/actions";
import type { Preset } from "@/db/schema";

const field = "w-full rounded-lg border bg-transparent px-3 py-2 text-sm";

export function SessionForm({ presets, selected }: { presets: Preset[]; selected?: string }) {
  const [state, action, pending] = useActionState(createSession, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Project
        <select name="presetId" defaultValue={selected} className={field} required>
          {presets.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Who are you calling?
        <textarea
          name="profile"
          rows={6}
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
