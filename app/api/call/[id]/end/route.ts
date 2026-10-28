import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessions } from "@/db/schema";

const body = z.object({ conversationId: z.string().min(1) });

export async function POST(request: Request, ctx: RouteContext<"/api/call/[id]/end">) {
  const { id } = await ctx.params;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "conversationId required" }, { status: 400 });

  const result = db
    .update(sessions)
    .set({ conversationId: parsed.data.conversationId, status: "scoring" })
    .where(eq(sessions.id, id))
    .run();
  if (result.changes === 0) return Response.json({ error: "Session not found" }, { status: 404 });

  return Response.json({ ok: true });
}
