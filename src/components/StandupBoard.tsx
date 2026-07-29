"use client";

import { useEffect, useRef, useState } from "react";

export interface StandupIssue {
  jiraKey: string;
  summary: string;
  issueType: string;
  status: string;
  /** Link zum Ticket in Jira (null, wenn keine Basis-URL konfiguriert ist). */
  url: string | null;
}

export interface StandupGroupView {
  /** null = "Ohne Bearbeiter" */
  name: string | null;
  openIssues: StandupIssue[];
  doneIssues: StandupIssue[];
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
    <div
      data-testid={`standup-card-${issue.jiraKey}`}
      className={`flex items-center gap-3 rounded-[10px] border px-3.5 py-2.5 ${
        done ? "border-[#1F3D2B] bg-[#0F1A14]" : "border-edge bg-field"
      }`}
    >
      <span className="w-[76px] flex-none font-mono text-[11.5px] text-link">{issue.jiraKey}</span>
      <span className={`min-w-0 flex-1 truncate text-[13px] ${done ? "text-dim line-through" : "text-fg"}`}>
        {issue.summary}
      </span>
      <span className="flex-none font-mono text-[10.5px] uppercase tracking-[0.08em] text-faint">
        {issue.issueType}
      </span>
      <span
        className={`flex-none rounded-full border px-2 py-[2px] font-mono text-[10.5px] ${
          done ? "border-[#1F3D2B] text-ok" : "border-edge text-mid"
        }`}
      >
        {done ? "erledigt" : issue.status}
      </span>
      {issue.url && (
        <a
          href={issue.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${issue.jiraKey} in Jira öffnen`}
          title="In Jira öffnen"
          className="flex-none rounded-md p-1 text-faint hover:bg-chip hover:text-link"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
      )}
    </div>
  );
}

export function StandupBoard({ groups }: { groups: StandupGroupView[] }) {
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

        <div className="mt-5 flex flex-col gap-2">
          {active.openIssues.map((i) => (
            <IssueCard key={i.jiraKey} issue={i} done={false} />
          ))}
          {active.doneIssues.map((i) => (
            <IssueCard key={i.jiraKey} issue={i} done />
          ))}
          {active.openIssues.length + active.doneIssues.length === 0 && (
            <div className="rounded-[10px] border border-dashed border-edge py-6 text-center text-[13px] text-muted">
              Keine Tickets.
            </div>
          )}
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
