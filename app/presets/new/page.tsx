import Link from "next/link";
import { PresetForm } from "@/components/PresetForm";

export default function NewPreset() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-10">
      <Link href="/" className="text-sm text-zinc-500">← Back</Link>
      <h1 className="text-2xl font-semibold">New project</h1>
      <PresetForm />
    </main>
  );
}
