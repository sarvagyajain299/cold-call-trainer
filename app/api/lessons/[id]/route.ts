import { z } from "zod";
import { completeLesson, finishReview, getLesson, updateLesson } from "@/lib/lessons/store";

const body = z.object({
  status: z.enum(["not_started", "in_progress", "done", "skipped"]).optional(),
  screen: z.number().int().min(0).max(10).optional(),
  gutPick: z.string().max(40).optional(),
  skippedScreen: z.number().int().min(0).max(10).optional(),
  /** Ends a review visit: the attempts made during it set the next review date. */
  reviewDone: z.array(z.string()).max(10).optional(),
});

export async function PATCH(request: Request, ctx: RouteContext<"/api/lessons/[id]">) {
  const { id } = await ctx.params;
  const lesson = getLesson(id);
  if (!lesson) return Response.json({ error: "Lesson not found" }, { status: 404 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const p = parsed.data;

  if (p.reviewDone) {
    finishReview(lesson, p.reviewDone);
    return Response.json({ ok: true });
  }

  if (p.status === "done") completeLesson(lesson);
  else if (p.status && lesson.status !== "done") {
    // A finished lesson stays finished; revisiting it does not reset its review dates.
    updateLesson(id, { status: p.status, ...(p.status === "skipped" ? { nextReviewAt: null } : {}) });
  }

  const patch: Parameters<typeof updateLesson>[1] = {};
  if (p.screen !== undefined) patch.screen = p.screen;
  if (p.gutPick !== undefined) patch.gutPick = p.gutPick;
  if (p.skippedScreen !== undefined && !lesson.data.skipped.includes(p.skippedScreen)) {
    patch.data = JSON.stringify({ ...lesson.data, skipped: [...lesson.data.skipped, p.skippedScreen] });
  }
  if (Object.keys(patch).length) updateLesson(id, patch);
  return Response.json({ ok: true });
}
