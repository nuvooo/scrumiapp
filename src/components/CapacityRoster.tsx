"use client";

import { useState } from "react";
import Link from "next/link";
import { upsertCapacity } from "@/app/(app)/capacity/actions";
import { formatDelta, formatPoints } from "@/lib/format";

export interface CapacityRosterRow {
  teamMemberId: string;
  name: string;
  plannedPersonDays: number;
  actualPersonDays: number;
}

const GRID = "grid grid-cols-[2fr,1fr,1fr,1fr] gap-3";

function num(v: string): number {
  const n = parseFloat(v.replace(",", "."));
  return Number.isNaN(n) ? 0 : n;
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function deltaClass(delta: number): string {
  return delta < 0 ? "text-warn" : delta > 0 ? "text-ok" : "text-dim";
}

export function CapacityRoster({ sprintId, rows }: { sprintId: string; rows: CapacityRosterRow[] }) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(
      rows.map((r) => [r.teamMemberId, { soll: String(r.plannedPersonDays), ist: String(r.actualPersonDays) }]),
    ),
  );

  const patch = (id: string, field: "soll" | "ist", v: string) =>
    setValues((prev) => ({ ...prev, [id]: { ...prev[id], [field]: v } }));

  const sollTotal = rows.reduce((a, r) => a + num(values[r.teamMemberId].soll), 0);
  const istTotal = rows.reduce((a, r) => a + num(values[r.teamMemberId].ist), 0);
  const totalDelta = istTotal - sollTotal;

  const inputClass =
    "w-full rounded-[7px] border border-transparent bg-transparent px-[9px] py-1.5 text-right font-mono text-[13px] text-fg hover:border-[#232B39] hover:bg-chip";

  return (
    <div className="card mt-3.5 overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-[18px] py-[15px]">
        <div className="text-sm font-semibold">Team-Roster</div>
        <div className="text-xs text-dim">PT-Werte direkt editierbar · Mitglieder werden unter Teams / Jira gepflegt</div>
        <Link
          href="/settings/teams"
          className="ml-auto whitespace-nowrap text-[12.5px] font-medium text-link hover:text-linkhi"
        >
          Mitglieder verwalten →
        </Link>
      </div>
      <div className={`${GRID} border-b border-line px-[18px] py-[11px] font-mono text-[10.5px] uppercase tracking-[0.1em] text-dim`}>
        <div>Mitglied</div>
        <div className="text-right">PT Soll</div>
        <div className="text-right">PT Ist</div>
        <div className="pr-[9px] text-right">Delta</div>
      </div>

      {rows.map((r) => {
        const v = values[r.teamMemberId];
        const delta = num(v.ist) - num(v.soll);
        return (
          <form
            key={r.teamMemberId}
            action={upsertCapacity}
            className={`${GRID} items-center border-b border-row px-[18px] py-[9px] hover:bg-raise`}
          >
            <input type="hidden" name="sprintId" value={sprintId} />
            <input type="hidden" name="teamMemberId" value={r.teamMemberId} />
            <input type="hidden" name="name" value={r.name} />
            <div className="flex items-center gap-2.5 text-[13px] text-fg">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-cell font-mono text-[10.5px] text-mid">
                {initials(r.name)}
              </span>
              {r.name}
            </div>
            <input
              name="plannedPersonDays"
              aria-label={`PT Soll von ${r.name}`}
              value={v.soll}
              onChange={(e) => patch(r.teamMemberId, "soll", e.target.value)}
              onBlur={(e) => e.currentTarget.form?.requestSubmit()}
              className={inputClass}
            />
            <input
              name="actualPersonDays"
              aria-label={`PT Ist von ${r.name}`}
              value={v.ist}
              onChange={(e) => patch(r.teamMemberId, "ist", e.target.value)}
              onBlur={(e) => e.currentTarget.form?.requestSubmit()}
              className={inputClass}
            />
            <div className={`pr-[9px] text-right font-mono text-[13px] ${deltaClass(delta)}`}>{formatDelta(delta)}</div>
          </form>
        );
      })}

      {rows.length === 0 && (
        <div className="px-[18px] py-8 text-center text-[13px] text-muted">
          Dieses Team hat noch keine Mitglieder. Füge sie unter{" "}
          <Link href="/settings/teams" className="text-link hover:text-linkhi">
            Teams / Jira
          </Link>{" "}
          hinzu.
        </div>
      )}

      <div className={`${GRID} bg-raise px-[18px] py-3.5 text-[13px] font-semibold`}>
        <div>Summe</div>
        <div className="pr-[9px] text-right font-mono">{formatPoints(sollTotal)}</div>
        <div className="pr-[9px] text-right font-mono">{formatPoints(istTotal)}</div>
        <div className={`pr-[9px] text-right font-mono ${deltaClass(totalDelta)}`}>{formatDelta(totalDelta)}</div>
      </div>
    </div>
  );
}
