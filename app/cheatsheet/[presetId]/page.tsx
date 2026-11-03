import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { presets } from "@/db/schema";
import { getPersonal, getSheet } from "@/lib/sheetData";
import { SheetEditor } from "@/components/SheetEditor";

async function Loaded({ params }: { params: Promise<{ presetId: string }> }) {
  const { presetId } = await params;
  await connection();
  const preset = db.select().from(presets).where(eq(presets.id, presetId)).get();
  if (!preset) notFound();
  const sheet = getSheet(presetId);
  const personal = getPersonal();

  return (
    <>
      <div>
        <p className="text-sm text-zinc-500">{preset.name} · goal: {preset.callGoal}</p>
        <h1 className="text-2xl font-semibold">Cheat sheet</h1>
        <p className="mt-1 text-sm text-zinc-500 print:hidden">
          Read it before the call. It also sits beside the call screen, and you can hide it there. It never shows anything about who you are about to call.
        </p>
      </div>
      <SheetEditor presetId={presetId} initial={sheet.sections} generatedAt={sheet.generatedAt} personal={personal} />
    </>
  );
}

export default function CheatSheetPage({ params }: { params: Promise<{ presetId: string }> }) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <Link href="/" className="text-sm text-zinc-500 print:hidden">← Home</Link>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <Loaded params={params} />
      </Suspense>
    </main>
  );
}
