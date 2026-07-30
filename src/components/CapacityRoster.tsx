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

const GRID_MD = "md:grid-cols-[2fr,1fr,1fr,1fr] md:gap-3";
/** Zeilen-Grid: mobil drei Spalten (Name volle Breite darüber), ab md die Tabellen-Spalten. */
const ROW_GRID = `grid grid-cols-3 gap-2 ${GRID_MD}`;

/** Mobile-Spaltenlabel über Soll/Ist/Delta — ab md übernimmt die Kopfzeile. */
function MobileLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="pb-1 text-right font-mono text-[10px] uppercase tracking-[0.1em] text-dim md:hidden">
      {children}
    </div>
  );
}

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

function initialValues(rows: CapacityRosterRow[]) {
  return Object.fromEntries(
    rows.map((r) => [r.teamMemberId, { soll: String(r.plannedPersonDays), ist: String(r.actualPersonDays) }]),
  );
}

export function CapacityRoster({ sprintId, rows }: { sprintId: string; rows: CapacityRosterRow[] }) {
  const [values, setValues] = useState(() => initialValues(rows));

  // Beim Sprint-Wechsel bleibt die Komponente gemountet — den editierbaren
  // State auf die frisch geladenen Zeilen zurücksetzen (React-Muster
  // "adjusting state during render").
  const [syncedSprintId, setSyncedSprintId] = useState(sprintId);
  if (syncedSprintId !== sprintId) {
    setSyncedSprintId(sprintId);
    setValues(initialValues(rows));
  }

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
      <div className={`hidden ${GRID_MD} border-b border-line px-[18px] py-[11px] font-mono text-[10.5px] uppercase tracking-[0.1em] text-dim md:grid`}>
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
            className={`${ROW_GRID} items-center border-b border-row px-[18px] py-3 hover:bg-raise md:py-[9px]`}
          >
            <input type="hidden" name="sprintId" value={sprintId} />
            <input type="hidden" name="teamMemberId" value={r.teamMemberId} />
            <input type="hidden" name="name" value={r.name} />
            <div className="col-span-3 flex items-center gap-2.5 text-[13px] text-fg md:col-span-1">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-cell font-mono text-[10.5px] text-mid">
                {initials(r.name)}
              </span>
              {r.name}
            </div>
            <div>
              <MobileLabel>PT Soll</MobileLabel>
              <input
                name="plannedPersonDays"
                aria-label={`PT Soll von ${r.name}`}
                value={v.soll}
                onChange={(e) => patch(r.teamMemberId, "soll", e.target.value)}
                onBlur={(e) => e.currentTarget.form?.requestSubmit()}
                className={inputClass}
              />
            </div>
            <div>
              <MobileLabel>PT Ist</MobileLabel>
              <input
                name="actualPersonDays"
                aria-label={`PT Ist von ${r.name}`}
                value={v.ist}
                onChange={(e) => patch(r.teamMemberId, "ist", e.target.value)}
                onBlur={(e) => e.currentTarget.form?.requestSubmit()}
                className={inputClass}
              />
            </div>
            <div>
              <MobileLabel>Delta</MobileLabel>
              <div className={`pr-[9px] text-right font-mono text-[13px] ${deltaClass(delta)}`}>{formatDelta(delta)}</div>
            </div>
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

      <div className={`${ROW_GRID} bg-raise px-[18px] py-3.5 text-[13px] font-semibold`}>
        <div className="col-span-3 md:col-span-1">Summe</div>
        <div className="pr-[9px] text-right font-mono">{formatPoints(sollTotal)}</div>
        <div className="pr-[9px] text-right font-mono">{formatPoints(istTotal)}</div>
        <div className={`pr-[9px] text-right font-mono ${deltaClass(totalDelta)}`}>{formatDelta(totalDelta)}</div>
      </div>
    </div>
  );
}
