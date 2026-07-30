"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { estimateIssue } from "@/app/(app)/planning/actions";
import { formatPoints } from "@/lib/format";

export interface PlanningIssueView {
  id: string;
  jiraKey: string;
  summary: string;
  issueType: string;
  status: string;
  storyPoints: number;
  url: string | null;
}

const POKER_CARDS = [1, 2, 3, 5, 8, 13, 20];

/** Unbewertete zuerst, innerhalb der Gruppen bleibt die Eingangsreihenfolge. */
function sorted(issues: PlanningIssueView[]): PlanningIssueView[] {
  return [...issues].sort((a, b) => Number(a.storyPoints > 0) - Number(b.storyPoints > 0));
}

export function PlanningList({ issues: initial }: { issues: PlanningIssueView[] }) {
  const router = useRouter();
  const [issues, setIssues] = useState(initial);
  const [pokerKey, setPokerKey] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ordered = sorted(issues);
  const poker = pokerKey !== null ? ordered.find((i) => i.jiraKey === pokerKey) ?? null : null;

  const openPoker = (jiraKey: string) => {
    setPokerKey(jiraKey);
    setSelected(null);
    setError(null);
  };

  const closePoker = () => {
    setPokerKey(null);
    setSelected(null);
    setError(null);
  };

  useEffect(() => {
    if (pokerKey === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePoker();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pokerKey]);

  /** Nach dem Schätzen zum nächsten unbewerteten Ticket, sonst schließen. */
  const advance = (updated: PlanningIssueView[], fromKey: string) => {
    const remaining = sorted(updated).filter((i) => i.storyPoints <= 0 && i.jiraKey !== fromKey);
    if (remaining.length > 0) {
      setPokerKey(remaining[0].jiraKey);
      setSelected(null);
      setError(null);
    } else {
      closePoker();
    }
  };

  const submit = async () => {
    if (!poker || selected === null || saving) return;
    setSaving(true);
    setError(null);
    const result = await estimateIssue(poker.jiraKey, selected);
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "Schätzung konnte nicht gespeichert werden.");
      return;
    }
    const updated = issues.map((i) => (i.jiraKey === poker.jiraKey ? { ...i, storyPoints: selected } : i));
    setIssues(updated);
    router.refresh();
    advance(updated, poker.jiraKey);
  };

  return (
    <div className="mt-3.5 flex flex-col gap-2">
      {ordered.map((i) => {
        const unestimated = i.storyPoints <= 0;
        return (
          <div
            key={i.jiraKey}
            data-testid={`planning-card-${i.jiraKey}`}
            className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[10px] border px-3.5 py-2.5 ${
              unestimated ? "border-[#4a3a1e] bg-[#171207]" : "border-edge bg-field"
            }`}
          >
            <span className="w-[76px] flex-none font-mono text-[11.5px] text-link">{i.jiraKey}</span>
            <span className="min-w-0 flex-1 truncate text-[13px] text-fg">{i.summary}</span>
            <div className="flex w-full items-center gap-3 md:w-auto md:flex-none">
              <span className="flex-none font-mono text-[10.5px] uppercase tracking-[0.08em] text-faint">
                {i.issueType}
              </span>
              <span className="flex-none rounded-full border border-edge px-2 py-[2px] font-mono text-[10.5px] text-mid">
                {i.status}
              </span>
              {unestimated ? (
                <span className="flex-none rounded-full border border-[#5a4a24] bg-[#241b09] px-2 py-[2px] font-mono text-[10.5px] text-warn">
                  ohne Schätzung
                </span>
              ) : (
                <span className="flex-none rounded-full border border-edge bg-chip px-2 py-[2px] font-mono text-[10.5px] text-fg">
                  {formatPoints(i.storyPoints)} SP
                </span>
              )}
              {i.url && (
                <a
                  href={i.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${i.jiraKey} in Jira öffnen`}
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
              <button
                type="button"
                onClick={() => openPoker(i.jiraKey)}
                aria-label={`${i.jiraKey} schätzen`}
                className="btn-secondary ml-auto flex-none px-3 py-1.5 md:ml-0"
              >
                Schätzen
              </button>
            </div>
          </div>
        );
      })}
      {ordered.length === 0 && (
        <div className="rounded-[10px] border border-dashed border-edge py-8 text-center text-[13px] text-muted">
          Keine offenen Tickets im geplanten Sprint.
        </div>
      )}

      {poker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Poker schließen"
            onClick={closePoker}
            className="absolute inset-0 bg-[rgba(4,6,10,0.7)] backdrop-blur-sm"
          />
          <div data-testid="poker-overlay" className="card relative w-full max-w-[560px] p-[22px]">
            <div className="font-mono text-[11.5px] text-link">{poker.jiraKey}</div>
            <div className="mt-1 text-[17px] font-semibold">{poker.summary}</div>
            <div className="mt-1 text-[12.5px] text-muted">
              {poker.issueType} · {poker.status}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {POKER_CARDS.map((points) => (
                <button
                  key={points}
                  type="button"
                  aria-label={`${points} Punkte`}
                  onClick={() => setSelected(points)}
                  className={`flex h-[64px] w-[46px] items-center justify-center rounded-[9px] border font-mono text-[17px] font-semibold ${
                    selected === points
                      ? "border-accent bg-chip text-fg"
                      : "border-edge bg-field text-mid hover:border-tipline"
                  }`}
                >
                  {points}
                </button>
              ))}
            </div>

            {error && <div className="mt-3 text-[12.5px] text-danger">{error}</div>}

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={submit}
                disabled={selected === null || saving}
                className="btn-primary px-4 py-[9px] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Speichert…" : "Übernehmen"}
              </button>
              <button type="button" onClick={() => advance(issues, poker.jiraKey)} className="btn-secondary px-4 py-[9px]">
                Überspringen
              </button>
              <span className="ml-auto text-[12px] text-faint">Escape schließt</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
