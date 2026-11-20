import { readFile, stat } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions } from "@/db/schema";
import { callAudioPath, saveCallAudio } from "@/lib/callAudio";

// The full call (both voices), for the lesson ▶ buttons. Supports Range so a clip can start mid-call.
export async function GET(request: Request, ctx: RouteContext<"/api/call/[id]/call-audio">) {
  const { id } = await ctx.params;
  const session = db.select({ id: sessions.id, conversationId: sessions.conversationId }).from(sessions).where(eq(sessions.id, id)).get();
  if (!session) return new Response("Not found", { status: 404 });

  const file = callAudioPath(session.id);
  let size = await stat(file).then((s) => s.size).catch(() => 0);
  if (!size && session.conversationId && (await saveCallAudio(session.id, session.conversationId, 1))) {
    size = await stat(file).then((s) => s.size).catch(() => 0);
  }
  if (!size) return new Response("No call audio", { status: 404 });
  const data = await readFile(file);

  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    return new Response(new Uint8Array(data.subarray(start, end + 1)), {
      status: 206,
      headers: {
        "Content-Type": "audio/mpeg",
        "Accept-Ranges": "bytes",
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Content-Length": String(end - start + 1),
      },
    });
  }
  return new Response(new Uint8Array(data), {
    headers: { "Content-Type": "audio/mpeg", "Accept-Ranges": "bytes", "Content-Length": String(size) },
  });
}
