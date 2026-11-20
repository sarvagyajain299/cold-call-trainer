import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { transcribeAnswer } from "@/lib/deepgram";

const MAX_BYTES = 10 * 1024 * 1024;

// A spoken practice answer: saved to recordings/practice/<id>.webm, then transcribed by Deepgram.
// The id is reused as the attempt id when the answer is checked.
export async function POST(request: Request) {
  const buf = Buffer.from(await request.arrayBuffer());
  if (buf.length === 0) return Response.json({ error: "Empty recording" }, { status: 400 });
  if (buf.length > MAX_BYTES) return Response.json({ error: "Recording too large" }, { status: 413 });

  const audioId = randomUUID();
  const dir = path.join(process.cwd(), "recordings", "practice");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${audioId}.webm`), buf);

  try {
    const contentType = request.headers.get("content-type")?.split(";")[0] || "audio/webm";
    const answer = await transcribeAnswer(buf, contentType);
    return Response.json({ audioId, transcript: answer.text, durationSec: answer.durationSec, speakingSec: answer.speakingSec });
  } catch (err) {
    console.error("practice transcription failed", err instanceof Error ? err.message : err);
    return Response.json({ error: "Couldn't hear that one. Try again, or type it." }, { status: 502 });
  }
}
