/** Small line chart, oldest on the left. Pass the metric's natural range so lines are comparable. */
export function Sparkline({ values, min, max, label, tone }: { values: number[]; min: number; max: number; label: string; tone: "good" | "bad" | "flat" }) {
  if (values.length < 2) return null;
  const w = 160;
  const h = 40;
  const pad = 4;
  const x = (i: number) => pad + (i * (w - pad * 2)) / (values.length - 1);
  const y = (v: number) => h - pad - ((Math.min(max, Math.max(min, v)) - min) / (max - min || 1)) * (h - pad * 2);
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const colour = tone === "good" ? "text-green-600 dark:text-green-400" : tone === "bad" ? "text-red-600 dark:text-red-400" : "text-zinc-500";
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${label} over ${values.length} calls: ${values.join(", ")}`} className={colour}>
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r="3" fill="currentColor" />
    </svg>
  );
}
