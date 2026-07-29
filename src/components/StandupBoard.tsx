"use client";

import { useEffect, useRef, useState } from "react";

export interface StandupIssue {
  jiraKey: string;
  summary: string;
  issueType: string;
  status: string;
}

export interface StandupGroupView {
  /** null = "Ohne Bearbeiter" */
  name: string | null;
  openIssues: StandupIssue[];
  doneIssues: StandupIssue[];
}

export interface StandupColumn {
  name: string;
  /** Status-Namen, die dieser Spalte zugeordnet sind. */
  statuses: string[];
}

const STORAGE_KEY = "scrumi.standup.seconds";
const DEFAULT_SECONDS = 120;

function parseDuration(text: string): number | null {
  const m = text.trim().match(/^(\d{1,2})(?::([0-5]\d))?$/);
  if (!m) return null;
  const seconds = parseInt(m[1], 10) * 60 + (m[2] ? parseInt(m[2], 10) : 0);
  return seconds > 0 ? seconds : null;
}

function formatClock(totalSeconds: number): string {
  const sign = totalSeconds < 0 ? "-" : "";
  const abs = Math.abs(totalSeconds);
  return `${sign}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, "0")}`;
}

function shuffled<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function groupLabel(name: string | null): string {
  return name ?? "Ohne Bearbeiter";
}

function initials(name: string | null): string {
  if (!name) return "–";
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function IssueCard({ issue, done }: { issue: StandupIssue; done: boolean }) {
  return (
    <div className={`rounded-[9px] border p-2.5 ${done ? "border-[#1F3D2B] bg-[#0F1A14]" : "border-edge bg-field"}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[11px] text-link">{issue.jiraKey}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">{issue.issueType}</span>
      </div>
      <div className={`mt-1.5 text-[12.5px] leading-snug ${done ? "text-dim line-through" : "text-fg"}`}>
        {issue.summary}
      </div>
    </div>
  );
}

interface FilledColumn {
  name: string;
  issues: StandupIssue[];
  done: boolean;
}

/**
 * Verteilt die Tickets einer Person auf die Jira-Board-Spalten; nicht
 * zuordenbare offene Tickets landen in "Sonstige", Erledigtes in einer
 * eigenen Spalte am Ende. Ohne Spalten-Konfiguration: eine Spalte "Offen".
 */
function fillColumns(group: StandupGroupView, columns: StandupColumn[]): FilledColumn[] {
  const base: FilledColumn[] =
    columns.length > 0
      ? columns.map((c) => ({
          name: c.name,
          issues: group.openIssues.filter((i) => c.statuses.includes(i.status)),
          done: false,
        }))
      : [{ name: "Offen", issues: [...group.openIssues], done: false }];

  const assigned = new Set(base.flatMap((c) => c.issues.map((i) => i.jiraKey)));
  const rest = group.openIssues.filter((i) => !assigned.has(i.jiraKey));
  if (rest.length > 0) base.push({ name: "Sonstige", issues: rest, done: false });

  base.push({ name: "Erledigt", issues: group.doneIssues, done: true });
  return base;
}

export function StandupBoard({
  groups,
  columns,
}: {
  groups: StandupGroupView[];
  columns: StandupColumn[];
}) {
  const [phase, setPhase] = useState<"setup" | "running" | "done">("setup");
  const [durationText, setDurationText] = useState("2:00");
  const [order, setOrder] = useState(groups);
  const [current, setCurrent] = useState(0);
  const [remaining, setRemaining] = useState(DEFAULT_SECONDS);
  const [elapsedByPerson, setElapsedByPerson] = useState<number[]>([]);
  const secondsRef = useRef(DEFAULT_SECONDS);

  // Gespeicherte Redezeit erst nach dem Mount lesen (SSR-sicher).
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const seconds = stored ? parseInt(stored, 10) : NaN;
    if (Number.isFinite(seconds) && seconds > 0) {
      setDurationText(formatClock(seconds));
    }
  }, []);

  useEffect(() => {
    if (phase !== "running") return;
    const timer = setInterval(() => setRemaining((r) => r - 1), 1000);
    return () => clearInterval(timer);
  }, [phase, current]);

  const start = () => {
    const seconds = parseDuration(durationText) ?? DEFAULT_SECONDS;
    secondsRef.current = seconds;
    window.localStorage.setItem(STORAGE_KEY, String(seconds));
    setOrder(shuffled(groups));
    setCurrent(0);
    setRemaining(seconds);
    setElapsedByPerson([]);
    setPhase("running");
  };

  const next = () => {
    setElapsedByPerson((prev) => [...prev, secondsRef.current - remaining]);
    if (current + 1 >= order.length) {
      setPhase("done");
    } else {
      setCurrent((c) => c + 1);
      setRemaining(secondsRef.current);
    }
  };

  useEffect(() => {
    if (phase !== "running") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.target instanceof HTMLInputElement) return;
      e.preventDefault();
      next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, current, remaining, order.length]);

  if (groups.length === 0) {
    return (
      <div className="card mt-6 px-[18px] py-10 text-center text-[13px] text-muted">
        Keine Tickets mit Bearbeiter im aktiven Sprint. Nach dem nächsten Sync stehen die Bearbeiter zur Verfügung.
      </div>
    );
  }

  if (phase === "setup") {
    return (
      <div className="card mt-6 p-[22px]">
        <div className="text-sm font-semibold">Standup vorbereiten</div>
        <div className="mt-1.5 text-[13px] text-muted">
          {groups.length} Teilnehmer · Reihenfolge wird beim Start zufällig gemischt
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-[13px] text-mid">
            Redezeit pro Person
            <input
              aria-label="Redezeit pro Person"
              value={durationText}
              onChange={(e) => setDurationText(e.target.value)}
              className="w-[72px] rounded-[7px] border border-edge bg-field px-2.5 py-1.5 text-center font-mono text-[13px] text-fg"
            />
          </label>
          <button onClick={start} className="btn-primary px-4 py-[9px]">
            Standup starten
          </button>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {groups.map((g) => (
            <span key={groupLabel(g.name)} className="rounded-full border border-edge bg-field px-2.5 py-1 text-[12.5px] text-mid">
              {groupLabel(g.name)} · {g.openIssues.length + g.doneIssues.length}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (phase === "done") {
    const total = elapsedByPerson.reduce((a, b) => a + b, 0);
    return (
      <div className="card mt-6 p-[22px]">
        <div className="text-sm font-semibold">Standup beendet 🎉</div>
        <div className="mt-1.5 text-[13px] text-muted">Gesamt: {formatClock(total)} Minuten</div>
        <div className="mt-4">
          {order.map((g, i) => {
            const elapsed = elapsedByPerson[i] ?? 0;
            const over = elapsed > secondsRef.current;
            return (
              <div key={groupLabel(g.name)} className="flex items-baseline gap-2.5 border-b border-row py-[7px] text-[13px] last:border-b-0">
                <span>{groupLabel(g.name)}</span>
                <span className={`ml-auto font-mono ${over ? "text-warn" : "text-mid"}`}>
                  {formatClock(elapsed)}{over ? " · überzogen" : ""}
                </span>
              </div>
            );
          })}
        </div>
        <button onClick={() => setPhase("setup")} className="btn-primary mt-5 px-4 py-[9px]">
          Neues Standup
        </button>
      </div>
    );
  }

  const active = order[current];
  const overrun = remaining < 0;
  return (
    <div>
      <div className="card mt-6 p-[22px]">
        <div className="flex flex-wrap items-center gap-3.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cell font-mono text-[13px] text-mid">
            {initials(active.name)}
          </span>
          <div>
            <h2 className="text-[17px] font-semibold">{groupLabel(active.name)}</h2>
            <div className="font-mono text-[11px] text-faint">
              Person {current + 1} von {order.length}
            </div>
          </div>
          <div
            aria-label="Verbleibende Redezeit"
            className={`ml-auto font-mono text-[34px] font-semibold tabular-nums tracking-[-0.02em] ${overrun ? "text-warn" : "text-fg"}`}
          >
            {formatClock(remaining)}
          </div>
          <button onClick={next} className="btn-primary px-4 py-[9px]">
            {current + 1 >= order.length ? "Fertig" : "Weiter"}
          </button>
        </div>
        {overrun && <div className="mt-2 text-right text-[12px] text-warn">Redezeit überzogen</div>}

        <div className="mt-5 overflow-x-auto pb-1">
          <div className="flex items-start gap-3">
            {fillColumns(active, columns).map((col) => (
              <div
                key={col.name}
                data-testid={`standup-col-${col.name}`}
                className="w-[210px] flex-none rounded-[10px] border border-line bg-raise p-2.5"
              >
                <div className="flex items-baseline justify-between px-0.5 pb-2">
                  <span className={`font-mono text-[10.5px] uppercase tracking-[0.1em] ${col.done ? "text-ok" : "text-dim"}`}>
                    {col.name}
                  </span>
                  <span className="font-mono text-[10.5px] text-faint">{col.issues.length}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {col.issues.map((i) => (
                    <IssueCard key={i.jiraKey} issue={i} done={col.done} />
                  ))}
                  {col.issues.length === 0 && (
                    <div className="rounded-[9px] border border-dashed border-edge py-3 text-center font-mono text-[10.5px] text-faint">
                      leer
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3.5 flex flex-wrap gap-2">
        {order.map((g, i) => (
          <span
            key={groupLabel(g.name)}
            className={`rounded-full border px-2.5 py-1 text-[12.5px] ${
              i === current
                ? "border-[#3D4D75] bg-chip text-fg"
                : i < current
                  ? "border-edge bg-field text-faint line-through"
                  : "border-edge bg-field text-mid"
            }`}
          >
            {groupLabel(g.name)}
          </span>
        ))}
      </div>
      <div className="mt-3 font-mono text-[11px] text-faint">Leertaste oder „Weiter" wechselt zur nächsten Person</div>
    </div>
  );
}
