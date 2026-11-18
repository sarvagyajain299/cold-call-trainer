import { isScriptSection, type Section } from "@/lib/sheetModel";
import type { Personal } from "@/lib/sheetData";
import { HABITS } from "@/lib/habits";

/** Read-only rendering of a cheat sheet, shared by the full page, the print view and the in-call drawer. */
export function SheetBody({ sections, personal, compact = false, hideScript = false }: { sections: Section[]; personal?: Personal | null; compact?: boolean; hideScript?: boolean }) {
  const text = compact ? "text-sm" : "text-base";
  const renderSection = (s: Section) =>
    s.lines.length === 0 ? null : (
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
  const script = sections.filter((s) => isScriptSection(s.id));
  const backup = sections.filter((s) => !isScriptSection(s.id));
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
      {!hideScript && script.length > 0 && (
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-xl font-semibold">Call script</h2>
            <p className="text-sm text-zinc-500">Say these words. Rehearse from memory until they sound like you.</p>
          </div>
          {script.map(renderSection)}
        </div>
      )}
      <div className="flex flex-col gap-5">
        {!hideScript && <h2 className="text-xl font-semibold">Cheat sheet (backup)</h2>}
        {backup.map(renderSection)}
      </div>
    </div>
  );
}
