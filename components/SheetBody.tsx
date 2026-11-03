import type { Section } from "@/lib/sheetModel";
import type { Personal } from "@/lib/sheetData";
import { HABITS } from "@/lib/habits";

/** Read-only rendering of a cheat sheet, shared by the full page, the print view and the in-call drawer. */
export function SheetBody({ sections, personal, compact = false }: { sections: Section[]; personal?: Personal | null; compact?: boolean }) {
  const text = compact ? "text-sm" : "text-base";
  return (
    <div className="flex flex-col gap-5">
      {personal && (personal.focus || personal.habits.length > 0) && (
        <section className="rounded-lg border-2 border-foreground p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Just for you</h3>
          {personal.focus && (
            <p className={`mt-1 ${text}`}>
              <span className="font-semibold">Last focus{personal.focusFrom ? ` (call with ${personal.focusFrom})` : ""}: </span>
              {personal.focus}
            </p>
          )}
          {personal.habits.length > 0 && (
            <p className={`mt-1 ${text}`}>
              <span className="font-semibold">Your habits: </span>
              {personal.habits.map((h) => `${HABITS[h.id] ?? h.label} (${h.calls}/${h.outOf})`).join(" · ")}
            </p>
          )}
        </section>
      )}
      {sections.map((s) => {
        if (s.lines.length === 0) return null;
        return (
          <section key={s.id} className="break-inside-avoid">
            <h3 className="font-semibold">{s.title}</h3>
            <p className="text-xs text-zinc-500">{s.hint}</p>
            <ul className={`mt-1 flex flex-col gap-1 ${text}`}>
              {s.lines.map((l, i) => (
                <li key={i} className="leading-snug">{l}</li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
