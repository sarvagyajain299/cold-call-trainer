import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessions } from "@/db/schema";
import { buildAgentPrompt, type Difficulty, type Persona } from "@/lib/persona";
import { pickVoice } from "@/lib/voices";

const body = z.object({ sessionId: z.string().min(1) });

export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "sessionId required" }, { status: 400 });

  const session = db.select().from(sessions).where(eq(sessions.id, parsed.data.sessionId)).get();
  if (!session) return Response.json({ error: "Session not found" }, { status: 404 });
  if (session.status !== "setup") {
    return Response.json({ error: "This call has already been started" }, { status: 409 });
  }
  if (!session.persona) return Response.json({ error: "The prospect is not ready yet" }, { status: 425 });

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  if (!apiKey || !agentId) return Response.json({ error: "ElevenLabs is not configured" }, { status: 500 });

  const persona = JSON.parse(session.persona) as Persona;
  const difficulty = session.difficulty as Difficulty;

  const urlRes = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`,
    { headers: { "xi-api-key": apiKey } },
  );
  if (!urlRes.ok) {
    console.error("elevenlabs signed url failed", urlRes.status);
    return Response.json({ error: "Could not open the call line." }, { status: 502 });
  }
  const { signed_url: signedUrl } = (await urlRes.json()) as { signed_url: string };

  // Only the call that flips setup -> live may proceed, so a double click cannot start two calls.
  const claimed = db
    .update(sessions)
    .set({ status: "live" })
    .where(and(eq(sessions.id, session.id), eq(sessions.status, "setup")))
    .run();
  if (claimed.changes === 0) {
    return Response.json({ error: "This call has already been started" }, { status: 409 });
  }

  // The first-message override is rejected by ElevenLabs, so the agent's first message is the
  // dynamic variable {{pickup_line}} and each call fills it in.
  return Response.json({
    signedUrl,
    dynamicVariables: { pickup_line: persona.pickupLine },
    overrides: {
      agent: {
        prompt: { prompt: buildAgentPrompt(persona, difficulty) },
        language: "en",
      },
      tts: { voiceId: pickVoice(persona) },
    },
  });
}
