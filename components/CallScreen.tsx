"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { PitchDetector } from "pitchy";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ConversationProvider,
  useConversationControls,
  useConversationMode,
  useConversationStatus,
} from "@elevenlabs/react";

type Phase = "ready" | "connecting" | "live" | "ended" | "error";

type Props = {
  sessionId: string;
  presetName: string;
  callGoal: string;
  profile: string;
};

type Prepared = {
  signedUrl: string;
  dynamicVariables: Record<string, string>;
  overrides: Record<string, unknown>;
};

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

type VoiceSample = [number, number, number, number];

/** Reads loudness and pitch from the mic about 10 times a second; the server turns these into tone feedback. */
function startVoiceSampler(stream: MediaStream, out: VoiceSample[]) {
  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);

  const buf = new Float32Array(analyser.fftSize);
  const detector = PitchDetector.forFloat32Array(analyser.fftSize);
  const t0 = performance.now();

  const timer = setInterval(() => {
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) sum += v * v;
    const rms = Math.sqrt(sum / buf.length);
    const db = 20 * Math.log10(Math.max(rms, 1e-6));
    const [pitch, clarity] = detector.findPitch(buf, ctx.sampleRate);
    out.push([
      Math.round(((performance.now() - t0) / 1000) * 10) / 10,
      Math.round(db * 10) / 10,
      db > -55 && clarity > 0.8 ? Math.round(pitch) : 0,
      Math.round(clarity * 100) / 100,
    ]);
  }, 100);

  return () => {
    clearInterval(timer);
    void ctx.close();
  };
}

export function CallScreen(props: Props) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [prep, setPrep] = useState<"loading" | "ready" | "failed">("loading");
  const [lineUsed, setLineUsed] = useState(false);

  const conversationId = useRef<string | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const finished = useRef(false);
  const voiceSamples = useRef<VoiceSample[]>([]);
  const stopSampler = useRef<(() => void) | null>(null);

  const releaseMic = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);

  // Runs once per call, whether you hang up, the prospect hangs up, or the line drops.
  const finish = useCallback(async () => {
    if (finished.current) return;
    finished.current = true;

    const rec = recorder.current;
    const stopped = new Promise<void>((resolve) => {
      if (!rec || rec.state === "inactive") return resolve();
      rec.addEventListener("stop", () => resolve(), { once: true });
      rec.stop();
    });
    await stopped;
    stopSampler.current?.();
    stopSampler.current = null;
    releaseMic();

    try {
      if (voiceSamples.current.length > 0) {
        await fetch(`/api/call/${props.sessionId}/voice`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ samples: voiceSamples.current }),
        });
      }
      if (chunks.current.length > 0) {
        await fetch(`/api/call/${props.sessionId}/audio`, {
          method: "POST",
          body: new Blob(chunks.current, { type: "audio/webm" }),
        });
      }
      if (conversationId.current) {
        await fetch(`/api/call/${props.sessionId}/end`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId: conversationId.current }),
        });
      }
    } catch (err) {
      console.error("saving the call failed", err);
    }
    setPhase("ended");
  }, [props.sessionId, releaseMic]);

  useEffect(() => {
    if (phase !== "live") return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(
    () => () => {
      stopSampler.current?.();
      releaseMic();
    },
    [releaseMic],
  );

  // Build the prospect while you read the brief, so pressing Call connects straight away.
  const runPrepare = useCallback(() => {
    fetch("/api/call/prepare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: props.sessionId }),
    })
      .then(async (res) => {
        if (res.ok) return setPrep("ready");
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not prepare the prospect.");
        setPrep("failed");
      })
      .catch(() => {
        setError("Could not reach the server.");
        setPrep("failed");
      });
  }, [props.sessionId]);

  const prepare = useCallback(() => {
    setPrep("loading");
    setError(null);
    runPrepare();
  }, [runPrepare]);

  useEffect(() => {
    runPrepare();
  }, [runPrepare]);

  return (
    <ConversationProvider
      onConnect={({ conversationId: id }) => {
        conversationId.current = id;
        if (stream.current) {
          const rec = new MediaRecorder(stream.current, { mimeType: "audio/webm;codecs=opus" });
          rec.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
          rec.start(1000);
          recorder.current = rec;
          voiceSamples.current = [];
          try {
            stopSampler.current = startVoiceSampler(stream.current, voiceSamples.current);
          } catch (err) {
            console.error("voice sampler unavailable", err); // the report still works without it
          }
        }
        setPhase("live");
      }}
      onDisconnect={() => void finish()}
      onError={(message) => {
        console.error("conversation error", message);
        setError(typeof message === "string" ? message : "The call dropped.");
        setLineUsed(true);
      }}
    >
      <CallBody
        {...props}
        phase={phase}
        seconds={seconds}
        error={error}
        prep={prep}
        lineUsed={lineUsed}
        onRetryPrepare={prepare}
        onPreparing={async () => {
          setError(null);
          setPhase("connecting");
          try {
            stream.current = await navigator.mediaDevices.getUserMedia({
              audio: { echoCancellation: true, noiseSuppression: false },
            });
          } catch {
            setPhase("error");
            setError("Microphone access was blocked. Allow the mic for this site and try again.");
            return null;
          }
          const res = await fetch("/api/call/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId: props.sessionId }),
          });
          const data = await res.json();
          if (!res.ok) {
            releaseMic();
            setPhase("error");
            setError(data.error ?? "Could not start the call.");
            return null;
          }
          return data as Prepared;
        }}
        onFailed={(msg) => {
          releaseMic();
          setLineUsed(true); // the server has already marked this call as started
          setPhase("error");
          setError(msg);
        }}
      />
    </ConversationProvider>
  );
}

type BodyProps = Props & {
  phase: Phase;
  seconds: number;
  error: string | null;
  prep: "loading" | "ready" | "failed";
  lineUsed: boolean;
  onRetryPrepare: () => void;
  onPreparing: () => Promise<Prepared | null>;
  onFailed: (msg: string) => void;
};

function SelfReview({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const go = async (withReview: boolean) => {
    setSaving(true);
    if (withReview && text.trim()) {
      await fetch(`/api/call/${sessionId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      }).catch(() => undefined);
    }
    router.push(`/report/${sessionId}`);
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Before you see the scorecard: how did it go?</span>
        <span className="text-zinc-500">What went well, and what would you redo? The coach will compare this with what really happened.</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm"
          placeholder="e.g. I got his name wrong, my goal was unclear, but the questions about his website went well."
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          onClick={() => go(true)}
          disabled={saving}
          className="rounded-full bg-foreground px-5 py-2 text-sm text-background disabled:opacity-50"
        >
          {saving ? "Opening…" : "See my scorecard"}
        </button>
        <button onClick={() => go(false)} disabled={saving} className="text-sm underline disabled:opacity-50">
          Skip
        </button>
      </div>
    </div>
  );
}

function CallBody({
  sessionId,
  phase,
  seconds,
  error,
  prep,
  lineUsed,
  onRetryPrepare,
  profile,
  presetName,
  callGoal,
  onPreparing,
  onFailed,
}: BodyProps) {
  const { startSession, endSession } = useConversationControls();
  const { status } = useConversationStatus();
  const { isSpeaking } = useConversationMode();

  const dial = async () => {
    const prepared = await onPreparing();
    if (!prepared) return;
    try {
      startSession({
        signedUrl: prepared.signedUrl,
        connectionType: "websocket",
        dynamicVariables: prepared.dynamicVariables,
        overrides: prepared.overrides as never,
      });
    } catch {
      onFailed("Could not connect the call.");
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-10">
      <header>
        <p className="text-sm text-zinc-500">{presetName}</p>
        <h1 className="text-2xl font-semibold">Cold call</h1>
      </header>

      <section className="rounded-lg border p-4 text-sm">
        <p className="font-medium">Who you are calling</p>
        <p className="mt-1 whitespace-pre-wrap text-zinc-600 dark:text-zinc-400">{profile}</p>
        <p className="mt-3 font-medium">Goal</p>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">{callGoal}</p>
      </section>

      {phase === "ready" && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-zinc-500">
            Use headphones so the prospect does not hear themselves. When you press Call, the browser will ask for your mic.
            The prospect picks up and speaks first.
          </p>
          <button
            onClick={dial}
            disabled={prep !== "ready"}
            className="rounded-full bg-foreground px-5 py-3 text-background disabled:opacity-50"
          >
            {prep === "loading" ? "Getting the prospect ready…" : "Call"}
          </button>
          {prep === "failed" && (
            <button onClick={onRetryPrepare} className="self-start text-sm underline">Try preparing again</button>
          )}
        </div>
      )}

      {phase === "connecting" && <p className="text-sm text-zinc-500">Dialling…</p>}

      {phase === "live" && (
        <div className="flex flex-col items-center gap-4">
          <p className="text-4xl font-semibold tabular-nums">{fmt(seconds)}</p>
          <p className="text-sm text-zinc-500" aria-live="polite">
            {status !== "connected" ? "Connecting…" : isSpeaking ? "They are speaking" : "Listening to you"}
          </p>
          <button onClick={() => endSession()} className="rounded-full bg-red-600 px-6 py-3 text-white">
            Hang up
          </button>
        </div>
      )}

      {phase === "ended" && (
        <div className="flex flex-col gap-4">
          <p className="font-medium">Call ended · {fmt(seconds)}</p>
          <SelfReview sessionId={sessionId} />
        </div>
      )}

      {error && (
        <div role="alert" className="flex flex-col gap-2 rounded-lg border border-red-300 p-3 text-sm text-red-700">
          <p>{error}</p>
          {phase === "error" && !lineUsed && (
            <button onClick={dial} className="self-start rounded-full border px-4 py-1 text-red-700">Try again</button>
          )}
          {lineUsed && (
            <Link href="/" className="self-start underline">This call is used up. Start a new one from home.</Link>
          )}
        </div>
      )}
    </main>
  );
}
