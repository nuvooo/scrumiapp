"use client";

import { useState } from "react";
import { ROADMAP_PALETTE } from "./itemColors";
import type { LabelView } from "./types";

/** Palette-Verwaltung: Labels anlegen, umbenennen, färben, löschen. */
export function RoadmapLabelsDialog({
  labels,
  pending,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: {
  labels: LabelView[];
  pending: boolean;
  onClose: () => void;
  onCreate: (name: string, color: string) => void;
  onUpdate: (id: string, name: string, color: string) => void;
  onDelete: (id: string) => void;
}) {
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>(ROADMAP_PALETTE[0]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="card w-full max-w-md px-[18px] py-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-[15px] font-semibold">Labels verwalten</h2>

        <div className="mt-3.5 flex flex-col gap-2">
          {labels.map((l) => (
            <div key={l.id} className="flex items-center gap-2">
              <input
                type="text"
                defaultValue={l.name}
                onBlur={(e) => {
                  if (e.target.value.trim() && e.target.value !== l.name) onUpdate(l.id, e.target.value, l.color);
                }}
                className="min-w-0 flex-1 rounded-[7px] border border-edge bg-field px-2.5 py-1.5 text-[13px] text-fg"
              />
              <div className="flex flex-none gap-1">
                {ROADMAP_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Farbe ${c}`}
                    onClick={() => onUpdate(l.id, l.name, c)}
                    className={`h-4 w-4 rounded-full ${l.color === c ? "ring-2 ring-white" : ""}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => onDelete(l.id)}
                aria-label={`Label ${l.name} löschen`}
                className="flex-none rounded px-1 text-[12px] text-faint hover:text-danger"
              >
                ✕
              </button>
            </div>
          ))}
          {labels.length === 0 && <p className="text-[12.5px] text-faint">Noch keine Labels.</p>}
        </div>

        <div className="mt-3.5 flex items-center gap-2 border-t border-edge pt-3.5">
          <input
            type="text"
            value={newName}
            placeholder="Neues Label…"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newName.trim()) {
                onCreate(newName.trim(), newColor);
                setNewName("");
              }
            }}
            className="min-w-0 flex-1 rounded-[7px] border border-edge bg-field px-2.5 py-1.5 text-[13px] text-fg"
          />
          <div className="flex flex-none gap-1">
            {ROADMAP_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Farbe ${c}`}
                onClick={() => setNewColor(c)}
                className={`h-4 w-4 rounded-full ${newColor === c ? "ring-2 ring-white" : ""}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <button
            type="button"
            disabled={pending || !newName.trim()}
            onClick={() => {
              onCreate(newName.trim(), newColor);
              setNewName("");
            }}
            className="btn-primary flex-none px-3 py-1.5 disabled:opacity-40"
          >
            +
          </button>
        </div>

        <div className="mt-4 flex justify-end">
          <button type="button" onClick={onClose} className="btn-secondary px-3.5 py-[7px]">
            Fertig
          </button>
        </div>
      </div>
    </div>
  );
}
