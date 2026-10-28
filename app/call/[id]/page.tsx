import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { presets, sessions } from "@/db/schema";
import { CallScreen } from "@/components/CallScreen";

async function Loaded({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connection();
  const session = db.select().from(sessions).where(eq(sessions.id, id)).get();
  if (!session) notFound();
  const preset = db.select().from(presets).where(eq(presets.id, session.presetId)).get();
  if (!preset) notFound();

  return (
    <CallScreen
      sessionId={session.id}
      presetName={preset.name}
      callGoal={preset.callGoal}
      profile={session.profile}
    />
  );
}

export default function CallPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="p-10 text-sm text-zinc-500">Loading…</p>}>
      <Loaded params={params} />
    </Suspense>
  );
}
