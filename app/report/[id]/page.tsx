import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { presets, sessions } from "@/db/schema";
import type { StoredReport } from "@/lib/scoring";
import { usageForSession } from "@/lib/usage";
import { getSheet } from "@/lib/sheetData";
import { personaKey } from "@/lib/people";
import { buildComparison, findPrevious, type Comparison } from "@/lib/compare";
import { GenerateReport } from "@/components/GenerateReport";
import { ReportView } from "@/components/ReportView";

async function Loaded({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connection();
  const session = db.select().from(sessions).where(eq(sessions.id, id)).get();
  if (!session) notFound();
  const preset = db.select().from(presets).where(eq(presets.id, session.presetId)).get();

  if (session.report) {
    const usage = await usageForSession(session.id);
    const report = JSON.parse(session.report) as StoredReport;
    let comparison: Comparison | undefined;
    // Compare by when each call was scored (a session can be created days before its call).
    const scored = db
      .select()
      .from(sessions)
      .all()
      .filter((x) => x.report)
      .map((x) => ({ ...x, createdAt: (JSON.parse(x.report as string) as StoredReport).createdAt }));
    const prev = findPrevious({ id: session.id, createdAt: report.createdAt, persona: session.persona }, scored, personaKey);
    if (prev) {
      comparison = buildComparison({
        cur: report,
        prev: JSON.parse(prev.report as string) as StoredReport,
        prevSessionId: prev.id,
        prevCreatedAt: prev.createdAt,
        curDifficulty: session.difficulty,
        prevDifficulty: prev.difficulty,
        curPresetId: session.presetId,
        prevPresetId: prev.presetId,
      });
    }
    return (
      <>
        <ReportView
          sessionId={session.id}
          projectName={preset?.name ?? ""}
          callGoal={preset?.callGoal ?? ""}
          report={report}
          comparison={comparison}
          presetId={session.presetId}
          savedLines={getSheet(session.presetId).sections.find((x) => x.id === "notes")?.lines ?? []}
          sheetShown={session.sheetShown === null ? null : session.sheetShown === 1}
        />
        {usage.rows.length > 0 && (
          <p className="text-xs text-zinc-500">
            AI cost for this call: ${usage.total.toFixed(2)} (
            {usage.rows
              .map((r) => `${r.kind.replace("_", " ")} ${r.input.toLocaleString()} in / ${r.output.toLocaleString()} out`)
              .join("; ")}
            ). Voice minutes are billed separately by ElevenLabs.
          </p>
        )}
      </>
    );
  }

  if (!session.conversationId) {
    return (
      <div className="flex flex-col gap-2 text-sm">
        <p>This call has not been recorded yet, so there is nothing to score.</p>
        <Link href={`/call/${session.id}`} className="underline">Go to the call</Link>
      </div>
    );
  }

  return <GenerateReport sessionId={session.id} />;
}

export default function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <Link href="/" className="text-sm text-zinc-500">← Home</Link>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <Loaded params={params} />
      </Suspense>
    </main>
  );
}
