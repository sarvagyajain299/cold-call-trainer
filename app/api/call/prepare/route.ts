import { desc, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { presets, sessions } from "@/db/schema";
import { generatePersona, rollDials, type Difficulty, type Persona } from "@/lib/persona";

const body = z.object({ sessionId: z.string().min(1) });

// One generation per session, even if the page asks twice (React strict mode, a retry, a double click).
const inFlight = new Map<string, Promise<void>>();

async function ensurePersona(sessionId: string): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const session = db.select().from(sessions).where(eq(sessions.id, sessionId)).get();
  if (!session) return { ok: false, status: 404, error: "Session not found" };
  if (session.persona) return { ok: true };
  if (session.status !== "setup") return { ok: false, status: 409, error: "This call has already been started" };

  const preset = db.select().from(presets).where(eq(presets.id, session.presetId)).get();
  if (!preset) return { ok: false, status: 404, error: "Project not found" };

  const difficulty = session.difficulty as Difficulty;
  const recent = db
    .select({ persona: sessions.persona })
    .from(sessions)
    .where(isNotNull(sessions.persona))
    .orderBy(desc(sessions.createdAt))
    .limit(8)
    .all()
    .map((r) => JSON.parse(r.persona as string) as Persona)
    .map((p) => ({
      name: p.name,
      role: p.role,
      city: p.city,
      situation: `${p.situation.where}, ${p.situation.doing}`,
      mood: p.emotion.moodNow,
    }));

  let job = inFlight.get(sessionId);
  if (!job) {
    job = (async () => {
      const persona = await generatePersona({
        preset,
        profile: session.profile,
        difficulty,
        dials: rollDials(difficulty),
        recent,
      });
      db.update(sessions).set({ persona: JSON.stringify(persona) }).where(eq(sessions.id, sessionId)).run();
    })().finally(() => inFlight.delete(sessionId));
    inFlight.set(sessionId, job);
  }

  try {
    await job;
    return { ok: true };
  } catch (err) {
    console.error("persona generation failed", err);
    return { ok: false, status: 502, error: "Could not prepare the prospect. Try again." };
  }
}

export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "sessionId required" }, { status: 400 });

  const result = await ensurePersona(parsed.data.sessionId);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  // The persona is never sent to the browser before the report.
  return Response.json({ ready: true });
}
