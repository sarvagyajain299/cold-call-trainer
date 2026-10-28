import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions } from "@/db/schema";

const MAX_BYTES = 100 * 1024 * 1024;
const recordingPath = (id: string) => path.join(process.cwd(), "recordings", `${id}.webm`);

function sessionExists(id: string) {
  return db.select({ id: sessions.id }).from(sessions).where(eq(sessions.id, id)).get();
}

export async function POST(request: Request, ctx: RouteContext<"/api/call/[id]/audio">) {
  const { id } = await ctx.params;
  const session = sessionExists(id);
  if (!session) return Response.json({ error: "Session not found" }, { status: 404 });

  const buf = Buffer.from(await request.arrayBuffer());
  if (buf.length === 0) return Response.json({ error: "Empty recording" }, { status: 400 });
  if (buf.length > MAX_BYTES) return Response.json({ error: "Recording too large" }, { status: 413 });

  // The id comes from our database (a UUID we generated), so the path cannot escape the folder.
  await mkdir(path.join(process.cwd(), "recordings"), { recursive: true });
  await writeFile(recordingPath(session.id), buf);

  return Response.json({ ok: true, bytes: buf.length });
}

// Plays your recording back in the report. Supports Range so the player can jump to a moment.
export async function GET(request: Request, ctx: RouteContext<"/api/call/[id]/audio">) {
  const { id } = await ctx.params;
  const session = sessionExists(id);
  if (!session) return new Response("Not found", { status: 404 });

  let size: number;
  try {
    size = (await stat(recordingPath(session.id))).size;
  } catch {
    return new Response("No recording", { status: 404 });
  }
  const data = await readFile(recordingPath(session.id));

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
        "Content-Type": "audio/webm",
        "Accept-Ranges": "bytes",
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Content-Length": String(end - start + 1),
      },
    });
  }

  return new Response(new Uint8Array(data), {
    headers: { "Content-Type": "audio/webm", "Accept-Ranges": "bytes", "Content-Length": String(size) },
  });
}
