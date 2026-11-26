"use client";

import { useEffect, useRef, useState } from "react";
import type { SimCostPoint } from "@/lib/simulator";

const W = 660;
const H = 250;
const PAD_L = 56;
const PAD_R = 18;
const PAD_T = 22;
const PAD_B = 36;
const INNER_W = W - PAD_L - PAD_R;
const INNER_H = H - PAD_T - PAD_B;

const fmtMoney = (v: number) =>
  v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function monthLabel(month: string): string {
  return new Date(`${month}-01`).toLocaleString("en-US", { month: "short", year: "2-digit" });
}

function pathLength(pts: Array<{ x: number; y: number }>): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  return len || 1;
}

export default function CostTrendChart({ points }: { points: SimCostPoint[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [drawn, setDrawn] = useState(0);
  const [tip, setTip] = useState<{ x: number; y: number; point: SimCostPoint } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setDrawn(1);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 1050);
      setDrawn(t);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!points.length) {
    return <p className="muted text-[12px]">No cost data yet.</p>;
  }

  const max = Math.max(...points.map((p) => p.spend), 1);
  const toX = (i: number) => PAD_L + (i / Math.max(1, points.length - 1)) * INNER_W;
  const toY = (v: number) => PAD_T + INNER_H - (v / max) * INNER_H;
  const linePath = `M ${points.map((p, i) => `${toX(i)},${toY(p.spend)}`).join(" ")}`;
  const areaPath = `${linePath} L ${toX(points.length - 1)},${H - PAD_B} L ${toX(0)},${H - PAD_B} Z`;
  const len = pathLength(points.map((p, i) => ({ x: toX(i), y: toY(p.spend) })));

  const current = points[points.length - 1];
  const prev = points[points.length - 2];
  const delta = prev ? ((current.spend - prev.spend) / prev.spend) * 100 : 0;

  const yTicks = [max, Math.round(max / 2), 0];
  const xLabels = [0, Math.floor(points.length / 2), points.length - 1].filter(
    (v, idx, arr) => arr.indexOf(v) === idx,
  );

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const box = wrapRef.current?.getBoundingClientRect();
    if (!box || points.length < 2) return;
    const x = Math.max(0, Math.min(1, (e.clientX - box.left) / box.width));
    let best = 0;
    for (let i = 1; i < points.length; i++) {
      const d = Math.abs((i / (points.length - 1)) - x);
      if (d < Math.abs((best / (points.length - 1)) - x)) best = i;
    }
    setTip({ x: x * box.width, y: -12, point: points[best] });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-2">
        <span className="num text-[18px] font-600 text-[#0a0a0a]">{fmtMoney(current.spend)}</span>
        <span className="muted text-[11px]">this month</span>
        {delta !== 0 && (
          <span className={`change ${delta > 0 ? "change-positive" : "change-negative"}`}>
            {delta > 0 ? "+" : ""}
            {delta.toFixed(1)}% vs previous month
          </span>
        )}
      </div>

      <div ref={wrapRef} className="relative w-full" onMouseMove={onMouseMove} onMouseLeave={() => setTip(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full h-auto" role="img" aria-label="Monthly cloud cost trend">
          {yTicks.map((v) => (
            <line key={v} className="trend-grid" x1={PAD_L - 2} y1={toY(v)} x2={W - PAD_R} y2={toY(v)} />
          ))}
          {yTicks.map((v) => (
            <text
              key={`${v}`}
              x={PAD_L - 6}
              y={toY(v) + 3}
              textAnchor="end"
              className="trend-axis"
              fontSize="11"
            >
              {fmtMoney(v)}
            </text>
          ))}
          <path d={areaPath} fill="currentColor" fillOpacity="0.06" stroke="none" />
          <path
            d={linePath}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray={len}
            strokeDashoffset={len * (1 - drawn)}
          />
          {points.map((p, i) => (
            <circle key={p.month} cx={toX(i)} cy={toY(p.spend)} r={4} fill="currentColor" style={{ opacity: drawn }} />
          ))}
          {xLabels.map((i) => (
            <text
              key={points[i].month}
              x={toX(i)}
              y={H - PAD_B + 16}
              textAnchor="middle"
              className="trend-axis"
              fontSize="11"
            >
              {monthLabel(points[i].month)}
            </text>
          ))}
        </svg>
        {tip && (
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-md bg-white border border-[#e6e6e6] px-2 py-1.5 text-[11px] shadow-sm whitespace-nowrap pointer-events-none"
            style={{ left: tip.x, top: tip.y }}
          >
            <div className="font-600 text-[#0a0a0a]">{tip.point.month}</div>
            <div className="text-[#0a0a0a]">{fmtMoney(tip.point.spend)}</div>
            <div className="text-[#6b6b6b]">{tip.point.topService}</div>
          </div>
        )}
      </div>
    </div>
  );
}
