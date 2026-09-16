"use client";

import { useState } from "react";
import { addDays } from "@/lib/view/roadmapDays";
import type { LaneView } from "./types";
import type { BlockOption } from "./RoadmapBlockDialog";

export function RoadmapGoalDialog({
  lanes,
  blockOptions,
  defaultDate,
  pending,
  error,
  onClose,
  onCreate,
}: {
  lanes: LaneView[];
  blockOptions: BlockOption[];
  /** "YYYY-MM-DD" — Vorbelegung für den Start */
  defaultDate: string;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onCreate: (
    laneId: string,
    blockId: string | null,
    title: string,
    description: string,
    startDate: string,
    endDate: string,
    storyPoints: number,
  ) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [laneId, setLaneId] = useState(lanes[0]?.id ?? "");
  const [blockId, setBlockId] = useState("");
  const [start, setStart] = useState(defaultDate);
  const [end, setEnd] = useState(addDays(defaultDate, 13));
  const [storyPoints, setStoryPoints] = useState("0");

  const field = "mt-1 w-full rounded-[7px] border border-edge bg-field px-2.5 py-1.5 text-[13px] text-fg";
  const label = "font-mono text-[10px] uppercase tracking-[0.08em] text-faint";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="card w-full max-w-md px-[18px] py-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-[15px] font-semibold">Neues Ziel</h2>
        <label className="mt-3.5 block">
          <span className={label}>Titel</span>
          <input type="text" value={title} autoFocus onChange={(e) => setTitle(e.target.value)} className={field} placeholder="z. B. Mobile-App Beta" />
        </label>
        <label className="mt-3 block">
          <span className={label}>Beschreibung</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={`${field} leading-relaxed`} />
        </label>
        <div className="mt-3 flex gap-3">
          <label className="flex-1">
            <span className={label}>Block</span>
            <select value={blockId} onChange={(e) => setBlockId(e.target.value)} className={`${field} cursor-pointer`}>
              <option value="">Eingangskorb</option>
              {blockOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className="flex-1">
            <span className={label}>Stream</span>
            <select value={laneId} onChange={(e) => setLaneId(e.target.value)} className={`${field} cursor-pointer`}>
              {lanes.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-3 flex gap-3">
          <label className="flex-1">
            <span className={label}>Von</span>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={field} />
          </label>
          <label className="flex-1">
            <span className={label}>Bis</span>
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className={field} />
          </label>
          <label className="w-24">
            <span className={label}>SP</span>
            <input type="number" min="0" step="1" value={storyPoints} onChange={(e) => setStoryPoints(e.target.value)} className={field} />
          </label>
        </div>
        {error && <p className="mt-2.5 text-[12.5px] text-danger">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary px-3.5 py-[7px]">
            Abbrechen
          </button>
          <button
            type="button"
            onClick={() => onCreate(laneId, blockId || null, title, description, start, end, Number(storyPoints) || 0)}
            disabled={pending || !title.trim()}
            className="btn-primary px-3.5 py-[7px] disabled:opacity-40"
          >
            {pending ? "Lege an…" : "Anlegen"}
          </button>
        </div>
      </div>
    </div>
  );
}
