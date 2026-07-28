"use client";

import { addTeam } from "@/app/(app)/settings/teams/actions";

export function TeamForm() {
  return (
    <form action={addTeam}>
      <div className="text-sm font-semibold">Neues Team anlegen</div>
      <div className="mt-4 grid grid-cols-[1.6fr,1fr,1fr,auto] items-end gap-3">
        <div>
          <label htmlFor="new-team-name" className="mono-label mb-[7px] block">Name</label>
          <input id="new-team-name" name="name" required placeholder="z. B. Growth Web" className="input-field" />
        </div>
        <div>
          <label htmlFor="new-team-board" className="mono-label mb-[7px] block">Jira Board-ID</label>
          <input id="new-team-board" name="jiraBoardId" required placeholder="1042" className="input-field font-mono" />
        </div>
        <div>
          <label htmlFor="new-team-interval" className="mono-label mb-[7px] block">Sync-Intervall (min)</label>
          <input
            id="new-team-interval"
            name="syncIntervalMinutes"
            type="number"
            min="1"
            defaultValue={60}
            className="input-field font-mono"
          />
        </div>
        <button type="submit" className="btn-primary whitespace-nowrap px-4 py-2.5">
          Team anlegen
        </button>
      </div>
    </form>
  );
}
