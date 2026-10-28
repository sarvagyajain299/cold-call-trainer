import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessions } from "@/db/schema";

const body = z.object({ text: z.string().trim().max(4000) });

export async function POST(request: Request, ctx: RouteContext<"/api/call/[id]/review">) {
  const { id } = await ctx.params;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Review text required" }, { status: 400 });

  const result = db.update(sessions).set({ selfReview: parsed.data.text || null }).where(eq(sessions.id, id)).run();
  if (result.changes === 0) return Response.json({ error: "Session not found" }, { status: 404 });
  return Response.json({ ok: true });
}
