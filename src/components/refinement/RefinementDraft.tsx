"use client";

import { useState } from "react";
import { formatPoints } from "@/lib/format";
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
  onSearch,
  onAdd,
  onRemove,
  onMove,
  onStart,
}: {
  tickets: RefinementTicketView[];
  isAdmin: boolean;
  onSearch: (query: string) => Promise<SearchResponse>;
  onAdd: (result: JiraSearchResult) => void;
  onRemove: (ticketId: string) => void;
  onMove: (ticketId: string, direction: "up" | "down") => void;
  onStart: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<JiraSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const added = new Set(tickets.map((t) => t.jiraKey));

  const search = async () => {
    if (!query.trim() || searching) return;
    setSearching(true);
    setError(null);
    const res = await onSearch(query);
    setSearching(false);
    if (!res.ok) {
      setError(res.error ?? "Suche fehlgeschlagen.");
      return;
    }
    setResults(res.data ?? []);
  };

  return (
    <div className="mt-6 flex flex-col gap-3.5">
      {isAdmin && (
        <div className="card p-[18px]">
          <div className="text-sm font-semibold">Tickets zusammenstellen</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              aria-label="Jira durchsuchen"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="Ticket-Key oder Suchbegriff…"
              className="input-field min-w-0 flex-1"
            />
            <button type="button" onClick={search} disabled={searching} className="btn-primary px-4 py-2.5">
              {searching ? "Sucht…" : "Suchen"}
            </button>
          </div>
          {error && <div className="mt-2 text-[12.5px] text-danger">{error}</div>}
          {results.length > 0 && (
            <div className="mt-3 flex flex-col">
              {results.map((r) => (
                <div key={r.jiraKey} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-row py-2 text-[13px] last:border-b-0">
                  <span className="w-[76px] flex-none font-mono text-[11.5px] text-link">{r.jiraKey}</span>
                  <span className="min-w-0 flex-1 truncate">{r.summary}</span>
                  <span className="flex-none font-mono text-[10.5px] uppercase text-faint">{r.issueType}</span>
                  <span className="flex-none font-mono text-[11px] text-dim">
                    {r.storyPoints !== null ? `${formatPoints(r.storyPoints)} SP` : "ohne Schätzung"}
                  </span>
                  <button
                    type="button"
                    aria-label={`${r.jiraKey} hinzufügen`}
                    onClick={() => onAdd(r)}
                    disabled={added.has(r.jiraKey)}
                    className="btn-secondary flex-none px-3 py-1 disabled:opacity-40"
                  >
                    {added.has(r.jiraKey) ? "drin" : "+ Hinzufügen"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-[18px] py-[15px]">
          <div className="text-sm font-semibold">Ausgewählte Tickets ({tickets.length})</div>
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
          <div key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-row px-[18px] py-2.5 text-[13px] last:border-b-0">
            <span className="w-6 flex-none font-mono text-[11px] text-faint">{i + 1}.</span>
            <span className="w-[76px] flex-none font-mono text-[11.5px] text-link">{t.jiraKey}</span>
            <span className="min-w-0 flex-1 truncate">{t.summary}</span>
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
            {isAdmin ? "Noch keine Tickets — oben suchen und hinzufügen." : "Der Admin stellt gerade die Tickets zusammen…"}
          </div>
        )}
      </div>
    </div>
  );
}
