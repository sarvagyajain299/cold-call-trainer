import { eq } from "drizzle-orm";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessions } from "@/db/schema";
import { saveCallAudio } from "@/lib/callAudio";

const body = z.object({ conversationId: z.string().min(1), sheetShown: z.boolean().optional() });

export async function POST(request: Request, ctx: RouteContext<"/api/call/[id]/end">) {
  const { id } = await ctx.params;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "conversationId required" }, { status: 400 });

  const result = db
    .update(sessions)
    .set({
      conversationId: parsed.data.conversationId,
      status: "scoring",
      ...(parsed.data.sheetShown === undefined ? {} : { sheetShown: parsed.data.sheetShown ? 1 : 0 }),
    })
    .where(eq(sessions.id, id))
    .run();
  if (result.changes === 0) return Response.json({ error: "Session not found" }, { status: 404 });

  // Keep a local copy of the full call (both voices) for the lessons. Free; runs after the response is sent.
  const conversationId = parsed.data.conversationId;
  after(async () => {
    if (!(await saveCallAudio(id, conversationId))) console.warn("call audio not saved yet; the lessons will retry");
  });

  return Response.json({ ok: true });
}
