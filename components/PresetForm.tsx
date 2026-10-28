"use client";

import { useActionState } from "react";
import { createPreset } from "@/lib/actions";

const field = "w-full rounded-lg border bg-transparent px-3 py-2 text-sm";

export function PresetForm() {
  const [state, action, pending] = useActionState(createPreset, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Project name
        <input name="name" className={field} placeholder="e.g. Website redesign for dentists" required />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        What you sell
        <textarea name="offer" rows={4} className={field} placeholder="Describe the service and the result it gets customers." required />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Price or range (optional)
        <input name="price" className={field} placeholder="e.g. $1,500 setup + $300/month" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Ideal customer (optional)
        <textarea name="idealCustomer" rows={2} className={field} placeholder="Who gets the most value?" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Goal of the call
        <input name="callGoal" className={field} placeholder="e.g. Book a 20-minute video demo" required />
      </label>
      {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      <button disabled={pending} className="rounded-full bg-foreground px-5 py-2 text-sm text-background disabled:opacity-50">
        {pending ? "Saving…" : "Save project"}
      </button>
    </form>
  );
}
