"use client";

import Link from "next/link";
import { useState } from "react";
import type { Point } from "@/lib/progress";

const DIFF_COLOUR: Record<string, string> = {
  easy: "#16a34a",
  realistic: "#2563eb",
  brutal: "#dc2626",
};

const when = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function MetricChart({
  points,
  min,
  max,
  unit,
  target,
  label,
}: {
  points: Point[];
  min: number;
  max: number;
  unit: string;
  target?: number;
  label: string;
}) {
  const [sel, setSel] = useState(points.length - 1);
  const W = 640;
  const H = 260;
  const padL = 36;
  const padR = 14;
  const padT = 14;
  const padB = 26;
  const x = (i: number) => (points.length === 1 ? (W + padL) / 2 : padL + (i * (W - padL - padR)) / (points.length - 1));
  const y = (v: number) => padT + (1 - (Math.min(max, Math.max(min, v)) - min) / (max - min || 1)) * (H - padT - padB);
  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const ticks = [min, (min + max) / 2, max];
  const p = points[sel];
  const prev = sel > 0 ? points[sel - 1] : null;
  const fmt = (v: number) => (unit === "/10" || unit === "/100" ? `${v}` : `${v}${unit}`);

  return (
    <div className="flex flex-col gap-4">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label} over ${points.length} calls`} className="w-full rounded-lg border">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="currentColor" strokeOpacity="0.15" />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="currentColor" fillOpacity="0.6">{t}</text>
          </g>
        ))}
        {target !== undefined && (
          <g>
            <line x1={padL} x2={W - padR} y1={y(target)} y2={y(target)} stroke="currentColor" strokeOpacity="0.5" strokeDasharray="4 4" />
            <text x={W - padR} y={y(target) - 4} textAnchor="end" fontSize="11" fill="currentColor" fillOpacity="0.7">ideal {target}</text>
          </g>
        )}
        <polyline points={line} fill="none" stroke="currentColor" strokeOpacity="0.5" strokeWidth="2" strokeLinejoin="round" />
        {points.map((pt, i) => (
          <g key={pt.sessionId} onClick={() => setSel(i)} className="cursor-pointer">
            <circle cx={x(i)} cy={y(pt.value)} r="16" fill="transparent" />
            <circle cx={x(i)} cy={y(pt.value)} r={i === sel ? 7 : 5} fill={DIFF_COLOUR[pt.difficulty] ?? "#71717a"} stroke="currentColor" strokeWidth={i === sel ? 2 : 0} />
          </g>
        ))}
        <text x={padL} y={H - 6} fontSize="11" fill="currentColor" fillOpacity="0.6">oldest call</text>
        <text x={W - padR} y={H - 6} textAnchor="end" fontSize="11" fill="currentColor" fillOpacity="0.6">newest</text>
      </svg>

      <ul className="flex flex-wrap gap-3 text-xs text-zinc-500">
        {Object.entries(DIFF_COLOUR).map(([d, c]) => (
          <li key={d} className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: c }} />{d}</li>
        ))}
        <li>Tap a point for details.</li>
      </ul>

      {p && (
        <div className="rounded-lg border p-4 text-sm">
          <p className="font-semibold">{fmt(p.value)} · {p.name}</p>
          <p className="text-zinc-500">
            {when.format(p.createdAt)} · {p.difficulty}
            {prev ? ` · ${p.value - prev.value >= 0 ? "+" : ""}${Math.round((p.value - prev.value) * 10) / 10} vs the call before` : ""}
          </p>
          <Link href={`/report/${p.sessionId}`} className="mt-2 inline-block underline">Open this scorecard</Link>
        </div>
      )}
    </div>
  );
}
