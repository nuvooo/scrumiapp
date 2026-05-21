"use client";

import { editTeam, removeTeam } from "@/app/(app)/settings/teams/actions";

interface TeamEditorProps {
  team: { id: string; name: string; jiraBoardId: string; syncIntervalMinutes: number };
}

export function TeamEditor({ team }: TeamEditorProps) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <form action={editTeam} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="id" value={team.id} />
        <label className="flex flex-col text-xs text-slate-400">
          Teamname
          <input name="name" defaultValue={team.name} required className="mt-1 rounded bg-slate-800 px-3 py-1.5 text-sm text-slate-100" />
        </label>
        <label className="flex flex-col text-xs text-slate-400">
          Jira Board-ID
          <input name="jiraBoardId" defaultValue={team.jiraBoardId} required className="mt-1 w-32 rounded bg-slate-800 px-3 py-1.5 text-sm text-slate-100" />
        </label>
        <label className="flex flex-col text-xs text-slate-400">
          Sync-Intervall (min)
          <input name="syncIntervalMinutes" type="number" min="1" required defaultValue={team.syncIntervalMinutes} className="mt-1 w-24 rounded bg-slate-800 px-3 py-1.5 text-sm text-slate-100" />
        </label>
        <button type="submit" className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium hover:bg-emerald-500">
          Speichern
        </button>
      </form>
      <form action={removeTeam} onSubmit={(e) => { if (!confirm("Team und alle zugehörigen Daten löschen?")) e.preventDefault(); }}>
        <input type="hidden" name="id" value={team.id} />
        <button type="submit" className="rounded border border-red-500/40 px-3 py-1.5 text-sm font-medium text-red-400 hover:bg-red-500/10">
          Löschen
        </button>
      </form>
    </div>
  );
}
