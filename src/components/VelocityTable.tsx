"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatPoints, formatDelta } from "@/lib/format";

export interface VelocitySprintRow {
  sprintId: string;
  name: string;
  state: "ACTIVE" | "CLOSED" | "FUTURE";
  /** Vorformatierter Sprint-Zeitraum, z. B. "13.07.26 – 24.07.26". */
  period: string;
  committed: number;
  completed: number;
  plannedPersonDays: number;
  forecast: number | null;
}

const GRID_MD = "md:grid-cols-[1.5fr,1.1fr,0.9fr,1fr,0.9fr,0.9fr,0.8fr,68px] md:gap-3";

/** Zelle mit Mobile-Label: unter md Label-Wert-Paar, ab md nur der Wert rechtsbündig. */
function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2 md:block md:text-right">
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-dim md:hidden">{label}</span>
      {children}
    </div>
  );
}

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
      <div className={`hidden ${GRID_MD} border-b border-line px-[18px] py-3 font-mono text-[10.5px] uppercase tracking-[0.1em] text-dim md:grid`}>
        <div>Sprint</div>
        <div>Zeitraum</div>
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
          <div key={r.sprintId} className={`grid grid-cols-1 gap-y-2 border-b border-row px-[18px] py-3 text-[13px] hover:bg-raise md:grid ${GRID_MD} md:items-center md:py-[11px]`}>
            <div className="flex items-center gap-2 text-fg">
              <span className="truncate">{r.name}</span>
              {tag && (
                <span className={`shrink-0 rounded-full border px-1.5 py-px font-mono text-[10px] ${tag.className}`}>
                  {tag.label}
                </span>
              )}
            </div>
            <div className="whitespace-nowrap font-mono text-[12px] text-muted">{r.period}</div>
            <Cell label="Commitment">
              <span className="font-mono text-mid">{formatPoints(r.committed)} SP</span>
            </Cell>
            <Cell label="Abgeschlossen">
              <span className="font-mono text-fg">{done ? `${formatPoints(r.completed)} SP` : "–"}</span>
            </Cell>
            <Cell label="Prognose">
              <span
                className="font-mono text-accent"
                title={r.forecast !== null ? `bei ${formatPoints(r.plannedPersonDays)} PT Soll-Kapazität` : "keine Historie als Basis"}
              >
                {r.forecast !== null ? `≈ ${formatPoints(r.forecast)} SP` : "–"}
              </span>
            </Cell>
            <Cell label="Differenz">
              <span className={`font-mono ${done ? (diff >= 0 ? "text-ok" : "text-warn") : "text-dim"}`}>
                {done ? `${formatDelta(diff)} SP` : "–"}
              </span>
            </Cell>
            <Cell label="Quote">
              <span className="font-mono text-mid">
                {done && r.committed > 0 ? `${Math.round((r.completed / r.committed) * 100)} %` : "–"}
              </span>
            </Cell>
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
