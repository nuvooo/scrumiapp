"use client";

import { createMember, deleteMember } from "@/app/(app)/settings/teams/actions";

interface TeamMembersProps {
  teamId: string;
  members: { id: string; name: string }[];
}

export function TeamMembers({ teamId, members }: TeamMembersProps) {
  return (
    <div className="mt-4 border-t border-line pt-4">
      <div className="flex items-center gap-2.5">
        <div className="mono-label">Mitglieder</div>
        <div className="font-mono text-[11px] text-faint">
          {members.length} {members.length === 1 ? "Person" : "Personen"}
        </div>
      </div>

      {members.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {members.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-2 rounded-full border border-edge bg-chip py-[5px] pl-[11px] pr-1.5 text-[12.5px] text-soft"
            >
              {m.name}
              <form action={deleteMember} className="flex">
                <input type="hidden" name="id" value={m.id} />
                <button
                  type="submit"
                  aria-label={`${m.name} entfernen`}
                  className="flex h-[18px] w-[18px] items-center justify-center rounded-full text-[13px] text-faint hover:bg-[#1F1216] hover:text-danger"
                >
                  ×
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
      {members.length === 0 && <p className="mt-3 text-[12.5px] text-muted">Noch keine Mitglieder.</p>}

      <form action={createMember} className="mt-3 flex gap-2">
        <input type="hidden" name="teamId" value={teamId} />
        <input name="name" required placeholder="Name hinzufügen" className="input-field w-[220px] px-[11px] py-2" />
        <button type="submit" className="btn-secondary px-[13px] py-2">
          Hinzufügen
        </button>
      </form>
    </div>
  );
}
