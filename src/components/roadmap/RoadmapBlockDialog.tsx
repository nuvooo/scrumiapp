"use client";

import { useState } from "react";
import { BLOCK_HUES } from "./itemColors";
import type { BlockView } from "./types";

export interface BlockOption {
  id: string;
  /** Eingerückter Anzeigename (Baumtiefe) */
  label: string;
  /** Nicht wählbar (eigener Teilbaum beim Bearbeiten) */
  disabled?: boolean;
}

/** Block anlegen (mit übergeordnetem Block) oder bearbeiten (Name, Farbe, löschen). */
export function RoadmapBlockDialog({
  block,
  parentOptions,
  defaultParentId,
  pending,
  error,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: {
  block: BlockView | null;
  parentOptions: BlockOption[];
  defaultParentId: string | null;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onCreate: (name: string, parentId: string | null, hue: number | null) => void;
  onUpdate: (name: string, hue: number | null) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(block?.name ?? "");
  const [hue, setHue] = useState<number | null>(block ? block.hue : defaultParentId ? null : BLOCK_HUES[0].hue);
  const [parentId, setParentId] = useState<string>(defaultParentId ?? "");

  const submit = () => {
    if (!name.trim()) return;
    if (block) onUpdate(name.trim(), hue);
    else onCreate(name.trim(), parentId || null, hue);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="card w-full max-w-md px-[18px] py-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-[15px] font-semibold">{block ? "Block bearbeiten" : "Neuer Block"}</h2>
        <label className="mt-3.5 block">
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">Name</span>
          <input
            type="text"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="z. B. Kundencockpit"
            className="mt-1 w-full rounded-[7px] border border-edge bg-field px-2.5 py-1.5 text-[13px] text-fg"
          />
        </label>
        {!block && (
          <label className="mt-3 block">
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">Übergeordneter Block</span>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="mt-1 w-full cursor-pointer rounded-[7px] border border-edge bg-field px-2.5 py-1.5 text-[13px] text-fg"
            >
              <option value="">— oberste Ebene —</option>
              {parentOptions.map((o) => (
                <option key={o.id} value={o.id} disabled={o.disabled}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="mt-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">Farbe</span>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setHue(null)}
              className={`rounded-[6px] border px-2 py-[3px] text-[11px] ${hue === null ? "border-fg text-fg" : "border-edge text-mid"}`}
              title="Farbe des nächsten übergeordneten Blocks übernehmen"
            >
              erben
            </button>
            {BLOCK_HUES.map((c) => (
              <button
                key={c.hue}
                type="button"
                aria-label={c.name}
                title={c.name}
                onClick={() => setHue(c.hue)}
                className={`h-5 w-5 rounded-full ${hue === c.hue ? "ring-2 ring-white" : ""}`}
                style={{ backgroundColor: `hsl(${c.hue} 48% 50%)` }}
              />
            ))}
          </div>
        </div>
        {error && <p className="mt-2.5 text-[12.5px] text-danger">{error}</p>}
        <div className="mt-4 flex items-center gap-2">
          {block && (
            <button
              type="button"
              onClick={onDelete}
              disabled={pending}
              className="rounded-[9px] border border-[#5a2a2a] px-3.5 py-[7px] text-[12.5px] text-danger hover:bg-[#1d0e0e] disabled:opacity-40"
              title="Unterblöcke werden mitgelöscht, Tickets wandern in den Eingangskorb"
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
              disabled={pending || !name.trim()}
              onClick={submit}
              className="btn-primary px-3.5 py-[7px] disabled:opacity-40"
            >
              {block ? "Speichern" : "Anlegen"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
