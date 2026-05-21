"use client";

import { upsertCapacity } from "@/app/(app)/capacity/actions";

export interface CapacityRosterRow {
  teamMemberId: string;
  name: string;
  plannedPersonDays: number;
  actualPersonDays: number;
}

export function CapacityRoster({ sprintId, rows }: { sprintId: string; rows: CapacityRosterRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-400">Dieses Team hat noch keine Mitglieder — unter Einstellungen → Teams anlegen.</p>;
  }

  return (
    <ul className="divide-y divide-slate-800 rounded-lg border border-slate-800">
      {rows.map((r) => (
        <li key={r.teamMemberId} className="p-3 text-sm">
          <form action={upsertCapacity} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="sprintId" value={sprintId} />
            <input type="hidden" name="teamMemberId" value={r.teamMemberId} />
            <input type="hidden" name="name" value={r.name} />
            <span className="min-w-32 font-medium">{r.name}</span>
            <label className="flex flex-col text-xs text-slate-400">
              Soll (PT)
              <input name="plannedPersonDays" type="number" step="0.5" min="0" defaultValue={r.plannedPersonDays} className="mt-1 w-24 rounded bg-slate-800 px-3 py-1.5 text-sm text-slate-100" />
            </label>
            <label className="flex flex-col text-xs text-slate-400">
              Ist (PT)
              <input name="actualPersonDays" type="number" step="0.5" min="0" defaultValue={r.actualPersonDays} className="mt-1 w-24 rounded bg-slate-800 px-3 py-1.5 text-sm text-slate-100" />
            </label>
            <button type="submit" className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium hover:bg-emerald-500">
              Speichern
            </button>
          </form>
        </li>
      ))}
    </ul>
  );
}
