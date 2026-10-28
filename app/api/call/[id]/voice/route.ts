import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessions } from "@/db/schema";

const body = z.object({
  samples: z.array(z.tuple([z.number(), z.number(), z.number(), z.number()])).max(60_000),
});

// Pitch and loudness readings taken in your browser during the call.
export async function POST(request: Request, ctx: RouteContext<"/api/call/[id]/voice">) {
  const { id } = await ctx.params;
  const session = db.select({ id: sessions.id }).from(sessions).where(eq(sessions.id, id)).get();
  if (!session) return Response.json({ error: "Session not found" }, { status: 404 });

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid voice data" }, { status: 400 });

  await mkdir(path.join(process.cwd(), "recordings"), { recursive: true });
  await writeFile(path.join(process.cwd(), "recordings", `${session.id}.voice.json`), JSON.stringify(parsed.data));
  return Response.json({ ok: true, samples: parsed.data.samples.length });
}
