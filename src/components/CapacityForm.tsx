"use client";

import { addCapacity } from "@/app/(app)/capacity/actions";

export function CapacityForm({ sprintId }: { sprintId: string }) {
  return (
    <form action={addCapacity} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="sprintId" value={sprintId} />
      <label className="flex flex-col text-xs text-slate-400">
        Person
        <input name="name" required className="mt-1 rounded bg-slate-800 px-3 py-1.5 text-sm text-slate-100" placeholder="Name" />
      </label>
      <label className="flex flex-col text-xs text-slate-400">
        Personentage
        <input name="personDays" type="number" step="0.5" min="0.5" required className="mt-1 w-32 rounded bg-slate-800 px-3 py-1.5 text-sm text-slate-100" />
      </label>
      <button type="submit" className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium hover:bg-emerald-500">
        Hinzufügen
      </button>
    </form>
  );
}
