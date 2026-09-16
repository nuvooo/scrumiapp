"use client";

import { useState } from "react";
import { dayDiff, formatDay } from "@/lib/view/roadmapDays";
import { typeBadge } from "./itemColors";
import type { LabelView, LaneView, Placement, RoadmapItemView } from "./types";
import type { BlockOption } from "./RoadmapBlockDialog";

const GOAL_STATUS_OPTIONS = [
  { value: "new", label: "Offen" },
  { value: "indeterminate", label: "In Arbeit" },
  { value: "done", label: "Fertig" },
] as const;

const STATUS_TEXT: Record<string, string> = { done: "Ausgeführt", indeterminate: "In Bearbeitung", new: "Offen" };

/** Detailkarte unten rechts. Betrachter: nur ansehen; Moderatoren: bearbeiten. */
export function RoadmapItemDrawer({
  item,
  lanes,
  blockOptions,
  blockPath,
  labels,
  pending,
  error,
  readOnly,
  onClose,
  onDelete,
  onSavePlacement,
  onSaveGoal,
  onSaveLabels,
}: {
  item: RoadmapItemView;
  lanes: LaneView[];
  blockOptions: BlockOption[];
  /** "Headless › Kundencockpit › Retouren" oder "Eingangskorb" */
  blockPath: string;
  labels: LabelView[];
  pending: boolean;
  error: string | null;
  readOnly: boolean;
  onClose: () => void;
  onDelete: () => void;
  onSavePlacement: (placement: Placement) => void;
  onSaveGoal: (title: string, description: string, statusCategory: "new" | "indeterminate" | "done", storyPoints: number) => void;
  onSaveLabels: (labelIds: string[]) => void;
}) {
  const isGoal = item.jiraKey === null;
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description ?? "");
  const [status, setStatus] = useState(item.statusCategory ?? "new");
  const [storyPoints, setStoryPoints] = useState(String(item.storyPoints ?? 0));
  const [laneId, setLaneId] = useState(item.laneId);
  const [blockId, setBlockId] = useState(item.blockId ?? "");
  const [start, setStart] = useState(item.startDate);
  const [end, setEnd] = useState(item.endDate);
  const [labelIds, setLabelIds] = useState<string[]>(item.labelIds);

  const placementChanged =
    laneId !== item.laneId || (blockId || null) !== item.blockId || start !== item.startDate || end !== item.endDate;
  const goalChanged =
    isGoal &&
    (title !== item.title || description !== (item.description ?? "") || status !== (item.statusCategory ?? "new") ||
      (Number(storyPoints) || 0) !== item.storyPoints);
  const labelsChanged = labelIds.length !== item.labelIds.length || labelIds.some((id) => !item.labelIds.includes(id));
  const toggleLabel = (id: string) =>
    setLabelIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const laneName = lanes.find((l) => l.id === item.laneId)?.name ?? "";
  const itemLabels = labels.filter((l) => item.labelIds.includes(l.id));
  const days = dayDiff(item.startDate, item.endDate) + 1;
  const field = "mt-1 w-full rounded-[7px] border border-edge bg-field px-2 py-1 text-[12.5px] text-fg";

  return (
    <aside className="rm-drawer" aria-live="polite" data-roadmap-drawer>
      <button type="button" className="x" onClick={onClose} aria-label="Schließen">
        ✕
      </button>
      <div className="k">
        <span className="rounded-full border border-edge px-1.5 py-[1px] text-[9.5px] uppercase tracking-[0.08em]">{typeBadge(item)}</span>
        {item.jiraKey && <span>{item.jiraKey}</span>}
        {item.url && (
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-link hover:text-linkhi">
            Jira ↗
          </a>
        )}
      </div>
      <h3>{item.title}</h3>
      {isGoal && item.description && readOnly && (
        <p className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-mid">{item.description}</p>
      )}

      <dl>
        <dt>Block</dt>
        <dd>{blockPath}</dd>
        <dt>Zeitraum</dt>
        <dd>
          {formatDay(item.startDate)} – {formatDay(item.endDate)}
        </dd>
        <dt>Dauer</dt>
        <dd>{days} {days === 1 ? "Tag" : "Tage"}</dd>
        <dt>Stream</dt>
        <dd>{laneName}</dd>
        <dt>Status</dt>
        <dd>{item.statusLabel ?? STATUS_TEXT[item.statusCategory ?? "new"] ?? "Offen"}</dd>
        <dt>Story Points</dt>
        <dd>{item.storyPoints}</dd>
        {item.assignee && (
          <>
            <dt>Assignee</dt>
            <dd>{item.assignee}</dd>
          </>
        )}
        {item.blockedBy.length > 0 && (
          <>
            <dt>Blockiert von</dt>
            <dd>{item.blockedBy.join(", ")}</dd>
          </>
        )}
        {itemLabels.length > 0 && (
          <>
            <dt>Labels</dt>
            <dd>
              {itemLabels.map((l) => (
                <span key={l.id} className="rm-chip" style={{ backgroundColor: l.color }}>
                  {l.name}
                </span>
              ))}
            </dd>
          </>
        )}
      </dl>

      {readOnly ? (
        <p className="hint">
          {isGoal
            ? "Eigenes Ziel — Status wird im Tool gepflegt."
            : "Aus Jira synchronisiert: Status, Assignee, Story Points, Abhängigkeiten. Im Tool gepflegt: Start, Ende, Block, Stream."}
        </p>
      ) : (
        <div className="form">
          {isGoal && (
            <>
              <label>
                <span className="lbl">Titel</span>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={field} />
              </label>
              <label>
                <span className="lbl">Beschreibung</span>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={`${field} leading-relaxed`} />
              </label>
              <div className="row2">
                <label>
                  <span className="lbl">Status</span>
                  <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${field} cursor-pointer`}>
                    {GOAL_STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="lbl">Story Points</span>
                  <input type="number" min="0" step="1" value={storyPoints} onChange={(e) => setStoryPoints(e.target.value)} className={field} />
                </label>
              </div>
            </>
          )}
          <div className="row2">
            <label>
              <span className="lbl">Block</span>
              <select value={blockId} onChange={(e) => setBlockId(e.target.value)} className={`${field} cursor-pointer`}>
                <option value="">Eingangskorb</option>
                {blockOptions.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="lbl">Stream</span>
              <select value={laneId} onChange={(e) => setLaneId(e.target.value)} className={`${field} cursor-pointer`}>
                {lanes.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="row2">
            <label>
              <span className="lbl">Von</span>
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={field} />
            </label>
            <label>
              <span className="lbl">Bis</span>
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className={field} />
            </label>
          </div>
          {labels.length > 0 && (
            <div>
              <span className="lbl">Labels</span>
              <div className="mt-1.5">
                {labels.map((l) => {
                  const on = labelIds.includes(l.id);
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => toggleLabel(l.id)}
                      className={`rm-chipbtn ${on ? "on" : ""}`}
                      style={{ backgroundColor: on ? l.color : "transparent", border: `1px solid ${l.color}` }}
                    >
                      {l.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {error && <p className="text-[12px] text-danger">{error}</p>}
          <div className="actions">
            <button
              type="button"
              onClick={onDelete}
              disabled={pending}
              className="rounded-[7px] border border-[#5a2a2a] px-2.5 py-[5px] text-[11.5px] text-danger hover:bg-[#1d0e0e] disabled:opacity-40"
            >
              Entfernen
            </button>
            <span className="rm-spacer" />
            {labelsChanged && (
              <button type="button" onClick={() => onSaveLabels(labelIds)} disabled={pending} className="btn-primary px-2.5 py-[5px] text-[11.5px] disabled:opacity-40">
                Labels speichern
              </button>
            )}
            {placementChanged && (
              <button
                type="button"
                onClick={() => onSavePlacement({ laneId, blockId: blockId || null, startDate: start, endDate: end })}
                disabled={pending}
                className="btn-primary px-2.5 py-[5px] text-[11.5px] disabled:opacity-40"
              >
                Position speichern
              </button>
            )}
            {goalChanged && (
              <button
                type="button"
                onClick={() => onSaveGoal(title, description, status as "new" | "indeterminate" | "done", Number(storyPoints) || 0)}
                disabled={pending}
                className="btn-primary px-2.5 py-[5px] text-[11.5px] disabled:opacity-40"
              >
                Speichern
              </button>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
