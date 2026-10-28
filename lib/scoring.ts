import { readFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { presets, sessions } from "@/db/schema";
import type { Persona } from "@/lib/persona";
import { fetchTranscript, type Turn } from "@/lib/transcript";
import { transcribeWords } from "@/lib/deepgram";
import { analyzeTone, type Tone } from "@/lib/tone";
import { summarizeSpeech, windowSpeech, type DgWord, type SpeechSummary } from "@/lib/speechMetrics";
import { summarizeVoice, type VoiceSample, type VoiceSummary } from "@/lib/voiceMetrics";
import { analyzeCall, verifyAnalysis, type Analysis } from "@/lib/report";

export type StoredReport = {
  version: 1;
  createdAt: number;
  analysis: Analysis;
  persona: Persona;
  transcript: Turn[];
  selfReview: string | null;
  hasRecording: boolean;
  meta: {
    durationSecs: number;
    endedBy: string;
    droppedQuotes: number;
    traineeWords: number;
    prospectWords: number;
    /** Share of all spoken words that were the trainee's. */
    traineeWordShare: number;
  };
  metrics: {
    speech: SpeechSummary | null;
    voice: VoiceSummary | null;
    tone: Tone | null;
  };
};

const recordings = () => path.join(process.cwd(), "recordings");

async function readOptional(file: string): Promise<Buffer | null> {
  try {
    return await readFile(file);
  } catch {
    return null;
  }
}

async function settled<T>(label: string, job: Promise<T>): Promise<T | null> {
  try {
    return await job;
  } catch (err) {
    console.error(`${label} failed`, err);
    return null;
  }
}

const wordCount = (turns: Turn[], role: Turn["role"]) =>
  turns.filter((t) => t.role === role).reduce((n, t) => n + t.text.split(/\s+/).length, 0);

// One report per session at a time, even if the page asks twice.
const inFlight = new Map<string, Promise<void>>();

export function generateReportFor(sessionId: string): Promise<void> {
  const running = inFlight.get(sessionId);
  if (running) return running;
  const job = buildAndSave(sessionId).finally(() => inFlight.delete(sessionId));
  inFlight.set(sessionId, job);
  return job;
}

async function buildAndSave(sessionId: string): Promise<void> {
  const session = db.select().from(sessions).where(eq(sessions.id, sessionId)).get();
  if (!session) throw new Error("Session not found");
  if (!session.conversationId || !session.persona) throw new Error("This call has no recording to score yet");
  const preset = db.select().from(presets).where(eq(presets.id, session.presetId)).get();
  if (!preset) throw new Error("Project not found");

  const persona = JSON.parse(session.persona) as Persona;
  const [transcript, audio, voiceFile] = await Promise.all([
    fetchTranscript(session.conversationId),
    readOptional(path.join(recordings(), `${session.id}.webm`)),
    readOptional(path.join(recordings(), `${session.id}.voice.json`)),
  ]);

  if (!transcript.turns.some((t) => t.role === "trainee")) {
    throw new Error("You did not say anything on this call, so there is nothing to score.");
  }

  // Slow, independent jobs run together. A failure in one only removes that section.
  const [words, tone] = await Promise.all([
    audio ? settled("speech analysis", transcribeWords(audio)) : Promise.resolve(null),
    audio ? settled("tone analysis", analyzeTone(audio)) : Promise.resolve(null),
  ]);

  const speech = words && words.length ? summarizeSpeech(words) : null;
  const voice = voiceFile ? summarizeVoice((JSON.parse(voiceFile.toString()) as { samples: VoiceSample[] }).samples) : null;

  // Per-turn pace and clarity, so the coach can point at the exact moments someone was hard to follow.
  const perTurn = transcript.turns
    .map((turn, i) => ({ turn, i }))
    .filter(({ turn }) => turn.role === "trainee")
    .map(({ turn, i }) => {
      const next = transcript.turns[i + 1]?.t ?? Infinity;
      const w = windowSpeech((words ?? []) as DgWord[], Math.max(0, turn.t - 0.5), next - 0.2);
      return { t: turn.t, wpm: w.wpm, words: w.wordCount, lowConfidence: w.lowConfidenceWords.map((x) => x.word) };
    });

  const raw = await analyzeCall({
    preset,
    profile: session.profile,
    persona,
    turns: transcript.turns,
    durationSecs: transcript.durationSecs,
    endedBy: transcript.endedBy,
    selfReview: session.selfReview,
    speech,
    voice,
    tone,
    perTurn,
  });
  const { analysis, droppedQuotes } = verifyAnalysis(raw, transcript.turns);

  const traineeWords = wordCount(transcript.turns, "trainee");
  const prospectWords = wordCount(transcript.turns, "prospect");
  const report: StoredReport = {
    version: 1,
    createdAt: Date.now(),
    analysis,
    persona,
    transcript: transcript.turns,
    selfReview: session.selfReview,
    hasRecording: Boolean(audio),
    meta: {
      durationSecs: transcript.durationSecs,
      endedBy: transcript.endedBy,
      droppedQuotes,
      traineeWords,
      prospectWords,
      traineeWordShare: traineeWords + prospectWords ? Math.round((traineeWords / (traineeWords + prospectWords)) * 100) / 100 : 0,
    },
    metrics: { speech, voice, tone },
  };

  db.update(sessions).set({ report: JSON.stringify(report), status: "done" }).where(eq(sessions.id, sessionId)).run();
}
