/** One reading from the browser every ~100 ms: [seconds, rmsDb, pitchHz (0 = unvoiced), pitchClarity 0-1]. */
export type VoiceSample = [number, number, number, number];

export type VoiceSummary = {
  samples: number;
  speakingSecs: number;
  avgPitchHz: number;
  /** Standard deviation of pitch in semitones. Lively speech is roughly 3 or more; flat speech is under 1.5. */
  pitchVariationSemitones: number;
  /** 0-100, higher means flatter. */
  monotoneScore: number;
  /** Loud-versus-quiet range in dB (p90 minus p10 of speaking frames). */
  dynamicRangeDb: number;
  /** Share of sentences whose last part fades by 4 dB or more. */
  trailingOffShare: number;
  /** Share of sentences ending on a rising pitch. */
  risingEndShare: number;
  sentences: number;
  /** Average volume and pitch per 15 second block of the call. */
  timeline: { startSecs: number; avgDb: number; avgPitchHz: number }[];
};

const SEGMENT_GAP_SECS = 0.35;
const MIN_SEGMENT_SECS = 1.0;
const BUCKET_SECS = 15;

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const percentile = (xs: number[], p: number) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};
const std = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};
const r1 = (n: number) => Math.round(n * 10) / 10;

export function summarizeVoice(samples: VoiceSample[]): VoiceSummary {
  const empty: VoiceSummary = {
    samples: samples.length, speakingSecs: 0, avgPitchHz: 0, pitchVariationSemitones: 0, monotoneScore: 0,
    dynamicRangeDb: 0, trailingOffShare: 0, risingEndShare: 0, sentences: 0, timeline: [],
  };
  if (samples.length < 20) return empty;

  // Anything clearly above the room's noise floor counts as speaking.
  const floor = percentile(samples.map((s) => s[1]), 0.1);
  const threshold = floor + 10;
  const frameSecs = (samples[samples.length - 1][0] - samples[0][0]) / (samples.length - 1);
  const speaking = samples.filter((s) => s[1] > threshold);
  if (speaking.length < 10) return empty;

  const voiced = speaking.filter((s) => s[2] > 60 && s[2] < 500 && s[3] >= 0.85);
  const meanHz = mean(voiced.map((s) => s[2]));
  const semis = (hz: number) => 12 * Math.log2(hz / meanHz);
  const variation = voiced.length >= 10 ? std(voiced.map((s) => semis(s[2]))) : 0;
  const monotone = voiced.length >= 10 ? Math.min(100, Math.max(0, Math.round(((3.5 - variation) / 2.5) * 100))) : 0;

  const dbs = speaking.map((s) => s[1]);

  // Split into sentences: runs of speech separated by a short silence.
  const segments: VoiceSample[][] = [];
  let current: VoiceSample[] = [];
  let lastSpeechT = -Infinity;
  for (const s of samples) {
    if (s[1] > threshold) {
      if (current.length && s[0] - lastSpeechT > SEGMENT_GAP_SECS) {
        segments.push(current);
        current = [];
      }
      current.push(s);
      lastSpeechT = s[0];
    }
  }
  if (current.length) segments.push(current);
  const sentences = segments.filter((seg) => seg.length * frameSecs >= MIN_SEGMENT_SECS);

  let fading = 0;
  let rising = 0;
  for (const seg of sentences) {
    const cut = Math.floor(seg.length * 0.8);
    const body = mean(seg.slice(0, cut).map((s) => s[1]));
    const tail = mean(seg.slice(cut).map((s) => s[1]));
    if (body - tail >= 4) fading++;

    const endFrames = Math.max(3, Math.round(0.3 / frameSecs));
    const lead = seg.slice(-endFrames * 2, -endFrames).filter((s) => s[2] > 60 && s[3] >= 0.85);
    const end = seg.slice(-endFrames).filter((s) => s[2] > 60 && s[3] >= 0.85);
    if (lead.length >= 2 && end.length >= 2 && meanHz > 0) {
      if (semis(median(end.map((s) => s[2]))) - semis(median(lead.map((s) => s[2]))) > 1.5) rising++;
    }
  }

  const timeline: VoiceSummary["timeline"] = [];
  const t0 = samples[0][0];
  for (let start = t0; start <= samples[samples.length - 1][0]; start += BUCKET_SECS) {
    const inBucket = speaking.filter((s) => s[0] >= start && s[0] < start + BUCKET_SECS);
    if (!inBucket.length) continue;
    const bucketPitch = inBucket.filter((s) => s[2] > 60 && s[3] >= 0.85).map((s) => s[2]);
    timeline.push({
      startSecs: Math.round(start),
      avgDb: r1(mean(inBucket.map((s) => s[1]))),
      avgPitchHz: Math.round(mean(bucketPitch)),
    });
  }

  return {
    samples: samples.length,
    speakingSecs: r1(speaking.length * frameSecs),
    avgPitchHz: Math.round(meanHz),
    pitchVariationSemitones: r1(variation),
    monotoneScore: monotone,
    dynamicRangeDb: r1(percentile(dbs, 0.9) - percentile(dbs, 0.1)),
    trailingOffShare: sentences.length ? Math.round((fading / sentences.length) * 100) / 100 : 0,
    risingEndShare: sentences.length ? Math.round((rising / sentences.length) * 100) / 100 : 0,
    sentences: sentences.length,
    timeline,
  };
}
