"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { editTeam, removeTeam } from "@/app/(app)/settings/teams/actions";

interface TeamEditorProps {
  team: { id: string; name: string; jiraBoardId: string; syncIntervalMinutes: number };
  status: { text: string; tone: "ok" | "error" | "none" };
}

const TONE_CLASS = { ok: "text-ok", error: "text-danger", none: "text-dim" } as const;
const DOT_CLASS = { ok: "bg-ok", error: "bg-danger", none: "bg-dim" } as const;

export function TeamEditor({ team, status }: TeamEditorProps) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const formId = `team-edit-${team.id}`;

  async function syncNow() {
    if (syncing) return;
    setSyncing(true);
    try {
      await fetch("/api/sync", { method: "POST" });
      router.refresh();
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div>
      <form id={formId} action={editTeam} className="grid grid-cols-[1.6fr,1fr,1fr] gap-3">
        <input type="hidden" name="id" value={team.id} />
        <div>
          <label htmlFor={`${formId}-name`} className="mono-label mb-[7px] block">Name</label>
          <input
            id={`${formId}-name`}
            name="name"
            defaultValue={team.name}
            required
            className="input-field text-[13.5px] font-medium"
          />
        </div>
        <div>
          <label htmlFor={`${formId}-board`} className="mono-label mb-[7px] block">Jira Board-ID</label>
          <input id={`${formId}-board`} name="jiraBoardId" defaultValue={team.jiraBoardId} required className="input-field font-mono" />
        </div>
        <div>
          <label htmlFor={`${formId}-interval`} className="mono-label mb-[7px] block">Sync-Intervall (min)</label>
          <input
            id={`${formId}-interval`}
            name="syncIntervalMinutes"
            type="number"
            min="1"
            required
            defaultValue={team.syncIntervalMinutes}
            className="input-field font-mono"
          />
        </div>
      </form>

      <div className="mt-3.5 flex flex-wrap items-center gap-3">
        <div className={`flex items-center gap-2 text-[12.5px] ${TONE_CLASS[status.tone]}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${DOT_CLASS[status.tone]}`} />
          {status.text}
        </div>
        <div className="ml-auto flex gap-2">
          <button type="submit" form={formId} className="btn-primary px-[13px] py-[7px] text-[12.5px]">
            Speichern
          </button>
          <button type="button" onClick={syncNow} disabled={syncing} className="btn-secondary px-[13px] py-[7px]">
            {syncing ? "Synchronisiere…" : "Jetzt synchronisieren"}
          </button>
          <form
            action={removeTeam}
            onSubmit={(e) => {
              if (!confirm("Team und alle zugehörigen Daten löschen?")) e.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={team.id} />
            <button type="submit" className="btn-danger px-[13px] py-[7px]">
              Löschen
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
