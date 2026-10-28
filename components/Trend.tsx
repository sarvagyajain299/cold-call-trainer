/** Tiny line chart of ratings (0-10), oldest call on the left. Needs at least two scored calls. */
export function Trend({ ratings }: { ratings: number[] }) {
  if (ratings.length < 2) return null;
  const w = 120;
  const h = 32;
  const pad = 4;
  const x = (i: number) => pad + (i * (w - pad * 2)) / (ratings.length - 1);
  const y = (r: number) => h - pad - (Math.min(10, Math.max(0, r)) / 10) * (h - pad * 2);
  const points = ratings.map((r, i) => `${x(i).toFixed(1)},${y(r).toFixed(1)}`).join(" ");
  const first = ratings[0];
  const last = ratings[ratings.length - 1];

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={`Rating over ${ratings.length} calls: ${ratings.join(", ")}`}
      className={last >= first ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}
    >
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(ratings.length - 1)} cy={y(last)} r="3" fill="currentColor" />
    </svg>
  );
}
