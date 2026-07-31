"use client";

import { useEffect, useState } from "react";
import { formatPoints } from "@/lib/format";
import { BacklogTable, DragHandle } from "./BacklogTable";
import type { RefinementTicketView } from "@/lib/view/refinementState";
import type { JiraSearchResult } from "@/lib/jira/jiraClient";

interface SearchResponse {
  ok: boolean;
  error?: string;
  data?: JiraSearchResult[];
}

export function RefinementDraft({
  tickets,
  isAdmin,
  onLoadBacklog,
  onAdd,
  onAddMany,
  onRemove,
  onMove,
  onStart,
}: {
  tickets: RefinementTicketView[];
  isAdmin: boolean;
  onLoadBacklog: () => Promise<SearchResponse>;
  onAdd: (result: JiraSearchResult) => void;
  onAddMany: (results: JiraSearchResult[]) => void | Promise<void>;
  onRemove: (ticketId: string) => void;
  onMove: (ticketId: string, direction: "up" | "down") => void;
  onStart: () => void;
}) {
  const [backlog, setBacklog] = useState<JiraSearchResult[] | null>(null);
  const [backlogError, setBacklogError] = useState<string | null>(null);
  // Welche Drop-Zone gerade unter dem gezogenen Ticket liegt (fürs Highlight).
  const [dropZone, setDropZone] = useState<"add" | "remove" | null>(null);
  const added = new Set(tickets.map((t) => t.jiraKey));

  // Vorschläge einmalig laden: unbewertete Tickets aus dem Board-Backlog.
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    onLoadBacklog().then((res) => {
      if (cancelled) return;
      if (res.ok) setBacklog(res.data ?? []);
      else setBacklogError(res.error ?? "Backlog konnte nicht geladen werden.");
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const selectedList = (
    <div
      data-testid="selected-panel"
      onDragOver={(e) => {
        if (!isAdmin || !e.dataTransfer.types.includes("application/x-backlog-ticket")) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setDropZone("add");
      }}
      onDragLeave={() => setDropZone(null)}
      onDrop={(e) => {
        setDropZone(null);
        const raw = e.dataTransfer.getData("application/x-backlog-ticket");
        if (!raw) return;
        e.preventDefault();
        onAdd(JSON.parse(raw) as JiraSearchResult);
      }}
      className={`card overflow-hidden ${dropZone === "add" ? "ring-2 ring-[#6e8ff6]" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-[18px] py-[15px]">
        <div className="text-sm font-semibold">Ausgewählt ({tickets.length})</div>
        {isAdmin && (
          <button
            type="button"
            onClick={onStart}
            disabled={tickets.length === 0}
            className="btn-primary ml-auto px-4 py-[9px] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Refinement starten
          </button>
        )}
      </div>
      {tickets.map((t, i) => (
        <div
          key={t.id}
          draggable={isAdmin}
          onDragStart={(e) => {
            e.dataTransfer.setData("application/x-selected-ticket", t.id);
            e.dataTransfer.effectAllowed = "move";
          }}
          className={`flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-row px-[18px] py-2.5 text-[13px] last:border-b-0 ${isAdmin ? "cursor-grab" : ""}`}
        >
          {isAdmin && <DragHandle />}
          <span className="w-5 flex-none font-mono text-[11px] text-faint">{i + 1}.</span>
          <span className="flex-none font-mono text-[11.5px] text-link">{t.jiraKey}</span>
          <span className="min-w-0 flex-1 truncate" title={t.summary}>{t.summary}</span>
          <span className="flex-none font-mono text-[11px] text-dim">
            {t.previousPoints !== null ? `${formatPoints(t.previousPoints)} SP` : "ohne Schätzung"}
          </span>
          {isAdmin && (
            <span className="flex flex-none gap-1">
              <button type="button" aria-label={`${t.jiraKey} nach oben`} onClick={() => onMove(t.id, "up")} className="btn-secondary h-[26px] w-[26px] rounded-[7px]">↑</button>
              <button type="button" aria-label={`${t.jiraKey} nach unten`} onClick={() => onMove(t.id, "down")} className="btn-secondary h-[26px] w-[26px] rounded-[7px]">↓</button>
              <button type="button" aria-label={`${t.jiraKey} entfernen`} onClick={() => onRemove(t.id)} className="btn-danger h-[26px] w-[26px] rounded-[7px]">×</button>
            </span>
          )}
        </div>
      ))}
      {tickets.length === 0 && (
        <div className="px-[18px] py-8 text-center text-[13px] text-muted">
          {isAdmin ? "Noch keine Tickets — links im Backlog auswählen." : "Der Admin stellt gerade die Tickets zusammen…"}
        </div>
      )}
    </div>
  );

  if (!isAdmin) {
    return <div className="mt-6">{selectedList}</div>;
  }

  return (
    <div className="mt-6 grid grid-cols-1 items-start gap-3.5 xl:grid-cols-[minmax(0,1fr),380px]">
      <div
        data-testid="backlog-panel"
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes("application/x-selected-ticket")) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setDropZone("remove");
        }}
        onDragLeave={() => setDropZone(null)}
        onDrop={(e) => {
          setDropZone(null);
          const ticketId = e.dataTransfer.getData("application/x-selected-ticket");
          if (!ticketId) return;
          e.preventDefault();
          onRemove(ticketId);
        }}
        className={`card p-[18px] ${dropZone === "remove" ? "ring-2 ring-[#6e8ff6]" : ""}`}
      >
        <div className="flex flex-wrap items-baseline gap-2">
          <div className="text-sm font-semibold">
            Backlog ohne Schätzung{backlog !== null && ` (${backlog.length})`}
          </div>
          <div className="text-xs text-dim">alle unbewerteten Tickets vom Jira-Board (inkl. Sprints), nach Rang sortiert — Tickets lassen sich per Drag &amp; Drop rüberziehen</div>
        </div>
        {backlogError && <div className="mt-2 text-[12.5px] text-danger">{backlogError}</div>}
        {backlog === null && !backlogError && (
          <div className="mt-3 text-[13px] text-muted">Lade Backlog…</div>
        )}
        {backlog !== null && backlog.length === 0 && (
          <div className="mt-3 text-[13px] text-muted">Alles geschätzt — das Backlog hat keine offenen Tickets ohne Schätzung. 🎉</div>
        )}
        {backlog !== null && backlog.length > 0 && (
          <BacklogTable rows={backlog} addedKeys={added} onAdd={onAdd} onAddMany={onAddMany} />
        )}
      </div>
      <div className="xl:sticky xl:top-4">{selectedList}</div>
    </div>
  );
}
