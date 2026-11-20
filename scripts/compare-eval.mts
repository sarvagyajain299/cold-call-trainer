// Runs the same practice answers through Sonnet and Opus and prints the feedback side by side.
// Costs real API credit (about $0.09 for 3 answers x 2 models). Logged in llm_usage as "compare_eval".
// Run from the app folder: npx tsx --env-file=.env.local scripts/compare-eval.mts <sessionId> [lessonOrd]
import { evaluateAnswer } from "@/lib/lessons/evaluate";
import { lessonsForSession } from "@/lib/lessons/store";
import { PERSONA_MODEL } from "@/lib/anthropic";

const [sessionId, ord = "1"] = process.argv.slice(2);
if (!sessionId) throw new Error("Usage: compare-eval.mts <sessionId> [lessonOrd]");
const lesson = lessonsForSession(sessionId).find((l) => l.ord === Number(ord));
if (!lesson) throw new Error("No lesson found; open the lessons once to generate them");

const ANSWERS = [
  "We can handle it for you for a monthly retainer of 100 AED, and that covers all the updates and changes.",
  "You won't have to do anything. Any change, just WhatsApp me and I'll do it.",
  "So, um, updates, we can do them, you can also log in yourself, there's a dashboard, it's very easy, or we can make an annual maintenance plan, depends what you need.",
];

console.log(`Lesson ${lesson.ord}: ${lesson.title}\nQuestion: "${lesson.data.practice.prospectQuestion}"\n`);
for (const answer of ANSWERS) {
  const input = { lesson, transcript: answer, wpm: null };
  const [sonnet, opus] = await Promise.all([
    evaluateAnswer(input, { sessionId, kind: "compare_eval" }),
    evaluateAnswer(input, { sessionId, kind: "compare_eval" }, PERSONA_MODEL),
  ]);
  console.log(`ANSWER: "${answer}"`);
  for (const [name, r] of [["SONNET", sonnet], ["OPUS", opus]] as const) {
    console.log(`  ${name} ${r.score}/10: ${r.result.verdict}`);
    for (const c of r.result.checks) console.log(`    ${c.pass ? "PASS" : "FAIL"} ${c.id}: ${c.reason}`);
    console.log(`    tip: ${r.result.tip}`);
  }
  console.log("");
}
