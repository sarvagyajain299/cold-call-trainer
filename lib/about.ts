// Plain-language explanation of every progress metric, shown on the progress detail pages.
// Keep in step with how the numbers are really produced (lib/compare.ts, speechMetrics.ts, voiceMetrics.ts, report.ts).

export type MetricAbout = { what: string; how: string; affects: string };

const stageAbout = (what: string, affects: string): MetricAbout => ({
  what,
  how: "Scored 0-10 by the AI coach (Claude Opus 5.5) after reading the transcript, using the coaching rubric for this stage. It is a judgement, not a formula, so a one-point difference between two calls can just be noise.",
  affects,
});

export const ABOUT: Record<string, MetricAbout> = {
  rating: {
    what: "The coach's overall grade for the whole call, from 0 to 10.",
    how: "Scored by the AI coach (Claude Opus 5.5) against the coaching rubric and a calibration guide, after it has read the transcript, your voice measurements and the hidden details of the prospect. It is not an average of the other scores.",
    affects:
      "Everything in the call: the opener, the quality of your questions, how you handled objections, whether you asked for the next step, and how you sounded. A very short call (for example a hang-up) limits what is possible.",
  },
  conversion: {
    what: "The coach's estimate of how likely this call was to reach its goal, or a firm step towards it, from 0 to 100%.",
    how: "An estimate by the AI coach, not a measurement. It weighs how you performed against the prospect's hidden situation: their mood, their real need and how well your offer fitted them.",
    affects:
      "A tough or poor-fit prospect keeps it low even if you did well; a warm, good-fit prospect can keep it high even after a weak call. That is why it moves more than your skills do. Treat it as a rough guide.",
  },
  stage_opener: stageAbout(
    "The first 10-20 seconds: greeting, getting their name right, saying who you are and why you are calling.",
    "Using the right name, a calm and slow first sentence, a clear reason for the call in plain words, and pausing so they can answer.",
  ),
  stage_reason_for_call: stageAbout(
    "How clearly and quickly you said why you were calling and why it matters to them.",
    "A short, specific reason tied to their business, without jargon or a long preamble.",
  ),
  stage_discovery: stageAbout(
    "How well you found out about their situation and needs before pitching.",
    "Open questions, listening to the answers, following up on what they say, and not rushing to your pitch.",
  ),
  stage_value_pitch: stageAbout(
    "How clearly you explained what you offer and what it does for them.",
    "Linking the offer to a problem they told you about, plain language, and keeping it short.",
  ),
  stage_objection_handling: stageAbout(
    "How you responded to brush-offs and objections such as 'not interested' or 'send me an email'.",
    "Staying calm, acknowledging first, asking a question to understand the real reason, and not arguing or giving up at the first no.",
  ),
  stage_close: stageAbout(
    "Whether you asked for a clear next step and made it easy to agree.",
    "Asking for something specific, with a day and time, and confirming contact details. 'Send me info' without a firm follow-up scores low.",
  ),
  goal_clarity: {
    what: "Whether the purpose of the call and your ask were clear to the prospect.",
    how: "Scored 0-10 by the AI coach from the transcript.",
    affects: "Stating the goal of the call plainly and asking for it directly, rather than drifting or leaving them unsure what you want.",
  },
  call_control: {
    what: "How well you led the conversation instead of being led by it.",
    how: "Scored 0-10 by the AI coach from the transcript.",
    affects: "Steering back after a derail, answering a question and then asking one of your own, and managing time and the order of the call.",
  },
  energy: {
    what: "How lively and engaged you sounded.",
    how: "Scored 0-10 by the AI coach, who blends the notes of an AI that listened to your recording with measurements of your loudness and pitch variation.",
    affects: "Pitch variety, volume, pace and how much you smile in your voice. A flat or quiet voice scores lower.",
  },
  confidence: {
    what: "How sure of yourself you sounded.",
    how: "Scored 0-10 by the AI coach from the listener's notes of the recording plus measurements.",
    affects: "Sentences that trail off, statements ending on a rising pitch like a question, apologetic wording, hesitation and long pauses before answers.",
  },
  warmth: {
    what: "How friendly and personable you sounded.",
    how: "Scored 0-10 by the AI coach from the listener's notes of the recording.",
    affects: "Tone, small human touches, matching the prospect's mood, and not sounding scripted or rushed.",
  },
  voice_clarity: {
    what: "How easy you were to follow, as judged by the coach.",
    how: "Scored 0-10 by the AI coach from the listener's notes plus the measured 'words understood clearly' and pace.",
    affects: "Mumbling, speaking too fast, dropping the ends of words, an accent that is harder for the listener, and background noise.",
  },
  pace: {
    what: "How fast you speak, in words per minute while you are actually talking.",
    how: "Measured from your recording. Deepgram transcribes it, then the words counted are divided by the time you were speaking, with long pauses left out. About 145 wpm is the reference used here; much faster makes you harder to follow, much slower can sound unsure.",
    affects: "Nerves speed it up. Reading a script, rushing the opener and fear of being cut off all push it higher.",
  },
  clear_words: {
    what: "The share of your words that a speech-recognition engine understood with confidence. It is a measurable stand-in for 'do people ask me to repeat myself'.",
    how: "Measured from your recording. Deepgram gives each word a confidence from 0 to 1. Words below 0.75 count as unclear, and this is the percentage that were not.",
    affects: "Mumbling, speaking too fast, a distant or poor microphone, background noise, and unusual accents or words. Slowing down and finishing each word usually lifts it quickly.",
  },
  fillers: {
    what: "How often you say filler sounds such as um, uh, er and hmm, per minute of speaking.",
    how: "Measured from your recording. Deepgram's transcript is searched for um, uh, uhm, umm, er, erm, hmm and mm, and the count is divided by your speaking time.",
    affects: "Thinking while talking, nerves and not knowing your next line. A silent pause is better than a filler. The transcript engine can miss some fillers, so treat it as a trend.",
  },
  trailing_off: {
    what: "The share of your sentences where your voice fades away at the end.",
    how: "Measured from your microphone. A sentence is a stretch of speech of at least a second; it counts as trailing off if its last fifth is 4 dB or more quieter than the rest of it. Only available when the microphone readings were captured.",
    affects: "Running out of breath, losing confidence mid-sentence, and turning your head or the microphone away. It is a common cause of being asked to repeat yourself.",
  },
  monotone: {
    what: "How flat your voice was. Lower is livelier.",
    how: "Measured from your microphone. It tracks how much your pitch moves around across the call: about 3.5 semitones of variation or more scores 0, and 1 or less scores 100. Only available when the microphone readings were captured.",
    affects: "Reading from a script, nerves, tiredness and speaking in one tone. Emphasising key words and varying your pitch lowers it.",
  },
  talk_share: {
    what: "Your share of all the words spoken on the call.",
    how: "Measured from the transcript: your words divided by your words plus the prospect's. About 45% is the reference used here (a rule of thumb, not a law).",
    affects: "Pitching for a long time raises it; asking questions and letting the prospect talk lowers it. Too high usually means a monologue; very low can mean you did not lead.",
  },
};
