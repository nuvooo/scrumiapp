"use client";

import { useState } from "react";
import { typeBadge } from "./itemColors";

export interface RoadmapItemView {
  id: string;
  laneId: string;
  jiraKey: string | null;
  issueType: string | null;
  title: string;
  description: string | null;
  /** "YYYY-MM" */
  startMonth: string;
  endMonth: string;
  statusCategory: string | null;
  statusLabel: string | null;
  position: number;
  url: string | null;
  storyPoints: number;
  assignee: string | null;
  labelIds: string[];
}

export interface LaneOption {
  id: string;
  name: string;
}

export interface LabelView {
  id: string;
  name: string;
  color: string;
}

const GOAL_STATUS_OPTIONS = [
  { value: "new", label: "Offen" },
  { value: "indeterminate", label: "In Arbeit" },
  { value: "done", label: "Fertig" },
] as const;

export function RoadmapItemDialog({
  item,
  lanes,
  pending,
  error,
  readOnly = false,
  onClose,
  onDelete,
  onSavePlacement,
  onSaveGoal,
}: {
  item: RoadmapItemView;
  lanes: LaneOption[];
  pending: boolean;
  error: string | null;
  /** Betrachter-Modus: nur ansehen, keine Bearbeitung. */
  readOnly?: boolean;
  onClose: () => void;
  onDelete: () => void;
  /** Zeitraum/Bahn speichern (Touch-Fallback zum Drag&Drop) */
  onSavePlacement: (laneId: string, startMonth: string, endMonth: string) => void;
  /** Nur für eigene Ziele */
  onSaveGoal: (title: string, description: string, statusCategory: "new" | "indeterminate" | "done") => void;
}) {
  const isGoal = item.jiraKey === null;
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description ?? "");
  const [status, setStatus] = useState(item.statusCategory ?? "new");
  const [laneId, setLaneId] = useState(item.laneId);
  const [start, setStart] = useState(item.startMonth);
  const [end, setEnd] = useState(item.endMonth);

  const placementChanged = laneId !== item.laneId || start !== item.startMonth || end !== item.endMonth;
  const laneName = lanes.find((l) => l.id === item.laneId)?.name ?? "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="card w-full max-w-lg px-[18px] py-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="rounded-full border border-edge px-2 py-[2px] font-mono text-[10.5px] uppercase tracking-[0.08em] text-mid">
            {typeBadge(item)}
          </span>
          {item.jiraKey && <span className="font-mono text-[12.5px] text-link">{item.jiraKey}</span>}
          {item.statusLabel && (
            <span className="rounded-full border border-edge px-2 py-[2px] font-mono text-[10.5px] text-mid">
              {item.statusLabel}
            </span>
          )}
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-[12px] text-link hover:text-linkhi"
            >
              In Jira öffnen ↗
            </a>
          )}
        </div>

        {isGoal ? (
          readOnly ? (
            <div className="mt-3.5 flex flex-col gap-2">
              <div className="text-[15px] font-medium leading-snug text-fg">{item.title}</div>
              {item.description && (
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-mid">{item.description}</p>
              )}
            </div>
          ) : (
            <div className="mt-3.5 flex flex-col gap-3">
              <label>
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">Titel</span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 w-full rounded-[7px] border border-edge bg-field px-2.5 py-1.5 text-[13px] text-fg"
                />
              </label>
              <label>
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">Beschreibung</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-[7px] border border-edge bg-field px-2.5 py-1.5 text-[13px] leading-relaxed text-fg"
                />
              </label>
              <label>
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">Status</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="mt-1 w-full cursor-pointer rounded-[7px] border border-edge bg-field px-2.5 py-1.5 text-[13px] text-fg"
                >
                  {GOAL_STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>
            </div>
          )
        ) : (
          <div className="mt-3.5 text-[15px] font-medium leading-snug text-fg">{item.title}</div>
        )}

        {readOnly ? (
          <div className="mt-3.5 flex flex-wrap gap-x-6 gap-y-1.5 border-t border-edge pt-3.5 text-[12.5px] text-mid">
            <span>
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">Bahn </span>
              {laneName}
            </span>
            <span>
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">Zeitraum </span>
              {item.startMonth} – {item.endMonth}
            </span>
          </div>
        ) : (
          <div className="mt-3.5 flex flex-wrap gap-3 border-t border-edge pt-3.5">
            <label className="flex-1 basis-[130px]">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">Bahn</span>
              <select
                value={laneId}
                onChange={(e) => setLaneId(e.target.value)}
                className="mt-1 w-full cursor-pointer rounded-[7px] border border-edge bg-field px-2.5 py-1.5 text-[13px] text-fg"
              >
                {lanes.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </label>
            <label className="flex-1 basis-[130px]">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">Von</span>
              <input
                type="month"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="mt-1 w-full rounded-[7px] border border-edge bg-field px-2.5 py-1.5 text-[13px] text-fg"
              />
            </label>
            <label className="flex-1 basis-[130px]">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">Bis</span>
              <input
                type="month"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="mt-1 w-full rounded-[7px] border border-edge bg-field px-2.5 py-1.5 text-[13px] text-fg"
              />
            </label>
          </div>
        )}

        {error && <p className="mt-2.5 text-[12.5px] text-danger">{error}</p>}

        {readOnly ? (
          <div className="mt-4 flex justify-end">
            <button type="button" onClick={onClose} className="btn-secondary px-3.5 py-[7px]">
              Schließen
            </button>
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={onDelete}
              disabled={pending}
              className="rounded-[9px] border border-[#5a2a2a] px-3.5 py-[7px] text-[12.5px] text-danger hover:bg-[#1d0e0e] disabled:opacity-40"
            >
              Entfernen
            </button>
            <div className="ml-auto flex gap-2">
              <button type="button" onClick={onClose} className="btn-secondary px-3.5 py-[7px]">
                Schließen
              </button>
              {placementChanged && (
                <button
                  type="button"
                  onClick={() => onSavePlacement(laneId, start, end)}
                  disabled={pending}
                  className="btn-primary px-3.5 py-[7px] disabled:opacity-40"
                >
                  Zeitraum speichern
                </button>
              )}
              {isGoal && (
                <button
                  type="button"
                  onClick={() => onSaveGoal(title, description, status as "new" | "indeterminate" | "done")}
                  disabled={pending}
                  className="btn-primary px-3.5 py-[7px] disabled:opacity-40"
                >
                  Speichern
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
