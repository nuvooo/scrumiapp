"use client";

import { addTeam } from "@/app/(app)/settings/teams/actions";

export function TeamForm() {
  return (
    <form action={addTeam} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col text-xs text-slate-400">
        Teamname
        <input name="name" required className="mt-1 rounded bg-slate-800 px-3 py-1.5 text-sm text-slate-100" placeholder="Team Alpha" />
      </label>
      <label className="flex flex-col text-xs text-slate-400">
        Jira Board-ID
        <input name="jiraBoardId" required className="mt-1 w-32 rounded bg-slate-800 px-3 py-1.5 text-sm text-slate-100" placeholder="42" />
      </label>
      <label className="flex flex-col text-xs text-slate-400">
        Sync-Intervall (min)
        <input name="syncIntervalMinutes" type="number" min="1" defaultValue={60} className="mt-1 w-28 rounded bg-slate-800 px-3 py-1.5 text-sm text-slate-100" />
      </label>
      <button type="submit" className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium hover:bg-emerald-500">
        Team anlegen
      </button>
    </form>
  );
}
