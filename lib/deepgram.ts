// Deepgram speech-to-text: word timings for scorecards, and short practice answers for lessons.
import type { DgWord } from "@/lib/speechMetrics";

type DgResponse = {
  results?: { channels?: { alternatives?: { words?: { word: string; start: number; end: number; confidence: number }[] }[] }[] };
};

/** Word-level transcript with confidence for the trainee's recorded microphone. */
export async function transcribeWords(audio: Buffer): Promise<DgWord[]> {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) throw new Error("DEEPGRAM_API_KEY is not set");

  const call = (params: string) =>
    fetch(`https://api.deepgram.com/v1/listen?${params}`, {
      method: "POST",
      headers: { Authorization: `Token ${key}`, "Content-Type": "audio/webm" },
      body: new Uint8Array(audio),
    });

  // filler_words keeps "um" and "uh" in the transcript; fall back if the model rejects it.
  let res = await call("model=nova-3&language=en&punctuate=false&filler_words=true");
  if (res.status === 400) res = await call("model=nova-3&language=en&punctuate=false");
  if (!res.ok) throw new Error(`Deepgram request failed (${res.status})`);

  const data = (await res.json()) as DgResponse;
  const words = data.results?.channels?.[0]?.alternatives?.[0]?.words ?? [];
  return words.map((w) => ({ word: w.word, start: w.start, end: w.end, confidence: w.confidence }));
}

export type Answer = {
  text: string;
  /** First word start to last word end, in seconds. 0 if no words were heard. */
  speakingSec: number;
  /** Length of the whole recording, in seconds. */
  durationSec: number;
};

/** A short spoken practice answer, punctuated, for the lesson coach. */
export async function transcribeAnswer(audio: Buffer, contentType = "audio/webm"): Promise<Answer> {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) throw new Error("DEEPGRAM_API_KEY is not set");

  const res = await fetch("https://api.deepgram.com/v1/listen?model=nova-3&language=en&punctuate=true&smart_format=true", {
    method: "POST",
    headers: { Authorization: `Token ${key}`, "Content-Type": contentType },
    body: new Uint8Array(audio),
  });
  if (!res.ok) throw new Error(`Deepgram request failed (${res.status})`);

  const data = (await res.json()) as DgResponse & {
    metadata?: { duration?: number };
    results?: { channels?: { alternatives?: { transcript?: string }[] }[] };
  };
  const alt = data.results?.channels?.[0]?.alternatives?.[0] as { transcript?: string; words?: { start: number; end: number }[] } | undefined;
  const words = alt?.words ?? [];
  return {
    text: (alt?.transcript ?? "").trim(),
    speakingSec: words.length ? Math.max(0, words[words.length - 1].end - words[0].start) : 0,
    durationSec: data.metadata?.duration ?? 0,
  };
}
