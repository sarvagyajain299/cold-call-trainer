import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

export const toneSchema = z.object({
  energy: z.number().describe("0-10: vocal energy and liveliness"),
  confidence: z.number().describe("0-10: sounds sure of themselves versus nervous or hesitant"),
  warmth: z.number().describe("0-10: friendly, human, smiling voice versus cold or scripted"),
  easyToFollow: z.number().describe("0-10: how easy this voice is to follow for a native English listener on a phone line"),
  summary: z.string().describe("Two or three sentences on overall delivery"),
  observations: z.array(
    z.object({
      timeSecs: z.number().describe("Seconds from the start of the recording"),
      kind: z.enum(["strength", "issue"]),
      note: z.string().describe("What you hear in the voice at this moment, e.g. 'trails off', 'rushed', 'warm and smiling'"),
    }),
  ),
});

export type Tone = z.infer<typeof toneSchema>;

const MODELS = ["gemini-3.6-flash", "gemini-2.5-flash"];

const PROMPT = `You are an expert voice and sales coach listening to a recording of a trainee making a practice cold call.
The recording contains ONLY the trainee's microphone (the person they called is not audible). Gaps are the prospect speaking.
The trainee is an Indian English speaker calling business owners abroad, and worries that they mumble.
Judge the VOICE, not the sales content: energy, confidence, warmth, enthusiasm versus flatness, nervousness, rushing, trailing off, apologetic tone, sounding scripted, and how easy they are to follow on a phone line.
Give 4 to 10 timestamped observations, a mix of strengths and issues, using seconds from the start of the recording. Be specific and honest.`;

export async function analyzeTone(audio: Buffer): Promise<Tone> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  const ai = new GoogleGenAI({ apiKey: key });
  const data = audio.toString("base64");

  let lastError: unknown;
  for (const model of MODELS) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ inlineData: { mimeType: "audio/webm", data } }, { text: PROMPT }] }],
        config: { responseMimeType: "application/json", responseJsonSchema: z.toJSONSchema(toneSchema) },
      });
      return toneSchema.parse(JSON.parse(res.text ?? ""));
    } catch (err) {
      lastError = err;
      console.error(`tone analysis failed on ${model}`, err);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Tone analysis failed");
}
