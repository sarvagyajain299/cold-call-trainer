import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { presets, sessions } from "@/db/schema";
import type { StoredReport } from "@/lib/scoring";
import { usageForSession } from "@/lib/usage";
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
    return (
      <>
        <ReportView
          sessionId={session.id}
          projectName={preset?.name ?? ""}
          callGoal={preset?.callGoal ?? ""}
          report={JSON.parse(session.report) as StoredReport}
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
