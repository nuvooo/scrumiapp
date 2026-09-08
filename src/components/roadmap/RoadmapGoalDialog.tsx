"use client";

import { useState } from "react";
import type { LaneOption } from "./RoadmapItemDialog";

export function RoadmapGoalDialog({
  lanes,
  defaultMonth,
  pending,
  error,
  onClose,
  onCreate,
}: {
  lanes: LaneOption[];
  /** "YYYY-MM" — Vorbelegung für Start und Ende */
  defaultMonth: string;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onCreate: (laneId: string, title: string, description: string, startMonth: string, endMonth: string, storyPoints: number) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [laneId, setLaneId] = useState(lanes[0]?.id ?? "");
  const [start, setStart] = useState(defaultMonth);
  const [end, setEnd] = useState(defaultMonth);
  const [storyPoints, setStoryPoints] = useState("0");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="card w-full max-w-md px-[18px] py-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-[15px] font-semibold">Neues Ziel</h2>
        <label className="mt-3.5 block">
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">Titel</span>
          <input
            type="text"
            value={title}
            autoFocus
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-[7px] border border-edge bg-field px-2.5 py-1.5 text-[13px] text-fg"
            placeholder="z. B. Mobile-App Beta"
          />
        </label>
        <label className="mt-3 block">
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">Beschreibung</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-[7px] border border-edge bg-field px-2.5 py-1.5 text-[13px] leading-relaxed text-fg"
          />
        </label>
        <label className="mt-3 block">
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">Story Points</span>
          <input
            type="number"
            min="0"
            step="1"
            value={storyPoints}
            onChange={(e) => setStoryPoints(e.target.value)}
            className="mt-1 w-full rounded-[7px] border border-edge bg-field px-2.5 py-1.5 text-[13px] text-fg"
          />
        </label>
        <div className="mt-3 flex gap-3">
          <label className="flex-1">
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
          <label className="flex-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">Von</span>
            <input
              type="month"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="mt-1 w-full rounded-[7px] border border-edge bg-field px-2.5 py-1.5 text-[13px] text-fg"
            />
          </label>
          <label className="flex-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">Bis</span>
            <input
              type="month"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="mt-1 w-full rounded-[7px] border border-edge bg-field px-2.5 py-1.5 text-[13px] text-fg"
            />
          </label>
        </div>
        {error && <p className="mt-2.5 text-[12.5px] text-danger">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary px-3.5 py-[7px]">
            Abbrechen
          </button>
          <button
            type="button"
            onClick={() => onCreate(laneId, title, description, start, end, Number(storyPoints) || 0)}
            disabled={pending}
            className="btn-primary px-3.5 py-[7px] disabled:opacity-40"
          >
            {pending ? "Lege an…" : "Anlegen"}
          </button>
        </div>
      </div>
    </div>
  );
}
