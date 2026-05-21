"use client";

import { createMember, editMember, deleteMember } from "@/app/(app)/settings/teams/actions";

interface TeamMembersProps {
  teamId: string;
  members: { id: string; name: string }[];
}

export function TeamMembers({ teamId, members }: TeamMembersProps) {
  return (
    <div className="mt-3">
      <div className="mb-2 text-xs uppercase tracking-wide text-slate-400">Mitglieder</div>
      {members.length === 0 && <p className="mb-2 text-sm text-slate-400">Noch keine Mitglieder.</p>}
      <ul className="mb-3 space-y-2">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-2">
            <form action={editMember} className="flex items-center gap-2">
              <input type="hidden" name="id" value={m.id} />
              <input name="name" defaultValue={m.name} className="rounded bg-slate-800 px-2 py-1 text-sm text-slate-100" />
              <button type="submit" className="text-xs text-slate-400 hover:text-emerald-400">Umbenennen</button>
            </form>
            <form action={deleteMember}>
              <input type="hidden" name="id" value={m.id} />
              <button type="submit" className="text-slate-500 hover:text-red-400" aria-label="Mitglied entfernen">✕</button>
            </form>
          </li>
        ))}
      </ul>
      <form action={createMember} className="flex items-end gap-2">
        <input type="hidden" name="teamId" value={teamId} />
        <input name="name" required placeholder="Neues Mitglied" className="rounded bg-slate-800 px-3 py-1.5 text-sm text-slate-100" />
        <button type="submit" className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium hover:bg-emerald-500">
          Hinzufügen
        </button>
      </form>
    </div>
  );
}
