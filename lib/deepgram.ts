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
