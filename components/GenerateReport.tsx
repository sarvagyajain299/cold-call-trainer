"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const STEPS = [
  "Pulling the transcript",
  "Measuring how clearly you spoke",
  "Listening to your tone and energy",
  "Writing the coaching report",
];

export function GenerateReport({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const started = useRef(false);

  const run = useCallback(() => {
    setError(null);
    setStep(0);
    fetch(`/api/report/${sessionId}`, { method: "POST" })
      .then(async (res) => {
        if (res.ok) return router.refresh();
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not score this call.");
      })
      .catch(() => setError("Could not reach the server."));
  }, [sessionId, router]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    run();
  }, [run]);

  // The work takes about a minute and a half; this only shows that something is happening.
  useEffect(() => {
    if (error) return;
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 18000);
    return () => clearInterval(t);
  }, [error]);

  if (error) {
    return (
      <div role="alert" className="flex flex-col gap-3 rounded-lg border border-red-300 p-4 text-sm text-red-700">
        <p>{error}</p>
        <button onClick={run} className="self-start rounded-full border px-4 py-1">Try again</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3" aria-live="polite">
      <p className="font-medium">Your coach is reviewing the call. This takes about 90 seconds.</p>
      <ul className="flex flex-col gap-1 text-sm">
        {STEPS.map((label, i) => (
          <li key={label} className={i <= step ? "text-foreground" : "text-zinc-400"}>
            {i < step ? "✓" : i === step ? "…" : "·"} {label}
          </li>
        ))}
      </ul>
    </div>
  );
}
