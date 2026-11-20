import { z } from "zod";
import { generateLessons } from "@/lib/lessons/generate";

const body = z.object({ reportId: z.string().min(1) });

// Makes the lessons the first time they are opened. Later calls return the saved ones (never regenerates).
export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "reportId required" }, { status: 400 });
  try {
    const lessons = await generateLessons(parsed.data.reportId);
    return Response.json({ lessons });
  } catch (err) {
    console.error("lesson generation failed", err);
    const message = err instanceof Error ? err.message : "Could not write the lessons.";
    return Response.json({ error: message }, { status: 502 });
  }
}
