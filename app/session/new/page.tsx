import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { presets } from "@/db/schema";
import { SessionForm } from "@/components/SessionForm";

async function Form({ searchParams }: { searchParams: Promise<{ preset?: string }> }) {
  const { preset } = await searchParams;
  await connection();
  const all = db.select().from(presets).orderBy(desc(presets.createdAt)).all();
  if (all.length === 0) redirect("/presets/new");
  return <SessionForm presets={all} selected={preset} />;
}

export default function NewSession({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string }>;
}) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-10">
      <Link href="/" className="text-sm text-zinc-500">← Back</Link>
      <h1 className="text-2xl font-semibold">New call</h1>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <Form searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
