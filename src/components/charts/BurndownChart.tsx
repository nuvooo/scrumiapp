"use client";

import { useState } from "react";
import { formatPoints } from "@/lib/format";

export interface BurndownRow {
  label: string;
  ideal: number | null;
  actual: number | null;
}

const COLORS = {
  accent: { stroke: "#7C9CFF", fill: "rgba(124,156,255,0.10)" },
  warn: { stroke: "#F2A65A", fill: "rgba(242,166,90,0.10)" },
} as const;

const W = 880;
const PL = 46;
const PR = 18;
const PT = 18;
const PB = 32;

export function BurndownChart({
  data,
  unit = "SP",
  color = "accent",
  height = 300,
}: {
  data: BurndownRow[];
  unit?: string;
  color?: keyof typeof COLORS;
  height?: number;
}) {
  const [hover, setHover] = useState(-1);
  const H = height;
  const n = data.length;
  if (n === 0) return null;

  const values = data.flatMap((r) => [r.ideal, r.actual]).filter((v): v is number => v !== null);
  const max = Math.max(5, Math.ceil(Math.max(0, ...values) / 4) * 4);
  const step = n > 1 ? (W - PL - PR) / (n - 1) : 0;
  const x = (i: number) => (n > 1 ? PL + i * step : PL + (W - PL - PR) / 2);
  const y = (v: number) => H - PB - (v * (H - PT - PB)) / max;

  const path = (pick: (r: BurndownRow) => number | null) => {
    let d = "";
    data.forEach((r, i) => {
      const v = pick(r);
      if (v === null) return;
      d += (d ? " L " : "M ") + x(i).toFixed(1) + " " + y(v).toFixed(1);
    });
    return d;
  };

  const actualIdx = data.map((r, i) => (r.actual !== null ? i : -1)).filter((i) => i >= 0);
  const fill =
    actualIdx.length > 1
      ? path((r) => r.actual) +
        ` L ${x(actualIdx[actualIdx.length - 1]).toFixed(1)} ${y(0).toFixed(1)} L ${x(actualIdx[0]).toFixed(1)} ${y(0).toFixed(1)} Z`
      : "";

  const yTicks = [0, 1, 2, 3, 4].map((k) => {
    const v = (max * k) / 4;
    return { y: y(v), label: String(Math.round(v)) };
  });

  const labelEvery = Math.max(1, Math.ceil(n / 14));
  const xLabelTop = (((H - PB + 12) / H) * 100).toFixed(2) + "%";
  const stroke = COLORS[color].stroke;

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    if (n < 2) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * (W - PL - PR);
    setHover(Math.max(0, Math.min(n - 1, Math.round(px / step))));
  };

  const tipRow = hover >= 0 ? data[hover] : null;
  const showTip = tipRow !== null && tipRow.actual !== null;

  return (
    <div className="relative mt-[18px]">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full overflow-visible">
        {yTicks.map((t, i) => (
          <line key={i} x1={PL} x2={W - PR} y1={t.y} y2={t.y} stroke="#1C2231" strokeWidth={1} />
        ))}
        {fill && <path d={fill} fill={COLORS[color].fill} />}
        <path d={path((r) => r.ideal)} fill="none" stroke="#6B7590" strokeWidth={1.5} strokeDasharray="6 6" />
        <path
          d={path((r) => r.actual)}
          fill="none"
          stroke={stroke}
          strokeWidth={2.25}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {actualIdx.map((i) => (
          <circle
            key={i}
            cx={x(i)}
            cy={y(data[i].actual as number)}
            r={i === hover ? 5.5 : 3}
            fill="#080B11"
            stroke={stroke}
            strokeWidth={2}
          />
        ))}
        <rect
          x={PL}
          y={0}
          width={W - PL - PR}
          height={H - PB}
          fill="transparent"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(-1)}
        />
      </svg>
      {yTicks.map((t, i) => (
        <div
          key={i}
          className="pointer-events-none absolute left-0 w-[38px] -translate-y-1/2 text-right font-mono text-[10.5px] text-faint"
          style={{ top: `${((t.y / H) * 100).toFixed(2)}%` }}
        >
          {t.label}
        </div>
      ))}
      {data.map((r, i) =>
        i % labelEvery === 0 || i === n - 1 ? (
          <div
            key={i}
            className="pointer-events-none absolute -translate-x-1/2 font-mono text-[10.5px] text-faint"
            style={{ left: `${((x(i) / W) * 100).toFixed(2)}%`, top: xLabelTop }}
          >
            {r.label}
          </div>
        ) : null,
      )}
      {showTip && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 translate-y-[-136%] whitespace-nowrap rounded-[9px] border border-tipline bg-tipbg px-[11px] py-[9px] shadow-tip"
          style={{
            left: `${((x(hover) / W) * 100).toFixed(2)}%`,
            top: `${((y(tipRow.actual as number) / H) * 100).toFixed(2)}%`,
          }}
        >
          <div className="font-mono text-[10.5px] text-muted">{`Tag ${hover + 1} · ${tipRow.label}`}</div>
          <div className="mt-1 text-[13px] font-semibold text-fg">{`${formatPoints(tipRow.actual as number)} ${unit} offen`}</div>
          {tipRow.ideal !== null && (
            <div className="mt-0.5 text-[11.5px] text-muted">{`Ideal: ${Math.round(tipRow.ideal)} ${unit}`}</div>
          )}
        </div>
      )}
    </div>
  );
}

export function ChartLegend({ items }: { items: { type: "dash" | "line" | "square"; color: string; label: string }[] }) {
  return (
    <div className="ml-auto flex gap-[18px] text-xs text-muted">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-[7px]">
          {item.type === "dash" && <span className="w-[18px] border-t-[1.5px] border-dashed" style={{ borderColor: item.color }} />}
          {item.type === "line" && <span className="h-0.5 w-[18px] rounded-sm" style={{ background: item.color }} />}
          {item.type === "square" && <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: item.color }} />}
          {item.label}
        </div>
      ))}
    </div>
  );
}
