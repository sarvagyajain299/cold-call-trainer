export type Turn = {
  role: "trainee" | "prospect";
  text: string;
  /** Non-verbal cues ElevenLabs adds to the prospect's voice, e.g. "sighs", "annoyed". */
  cues: string[];
  /** Seconds from the start of the call. */
  t: number;
};

type ApiTurn = { role: string; message?: string | null; time_in_call_secs?: number };

const TAG = /\[([^\]]{1,40})\]/g;

export function cleanTurn(raw: string): { text: string; cues: string[] } {
  const cues: string[] = [];
  const text = raw
    .replace(TAG, (_, cue: string) => {
      cues.push(cue.trim().toLowerCase());
      return " ";
    })
    .replace(/\s+/g, " ")
    .trim();
  return { text, cues };
}

export function toTurns(items: ApiTurn[]): Turn[] {
  const turns: Turn[] = [];
  for (const item of items) {
    if (item.role !== "agent" && item.role !== "user") continue;
    const { text, cues } = cleanTurn(item.message ?? "");
    if (!text) continue; // ElevenLabs sometimes logs empty trailing turns
    turns.push({
      role: item.role === "agent" ? "prospect" : "trainee",
      text,
      cues,
      t: Math.round((item.time_in_call_secs ?? 0) * 10) / 10,
    });
  }
  return turns;
}

export async function fetchTranscript(conversationId: string): Promise<{ turns: Turn[]; durationSecs: number; endedBy: string }> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ELEVENLABS_API_KEY is not set");

  const res = await fetch(`https://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(conversationId)}`, {
    headers: { "xi-api-key": key },
  });
  if (!res.ok) throw new Error(`ElevenLabs transcript request failed (${res.status})`);
  const data = (await res.json()) as {
    transcript?: ApiTurn[];
    metadata?: { call_duration_secs?: number; termination_reason?: string };
  };

  return {
    turns: toTurns(data.transcript ?? []),
    durationSecs: data.metadata?.call_duration_secs ?? 0,
    endedBy: data.metadata?.termination_reason ?? "unknown",
  };
}

export function formatTranscript(turns: Turn[]): string {
  return turns
    .map((t) => {
      const who = t.role === "trainee" ? "TRAINEE" : "PROSPECT";
      const cues = t.cues.length ? ` (${t.cues.join(", ")})` : "";
      return `[${t.t.toFixed(0)}s] ${who}${cues}: ${t.text}`;
    })
    .join("\n");
}
