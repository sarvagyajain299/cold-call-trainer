import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

// The full call (both voices) as ElevenLabs recorded it. Downloading it is free, but ElevenLabs keeps it
// only for a limited time, so a local copy is saved right after each call.

export const callAudioPath = (sessionId: string) => path.join(process.cwd(), "recordings", `${sessionId}.call.mp3`);

export async function hasCallAudio(sessionId: string): Promise<boolean> {
  try {
    return (await stat(callAudioPath(sessionId))).size > 0;
  } catch {
    return false;
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetches GET /v1/convai/conversations/{id}/audio and saves it. The audio can take a few seconds to be
 * ready after a call, so it tries up to `tries` times about 10 s apart. Never throws; returns true when saved.
 */
export async function saveCallAudio(sessionId: string, conversationId: string, tries = 3): Promise<boolean> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return false;
  if (await hasCallAudio(sessionId)) return true;

  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const res = await fetch(`https://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(conversationId)}/audio`, {
        headers: { "xi-api-key": key },
      });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 0) {
          await mkdir(path.dirname(callAudioPath(sessionId)), { recursive: true });
          await writeFile(callAudioPath(sessionId), buf);
          return true;
        }
      } else if (res.status === 404 && attempt === tries) {
        return false;
      }
    } catch (err) {
      console.error("call audio download failed", err instanceof Error ? err.message : err);
    }
    if (attempt < tries) await wait(10_000);
  }
  return false;
}
