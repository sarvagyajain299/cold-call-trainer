import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions } from "@/db/schema";
import { generateReportFor } from "@/lib/scoring";

export async function POST(_request: Request, ctx: RouteContext<"/api/report/[id]">) {
  const { id } = await ctx.params;
  const session = db.select().from(sessions).where(eq(sessions.id, id)).get();
  if (!session) return Response.json({ error: "Session not found" }, { status: 404 });
  if (session.report) return Response.json({ ok: true });
  if (!session.conversationId) {
    return Response.json({ error: "This call has not been recorded yet." }, { status: 409 });
  }

  try {
    await generateReportFor(id);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("report generation failed", err);
    const message = err instanceof Error ? err.message : "Could not score this call.";
    return Response.json({ error: message }, { status: 502 });
  }
}
