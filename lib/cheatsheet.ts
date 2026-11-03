import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, PERSONA_MODEL } from "@/lib/anthropic";
import { logUsage } from "@/lib/usage";
import { generatedSchema, type Generated } from "@/lib/sheetModel";
import type { Preset } from "@/db/schema";

const SYSTEM = `You write a cold-calling cheat sheet for a trainee who is new to cold calling and will phone small-business owners in the US, UK, Australia, Europe and the Gulf. The trainee is an Indian professional based in Dubai and worries about mumbling, so everything must be easy to say slowly and clearly.
Rules:
- Short phrases and keywords, never full scripts. If it sounds scripted, it fails.
- Plain words a busy owner understands on the first hearing. No jargon, no buzzwords.
- Base everything on the offer you are given. Do NOT invent statistics, client names, case studies or results. If the offer text gives no proof, write a placeholder such as "Add a real result here".
- The sheet is about the trainee's offer only. Never refer to any specific prospect.
- For objections, "they" is the words the prospect says; "you" is a short reply that acknowledges first and then asks a question or moves forward.`;

export async function generateForPreset(preset: Preset): Promise<Generated> {
  const user = `Project: ${preset.name}
What they sell: ${preset.offer}
Price: ${preset.price || "not specified"}
Ideal customer: ${preset.idealCustomer || "not specified"}
Goal of the call: ${preset.callGoal}

Write the cheat sheet content.`;
  const res = await anthropic.messages.parse({
    model: PERSONA_MODEL,
    max_tokens: 4000,
    system: SYSTEM,
    messages: [{ role: "user", content: user }],
    output_config: { effort: "low", format: zodOutputFormat(generatedSchema) },
  });
  await logUsage(null, `cheatsheet:${preset.id}`, PERSONA_MODEL, res.usage);
  if (res.stop_reason === "refusal" || !res.parsed_output) throw new Error("The cheat sheet could not be generated");
  return res.parsed_output;
}
