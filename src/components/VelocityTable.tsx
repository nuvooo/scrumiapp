"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatPoints, formatDelta } from "@/lib/format";

export interface VelocitySprintRow {
  sprintId: string;
  name: string;
  state: "ACTIVE" | "CLOSED" | "FUTURE";
  committed: number;
  completed: number;
  plannedPersonDays: number;
  forecast: number | null;
}

const GRID = "grid grid-cols-[1.6fr,1fr,1fr,1fr,1fr,1fr,68px] gap-3";

const STATE_TAG = {
  ACTIVE: { label: "aktiv", className: "border-[#1F3D2B] bg-[#0F1A14] text-ok" },
  FUTURE: { label: "geplant", className: "border-edge bg-field text-dim" },
} as const;

export function VelocityTable({ rows, teamId }: { rows: VelocitySprintRow[]; teamId: string }) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  function refresh() {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 600);
  }

  const ordered = [...rows].reverse();

  return (
    <div className="card overflow-hidden">
      <div className={`${GRID} border-b border-line px-[18px] py-3 font-mono text-[10.5px] uppercase tracking-[0.1em] text-dim`}>
        <div>Sprint</div>
        <div className="text-right">Commitment</div>
        <div className="text-right">Abgeschlossen</div>
        <div className="text-right">Prognose</div>
        <div className="text-right">Differenz</div>
        <div className="text-right">Quote</div>
        <div className="text-right">Aktionen</div>
      </div>
      {ordered.map((r) => {
        const done = r.state !== "FUTURE";
        const diff = r.completed - r.committed;
        const tag = r.state !== "CLOSED" ? STATE_TAG[r.state] : null;
        return (
          <div key={r.sprintId} className={`${GRID} items-center border-b border-row px-[18px] py-[11px] text-[13px] hover:bg-raise`}>
            <div className="flex items-center gap-2 text-fg">
              <span className="truncate">{r.name}</span>
              {tag && (
                <span className={`shrink-0 rounded-full border px-1.5 py-px font-mono text-[10px] ${tag.className}`}>
                  {tag.label}
                </span>
              )}
            </div>
            <div className="text-right font-mono text-mid">{formatPoints(r.committed)} SP</div>
            <div className="text-right font-mono text-fg">{done ? `${formatPoints(r.completed)} SP` : "–"}</div>
            <div
              className="text-right font-mono text-accent"
              title={r.forecast !== null ? `bei ${formatPoints(r.plannedPersonDays)} PT Soll-Kapazität` : "keine Historie als Basis"}
            >
              {r.forecast !== null ? `≈ ${formatPoints(r.forecast)} SP` : "–"}
            </div>
            <div className={`text-right font-mono ${done ? (diff >= 0 ? "text-ok" : "text-warn") : "text-dim"}`}>
              {done ? `${formatDelta(diff)} SP` : "–"}
            </div>
            <div className="text-right font-mono text-mid">
              {done && r.committed > 0 ? `${Math.round((r.completed / r.committed) * 100)} %` : "–"}
            </div>
            <div className="flex justify-end gap-1.5">
              <button
                type="button"
                onClick={refresh}
                title="Neu berechnen"
                aria-label={`${r.name} neu berechnen`}
                className={`btn-secondary flex h-[26px] w-[26px] items-center justify-center rounded-[7px] text-[13px] ${refreshing ? "animate-spin" : ""}`}
              >
                ↻
              </button>
              <Link
                href={`/capacity?team=${teamId}&sprint=${r.sprintId}`}
                title="Kapazität dieses Sprints anpassen"
                aria-label={`Kapazität von ${r.name} anpassen`}
                className="btn-secondary flex h-[26px] w-[26px] items-center justify-center rounded-[7px] text-[12px]"
              >
                ✎
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
