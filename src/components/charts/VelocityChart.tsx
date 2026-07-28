"use client";

import { useState } from "react";
import { formatPoints } from "@/lib/format";
import { ChartLegend } from "./BurndownChart";

export interface VelocityRow {
  sprintName: string;
  velocity: number;
  committed: number;
}

const W = 880;
const H = 300;
const PL = 46;
const PR = 18;
const PT = 18;
const PB = 32;

function shortLabel(name: string): string {
  const m = name.match(/(\d+)/);
  return m ? `S${m[1]}` : name.slice(0, 6);
}

export function VelocityChart({ data, average }: { data: VelocityRow[]; average: number }) {
  const [hover, setHover] = useState(-1);
  if (data.length === 0) return null;

  const vmax = Math.max(8, Math.ceil(Math.max(...data.map((d) => d.velocity), average) / 4) * 4);
  const y = (v: number) => H - PB - (v * (H - PT - PB)) / vmax;
  const slot = (W - PL - PR) / data.length;
  const bw = Math.min(56, slot * 0.52);

  const yTicks = [0, 1, 2, 3, 4].map((k) => {
    const v = (vmax * k) / 4;
    return { y: y(v), label: String(Math.round(v)) };
  });
  const xLabelTop = (((H - PB + 12) / H) * 100).toFixed(2) + "%";
  const hovered = hover >= 0 ? data[hover] : null;

  return (
    <div>
      <div className="flex justify-end">
        <ChartLegend
          items={[
            { type: "square", color: "#7C9CFF", label: "abgeschlossen" },
            { type: "dash", color: "#5EEAD4", label: `Durchschnitt (${formatPoints(average)} SP)` },
          ]}
        />
      </div>
      <div className="relative mt-3.5">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full overflow-visible">
          {yTicks.map((t, i) => (
            <line key={i} x1={PL} x2={W - PR} y1={t.y} y2={t.y} stroke="#1C2231" strokeWidth={1} />
          ))}
          {data.map((d, i) => {
            const cx = PL + i * slot;
            const barX = cx + (slot - bw) / 2;
            return (
              <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(-1)}>
                <rect x={cx} y={PT} width={slot} height={H - PT - PB} fill="transparent" />
                <rect
                  x={barX}
                  y={y(d.velocity)}
                  width={bw}
                  height={Math.max(0, y(0) - y(d.velocity))}
                  rx={5}
                  fill={hover === i ? "#9DB5FF" : "#7C9CFF"}
                />
              </g>
            );
          })}
          <line x1={PL} x2={W - PR} y1={y(average)} y2={y(average)} stroke="#5EEAD4" strokeWidth={1.5} strokeDasharray="6 6" />
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
        {data.map((d, i) => (
          <div
            key={i}
            className="pointer-events-none absolute -translate-x-1/2 font-mono text-[10.5px] text-faint"
            style={{ left: `${(((PL + i * slot + slot / 2) / W) * 100).toFixed(2)}%`, top: xLabelTop }}
          >
            {shortLabel(d.sprintName)}
          </div>
        ))}
        {hovered && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 translate-y-[-120%] whitespace-nowrap rounded-[9px] border border-tipline bg-tipbg px-[11px] py-[9px] shadow-tip"
            style={{
              left: `${(((PL + hover * slot + slot / 2) / W) * 100).toFixed(2)}%`,
              top: `${((y(hovered.velocity) / H) * 100).toFixed(2)}%`,
            }}
          >
            <div className="font-mono text-[10.5px] text-muted">{hovered.sprintName}</div>
            <div className="mt-1 text-[13px] font-semibold">{`${formatPoints(hovered.velocity)} SP abgeschlossen`}</div>
            <div className="mt-0.5 text-[11.5px] text-muted">{`Commitment: ${formatPoints(hovered.committed)} SP`}</div>
          </div>
        )}
      </div>
    </div>
  );
}
