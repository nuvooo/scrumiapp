"use client";

import { useState } from "react";
import { ROADMAP_PALETTE } from "./itemColors";
import type { MilestoneView } from "./types";

/** Meilenstein anlegen oder bearbeiten (tagesgenau). */
export function RoadmapMilestoneDialog({
  milestone,
  defaultDate,
  pending,
  error,
  onClose,
  onSubmit,
  onDelete,
}: {
  milestone: MilestoneView | null;
  /** "YYYY-MM-DD" */
  defaultDate: string;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (title: string, date: string, color: string) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(milestone?.title ?? "");
  const [date, setDate] = useState(milestone?.date ?? defaultDate);
  const [color, setColor] = useState<string>(milestone?.color ?? ROADMAP_PALETTE[2]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="card w-full max-w-sm px-[18px] py-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-[15px] font-semibold">{milestone ? "Meilenstein bearbeiten" : "Neuer Meilenstein"}</h2>
        <label className="mt-3.5 block">
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">Titel</span>
          <input
            type="text"
            value={title}
            autoFocus
            onChange={(e) => setTitle(e.target.value)}
            placeholder="z. B. Release Cockpit 2.0"
            className="mt-1 w-full rounded-[7px] border border-edge bg-field px-2.5 py-1.5 text-[13px] text-fg"
          />
        </label>
        <label className="mt-3 block">
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">Datum</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-full rounded-[7px] border border-edge bg-field px-2.5 py-1.5 text-[13px] text-fg"
          />
        </label>
        <div className="mt-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">Farbe</span>
          <div className="mt-1.5 flex gap-1.5">
            {ROADMAP_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Farbe ${c}`}
                onClick={() => setColor(c)}
                className={`h-5 w-5 rounded-full ${color === c ? "ring-2 ring-white" : ""}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        {error && <p className="mt-2.5 text-[12.5px] text-danger">{error}</p>}
        <div className="mt-4 flex items-center gap-2">
          {milestone && (
            <button
              type="button"
              onClick={onDelete}
              disabled={pending}
              className="rounded-[9px] border border-[#5a2a2a] px-3.5 py-[7px] text-[12.5px] text-danger hover:bg-[#1d0e0e] disabled:opacity-40"
            >
              Löschen
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={onClose} className="btn-secondary px-3.5 py-[7px]">
              Abbrechen
            </button>
            <button
              type="button"
              disabled={pending || !title.trim() || !date}
              onClick={() => onSubmit(title.trim(), date, color)}
              className="btn-primary px-3.5 py-[7px] disabled:opacity-40"
            >
              Speichern
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
