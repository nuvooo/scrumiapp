"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  saveCarryOverMark,
  moveIssueToPlannedSprint,
  fetchIssueDescription,
} from "@/app/(app)/planning/actions";
import { formatPoints } from "@/lib/format";

export interface CarryOverItemView {
  id: string;
  jiraKey: string;
  summary: string;
  issueType: string;
  status: string;
  storyPoints: number;
  assignee: string | null;
  url: string | null;
  takeAlong: boolean;
  remainingPoints: number;
}

export interface PlannedSprintOption {
  id: string;
  name: string;
}

function num(v: string): number {
  const n = parseFloat(v.replace(",", "."));
  return Number.isNaN(n) || n < 0 ? 0 : n;
}

function initialRemaining(items: CarryOverItemView[]) {
  return Object.fromEntries(items.map((i) => [i.jiraKey, String(i.remainingPoints)]));
}

function JiraLink({ jiraKey, url }: { jiraKey: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${jiraKey} in Jira öffnen`}
      title="In Jira öffnen"
      className="ml-auto flex-none rounded-md p-1 text-faint hover:bg-chip hover:text-link md:ml-0"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </svg>
    </a>
  );
}

export function CarryOverList({
  sprintId,
  items,
  plannedSprints,
}: {
  sprintId: string;
  items: CarryOverItemView[];
  plannedSprints: PlannedSprintOption[];
}) {
  const [remaining, setRemaining] = useState(() => initialRemaining(items));
  const [error, setError] = useState<string | null>(null);
  const [movingKey, setMovingKey] = useState<string | null>(null);
  const [active, setActive] = useState<number | null>(null);
  /** Cache der Jira-Beschreibungen; null = lädt gerade. */
  const [descriptions, setDescriptions] = useState<Record<string, string | null>>({});
  const [, startTransition] = useTransition();
  const activeCardRef = useRef<HTMLDivElement | null>(null);

  // Beim Sprint-Wechsel bleibt die Komponente gemountet — Eingaben zurücksetzen
  // (React-Muster "adjusting state during render").
  const [syncedSprintId, setSyncedSprintId] = useState(sprintId);
  if (syncedSprintId !== sprintId) {
    setSyncedSprintId(sprintId);
    setRemaining(initialRemaining(items));
    setActive(null);
  }

  // Nach dem Verschieben eines Tickets schrumpft die Liste — Index einfangen.
  const activeIndex = active === null || items.length === 0 ? null : Math.min(active, items.length - 1);
  const activeItem = activeIndex === null ? null : items[activeIndex];

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      setError(null);
      const result = await fn();
      if (!result.ok) setError(result.error ?? "Aktion fehlgeschlagen.");
    });

  const save = (item: CarryOverItemView, takeAlong: boolean) =>
    run(() => saveCarryOverMark(sprintId, item.jiraKey, takeAlong, num(remaining[item.jiraKey] ?? "0")));

  const move = (item: CarryOverItemView, targetSprintId: string) => {
    if (!targetSprintId) return;
    setMovingKey(item.jiraKey);
    startTransition(async () => {
      setError(null);
      const result = await moveIssueToPlannedSprint(sprintId, item.jiraKey, targetSprintId);
      if (!result.ok) setError(result.error ?? "Verschieben fehlgeschlagen.");
      setMovingKey(null);
    });
  };

  // Beschreibung des aktiven Tickets nachladen (einmal pro Ticket).
  const activeKey = activeItem?.jiraKey ?? null;
  useEffect(() => {
    if (activeKey === null || descriptions[activeKey] !== undefined) return;
    setDescriptions((prev) => ({ ...prev, [activeKey]: null }));
    fetchIssueDescription(activeKey).then((result) => {
      setDescriptions((prev) => ({ ...prev, [activeKey]: result.ok ? (result.data ?? "") : "" }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey]);

  // Aktive Karte in die Mitte scrollen.
  useEffect(() => {
    if (activeIndex !== null) {
      activeCardRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [activeIndex]);

  // Pfeiltasten: hoch/runter navigieren, Escape beendet — außer in Eingabefeldern.
  useEffect(() => {
    if (activeIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        setActive(Math.min(activeIndex + 1, items.length - 1));
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        setActive(Math.max(activeIndex - 1, 0));
      } else if (e.key === "Escape") {
        setActive(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIndex, items.length]);

  const description = activeKey === null ? undefined : descriptions[activeKey];

  return (
    <div className="mt-3.5 flex flex-col gap-2">
      <div className="flex items-center gap-3">
        {activeIndex === null ? (
          <button
            type="button"
            onClick={() => setActive(0)}
            disabled={items.length === 0}
            className="btn-primary px-3.5 py-[7px]"
          >
            ▶ Tickets durchgehen
          </button>
        ) : (
          <>
            <button type="button" onClick={() => setActive(null)} className="btn-secondary px-3.5 py-[7px]">
              ✕ Beenden
            </button>
            <span className="font-mono text-[11.5px] text-faint">
              {activeIndex + 1} / {items.length} · Pfeiltasten: hoch/runter
            </span>
          </>
        )}
      </div>
      {error && (
        <div className="rounded-[10px] border border-[#5a2a2a] bg-[#1d0e0e] px-3.5 py-2.5 text-[13px] text-danger">
          {error}
        </div>
      )}
      {items.map((i, index) => {
        const moving = movingKey === i.jiraKey;
        const isActive = index === activeIndex;
        const dimmed = activeIndex !== null && !isActive;

        const takeAlongControl = (
          <label className={`flex flex-none cursor-pointer items-center gap-2 ${isActive ? "" : "w-[104px]"}`}>
            <input
              type="checkbox"
              checked={i.takeAlong}
              disabled={moving}
              onChange={(e) => save(i, e.target.checked)}
              className="h-3.5 w-3.5 accent-[#4c9fc4]"
            />
            <span className={`${isActive ? "text-[12.5px]" : "text-[11.5px]"} text-mid`}>mitnehmen</span>
          </label>
        );
        const restControl = (
          <label className="flex flex-none items-center gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">Rest</span>
            <input
              type="text"
              inputMode="decimal"
              aria-label={`Rest-Story-Points für ${i.jiraKey}`}
              value={remaining[i.jiraKey] ?? ""}
              disabled={moving}
              onChange={(e) => setRemaining((prev) => ({ ...prev, [i.jiraKey]: e.target.value }))}
              onBlur={() => i.takeAlong && save(i, true)}
              className="w-[52px] rounded-[7px] border border-edge bg-chip px-2 py-[3px] text-right font-mono text-[11.5px] text-fg"
            />
            <span className="font-mono text-[10px] text-faint">SP</span>
          </label>
        );
        const moveControl = (
          <div className="relative flex-none">
            <select
              aria-label={`${i.jiraKey} in geplanten Sprint verschieben`}
              className="cursor-pointer appearance-none rounded-[9px] border border-edge bg-field py-[5px] pl-[9px] pr-[26px] text-[11.5px] text-mid"
              value=""
              disabled={moving || plannedSprints.length === 0}
              onChange={(e) => move(i, e.target.value)}
            >
              <option value="">{moving ? "Verschiebe…" : "Verschieben nach…"}</option>
              {plannedSprints.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-faint">▾</span>
          </div>
        );

        if (isActive) {
          return (
            <div
              key={i.jiraKey}
              ref={activeCardRef}
              data-testid={`carryover-card-${i.jiraKey}`}
              className={`flex min-h-[216px] flex-col gap-3 rounded-[10px] border-2 border-accent bg-[#0a1418] px-[18px] py-4 shadow-[0_0_24px_rgba(76,159,196,0.15)] ${moving ? "opacity-50" : ""}`}
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className="font-mono text-[12.5px] text-link">{i.jiraKey}</span>
                <span className="flex-none font-mono text-[10.5px] uppercase tracking-[0.08em] text-faint">
                  {i.issueType}
                </span>
                <span className="flex-none rounded-full border border-edge px-2 py-[2px] font-mono text-[10.5px] text-mid">
                  {i.status}
                </span>
                <span className="flex-none rounded-full border border-edge bg-chip px-2 py-[2px] font-mono text-[10.5px] text-fg">
                  {formatPoints(i.storyPoints)} SP
                </span>
                <span className="flex-none text-[11.5px] text-muted">
                  👤 {i.assignee ?? "nicht zugewiesen"}
                </span>
                {i.url && <JiraLink jiraKey={i.jiraKey} url={i.url} />}
              </div>
              <div className="text-[15px] font-medium leading-snug text-fg">{i.summary}</div>
              <div className="min-h-[54px] flex-1 overflow-y-auto whitespace-pre-wrap rounded-[8px] border border-edge bg-field px-3 py-2.5 text-[12.5px] leading-relaxed text-mid max-h-44">
                {description === null && <span className="text-faint">Beschreibung wird geladen…</span>}
                {typeof description === "string" && description.length > 0 && description}
                {description === "" && <span className="text-faint">Keine Beschreibung im Jira-Ticket.</span>}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                {takeAlongControl}
                {restControl}
                {moveControl}
                <div className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActive(Math.max(activeIndex - 1, 0))}
                    disabled={activeIndex === 0}
                    className="btn-secondary px-3 py-[6px] disabled:opacity-40"
                  >
                    ↑ Zurück
                  </button>
                  <button
                    type="button"
                    onClick={() => setActive(Math.min(activeIndex + 1, items.length - 1))}
                    disabled={activeIndex >= items.length - 1}
                    className="btn-primary px-3 py-[6px] disabled:opacity-40"
                  >
                    ↓ Weiter
                  </button>
                </div>
              </div>
            </div>
          );
        }

        return (
          <div
            key={i.jiraKey}
            data-testid={`carryover-card-${i.jiraKey}`}
            onClick={activeIndex !== null ? () => setActive(index) : undefined}
            className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[10px] border px-3.5 py-2.5 ${
              i.takeAlong ? "border-[#24404a] bg-[#0a1418]" : "border-edge bg-field"
            } ${moving ? "opacity-50" : ""} ${dimmed ? "cursor-pointer opacity-55 hover:opacity-90" : ""}`}
          >
            {takeAlongControl}
            <span className="w-[76px] flex-none font-mono text-[11.5px] text-link">{i.jiraKey}</span>
            <span className="min-w-0 flex-1 truncate text-[13px] text-fg">{i.summary}</span>
            <div className="flex w-full flex-wrap items-center gap-3 md:w-auto md:flex-none">
              <span className="flex-none rounded-full border border-edge px-2 py-[2px] font-mono text-[10.5px] text-mid">
                {i.status}
              </span>
              <span className="flex-none font-mono text-[10.5px] text-faint">
                {formatPoints(i.storyPoints)} SP
              </span>
              {restControl}
              {moveControl}
              {i.url && <JiraLink jiraKey={i.jiraKey} url={i.url} />}
            </div>
          </div>
        );
      })}
      {items.length === 0 && (
        <div className="rounded-[10px] border border-dashed border-edge py-8 text-center text-[13px] text-muted">
          Keine offenen Tickets im aktiven Sprint.
        </div>
      )}
    </div>
  );
}
