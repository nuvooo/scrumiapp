"use client";

import { useState } from "react";
import { laneHue } from "./itemColors";
import type { LaneView } from "./types";

/** Streams (Frontend, Backend, UX …) verwalten: anlegen, umbenennen, sortieren, löschen. */
export function RoadmapLanesDialog({
  lanes,
  itemCountByLane,
  pending,
  onClose,
  onCreate,
  onRename,
  onMove,
  onDelete,
}: {
  lanes: LaneView[];
  itemCountByLane: Map<string, number>;
  pending: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  /** Wird nur nach Bestätigung aufgerufen (Tickets des Streams werden mitgelöscht). */
  onDelete: (lane: LaneView, count: number) => void;
}) {
  const [newName, setNewName] = useState("");

  const create = () => {
    if (!newName.trim()) return;
    onCreate(newName.trim());
    setNewName("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="card w-full max-w-md px-[18px] py-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-[15px] font-semibold">Streams verwalten</h2>
        <p className="mt-1 text-[12px] text-muted">Je Block eine Zeile pro Stream, in dem Tickets liegen.</p>

        <div className="mt-3.5 flex flex-col gap-2">
          {lanes.map((l, index) => (
            <div key={l.id} className="flex items-center gap-2">
              <span
                className="grid h-5 w-5 flex-none place-items-center rounded-[5px] text-[9px] font-semibold text-white"
                style={{ backgroundColor: `hsl(${laneHue(index)} 44% 46%)` }}
              >
                {l.name.slice(0, 2).toUpperCase()}
              </span>
              <input
                type="text"
                defaultValue={l.name}
                aria-label={`Stream ${l.name} umbenennen`}
                onBlur={(e) => {
                  if (e.target.value.trim() && e.target.value !== l.name) onRename(l.id, e.target.value);
                }}
                className="min-w-0 flex-1 rounded-[7px] border border-edge bg-field px-2.5 py-1.5 text-[13px] text-fg"
              />
              <button
                type="button"
                onClick={() => onMove(l.id, -1)}
                disabled={pending || index === 0}
                aria-label="nach oben"
                className="rounded px-1 text-[12px] text-faint hover:text-fg disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => onMove(l.id, 1)}
                disabled={pending || index === lanes.length - 1}
                aria-label="nach unten"
                className="rounded px-1 text-[12px] text-faint hover:text-fg disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => onDelete(l, itemCountByLane.get(l.id) ?? 0)}
                disabled={pending || lanes.length <= 1}
                aria-label={`Stream ${l.name} löschen`}
                className="rounded px-1 text-[12px] text-faint hover:text-danger disabled:opacity-30"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="mt-3.5 flex gap-2 border-t border-edge pt-3.5">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="Neuer Stream, z. B. QA"
            className="min-w-0 flex-1 rounded-[7px] border border-edge bg-field px-2.5 py-1.5 text-[13px] text-fg"
          />
          <button type="button" onClick={create} disabled={pending || !newName.trim()} className="btn-secondary px-3 py-1.5 disabled:opacity-40">
            + Anlegen
          </button>
        </div>

        <div className="mt-4 flex justify-end">
          <button type="button" onClick={onClose} className="btn-secondary px-3.5 py-[7px]">
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}
