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
        title={contained ? "Bereits auf der Roadmap" : "In die erste Bahn einfügen"}
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
}: {
  sprintIssues: SidePanelIssue[];
  containedKeys: Set<string>;
  onAdd: (issue: SidePanelIssue) => void;
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
          // Kategorie kommt beim nächsten Status-Refresh aus Jira
          statusCategory: null,
        })),
      );
    });

  const filtered = sprintIssues.filter(
    (i) =>
      !filter.trim() ||
      `${i.jiraKey} ${i.summary}`.toLowerCase().includes(filter.trim().toLowerCase()),
  );

  return (
    <aside className="flex w-[290px] flex-none flex-col gap-2.5 rounded-[10px] border border-edge bg-card p-3">
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
  );
}
