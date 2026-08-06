"use client";

import { useEffect, useState } from "react";
import { BacklogTable } from "./BacklogTable";
import type { JiraSearchResult } from "@/lib/jira/jiraClient";

interface SearchResponse {
  ok: boolean;
  error?: string;
  data?: JiraSearchResult[];
}

/**
 * Modal zum Nachlegen von Tickets im laufenden Refinement: zeigt das
 * unbewertete Board-Backlog im gewohnten Grid (Suche, Mehrfachauswahl).
 */
export function AddTicketsModal({
  addedKeys,
  onLoadBacklog,
  onAdd,
  onAddMany,
  onClose,
}: {
  addedKeys: Set<string>;
  onLoadBacklog: () => Promise<SearchResponse>;
  onAdd: (result: JiraSearchResult) => void;
  onAddMany: (results: JiraSearchResult[]) => void | Promise<void>;
  onClose: () => void;
}) {
  const [backlog, setBacklog] = useState<JiraSearchResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    onLoadBacklog().then((res) => {
      if (cancelled) return;
      if (res.ok) setBacklog(res.data ?? []);
      else setError(res.error ?? "Backlog konnte nicht geladen werden.");
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      role="dialog"
      aria-label="Tickets hinzufügen"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="card flex max-h-[82vh] w-full max-w-[920px] flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-line px-[18px] py-[13px]">
          <div className="text-sm font-semibold">Tickets hinzufügen</div>
          <div className="text-xs text-dim">unbewertete Tickets vom Jira-Board</div>
          <button
            type="button"
            aria-label="Schließen"
            onClick={onClose}
            className="btn-secondary ml-auto h-[28px] w-[28px] rounded-[7px]"
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-[18px]">
          {error && <div className="text-[12.5px] text-danger">{error}</div>}
          {backlog === null && !error && <div className="text-[13px] text-muted">Lade Backlog…</div>}
          {backlog !== null && backlog.length === 0 && (
            <div className="text-[13px] text-muted">Alles geschätzt — keine offenen Tickets ohne Schätzung. 🎉</div>
          )}
          {backlog !== null && backlog.length > 0 && (
            <BacklogTable rows={backlog} addedKeys={addedKeys} onAdd={onAdd} onAddMany={onAddMany} />
          )}
        </div>
      </div>
    </div>
  );
}
