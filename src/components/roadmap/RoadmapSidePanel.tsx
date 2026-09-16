"use client";

import { useState, useTransition } from "react";
import { searchJiraAction } from "@/app/(app)/roadmap/actions";

/** Ein Eintrag der Seitenleiste — per Drag oder „+" auf die Timeline. */
export interface SidePanelIssue {
  jiraKey: string;
  summary: string;
  issueType: string;
  statusLabel: string | null;
  statusCategory: string | null;
  storyPoints: number;
  assignee: string | null;
}

/** dataTransfer-Format für Drops auf die Timeline. */
export const DRAG_MIME = "application/x-roadmap-issue";

function IssueRow({
  issue,
  contained,
  onAdd,
}: {
  issue: SidePanelIssue;
  contained: boolean;
  onAdd: (issue: SidePanelIssue) => void;
}) {
  return (
    <div
      draggable={!contained}
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_MIME, JSON.stringify(issue));
        e.dataTransfer.effectAllowed = "copy";
        const panel = document.querySelector<HTMLElement>("[data-roadmap-offcanvas]");
        const backdrop = panel?.previousElementSibling as HTMLElement | null;
        if (panel) { panel.style.pointerEvents = "none"; panel.style.opacity = "0.35"; }
        if (backdrop) { backdrop.style.pointerEvents = "none"; backdrop.style.opacity = "0"; }
      }}
      onDragEnd={() => {
        const panel = document.querySelector<HTMLElement>("[data-roadmap-offcanvas]");
        const backdrop = panel?.previousElementSibling as HTMLElement | null;
        if (panel) { panel.style.pointerEvents = ""; panel.style.opacity = ""; }
        if (backdrop) { backdrop.style.pointerEvents = ""; backdrop.style.opacity = ""; }
      }}
      className={`flex items-center gap-2 rounded-[8px] border border-edge bg-field px-2.5 py-1.5 ${
        contained ? "opacity-40" : "cursor-grab hover:border-accent/60"
      }`}
    >
      <span className="flex-none font-mono text-[11px] text-link">{issue.jiraKey}</span>
      <span className="min-w-0 flex-1 truncate text-[12px] text-fg" title={issue.summary}>
        {issue.summary}
      </span>
      <span className="flex-none font-mono text-[9.5px] uppercase tracking-[0.08em] text-faint">
        {issue.issueType}
      </span>
      <button
        type="button"
        onClick={() => onAdd(issue)}
        disabled={contained}
        title={contained ? "Bereits auf der Roadmap" : "In den Eingangskorb legen (ab heute)"}
        className="flex-none rounded-md px-1.5 text-[13px] text-faint hover:bg-chip hover:text-link disabled:cursor-default disabled:hover:bg-transparent"
      >
        +
      </button>
    </div>
  );
}

export function RoadmapSidePanel({
  sprintIssues,
  containedKeys,
  onAdd,
  onClose,
}: {
  sprintIssues: SidePanelIssue[];
  containedKeys: Set<string>;
  onAdd: (issue: SidePanelIssue) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"sprint" | "search">("sprint");
  const [filter, setFilter] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SidePanelIssue[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();

  const runSearch = () =>
    startSearch(async () => {
      setSearchError(null);
      const result = await searchJiraAction(query);
      if (!result.ok || !result.data) {
        setSearchError(result.error ?? "Suche fehlgeschlagen.");
        setResults(null);
        return;
      }
      setResults(
        result.data.map((r) => ({
          jiraKey: r.jiraKey,
          summary: r.summary,
          issueType: r.issueType,
          statusLabel: r.status,
          statusCategory: r.statusCategory,
          storyPoints: r.storyPoints ?? 0,
          assignee: null,
        })),
      );
    });

  const filtered = sprintIssues.filter(
    (i) =>
      !filter.trim() ||
      `${i.jiraKey} ${i.summary}`.toLowerCase().includes(filter.trim().toLowerCase()),
  );

  return (
    <>
      {/* Backdrop: schließt beim Klick; beim Ticket-Drag durchlässig (siehe Panel). */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <aside
        data-roadmap-offcanvas
        className="fixed right-0 top-0 z-50 flex h-full w-[320px] flex-col gap-2.5 border-l border-edge bg-card p-3 shadow-[-8px_0_24px_rgba(0,0,0,0.35)]"
      >
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-fg">Tickets hinzufügen</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="rounded-md px-1.5 text-[15px] text-faint hover:bg-chip hover:text-fg"
          >
            ✕
          </button>
        </div>
      <div className="flex gap-1 rounded-[8px] bg-chip p-1">
        {(
          [
            ["sprint", "Sprint-Tickets"],
            ["search", "Jira-Suche"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-1 rounded-[6px] px-2 py-1 text-[12px] ${
              tab === key ? "bg-field text-fg" : "text-muted hover:text-mid"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "sprint" && (
        <>
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtern…"
            className="rounded-[7px] border border-edge bg-field px-2.5 py-1.5 text-[12.5px] text-fg"
          />
          <div className="flex max-h-[420px] flex-col gap-1.5 overflow-y-auto">
            {filtered.map((i) => (
              <IssueRow key={i.jiraKey} issue={i} contained={containedKeys.has(i.jiraKey)} onAdd={onAdd} />
            ))}
            {filtered.length === 0 && (
              <p className="py-4 text-center text-[12px] text-faint">Keine Tickets gefunden.</p>
            )}
          </div>
        </>
      )}

      {tab === "search" && (
        <>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              placeholder="Key oder Titel…"
              className="min-w-0 flex-1 rounded-[7px] border border-edge bg-field px-2.5 py-1.5 text-[12.5px] text-fg"
            />
            <button
              type="button"
              onClick={runSearch}
              disabled={searching}
              className="btn-secondary flex-none px-3 py-1.5 disabled:opacity-40"
            >
              {searching ? "…" : "Suchen"}
            </button>
          </div>
          {searchError && <p className="text-[12px] text-danger">{searchError}</p>}
          <div className="flex max-h-[420px] flex-col gap-1.5 overflow-y-auto">
            {(results ?? []).map((i) => (
              <IssueRow key={i.jiraKey} issue={i} contained={containedKeys.has(i.jiraKey)} onAdd={onAdd} />
            ))}
            {results !== null && results.length === 0 && (
              <p className="py-4 text-center text-[12px] text-faint">Keine Treffer.</p>
            )}
            {results === null && !searchError && (
              <p className="py-4 text-center text-[12px] text-faint">
                Findet auch Epics und Backlog-Tickets.
              </p>
            )}
          </div>
        </>
      )}
      </aside>
    </>
  );
}
