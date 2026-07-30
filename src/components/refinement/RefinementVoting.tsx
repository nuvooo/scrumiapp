"use client";

import { useEffect, useState } from "react";
import { formatPoints } from "@/lib/format";
import type { RefinementStateView } from "@/lib/view/refinementState";

const POKER_CARDS = [1, 2, 3, 5, 8, 13, 20];

function cardLabel(points: number | null): string {
  return points === null ? "?" : formatPoints(points);
}

export function RefinementVoting({
  state,
  onVote,
  onSelect,
  onReveal,
  onAccept,
  onFinish,
}: {
  state: RefinementStateView;
  onVote: (points: number | null) => void;
  onSelect: (ticketId: string) => void;
  onReveal: () => void;
  onAccept: (points: number) => void;
  onFinish: () => void;
}) {
  const isAdmin = state.you?.isAdmin ?? false;
  const active = state.activeTicket;
  const revealed = active?.state === "REVEALED";
  const [finalText, setFinalText] = useState("");

  // Median als Vorschlag, sobald aufgedeckt wird (Admin kann überschreiben).
  useEffect(() => {
    if (revealed && active?.stats?.median != null) {
      setFinalText(String(active.stats.median));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed, active?.id]);

  const accept = () => {
    const points = Number(finalText.replace(",", "."));
    if (Number.isFinite(points) && points >= 0) onAccept(points);
  };

  const estimated = state.tickets.filter((t) => t.state === "ESTIMATED").length;

  return (
    <div className="mt-6 flex flex-col gap-3.5">
      <div className="flex flex-wrap gap-2">
        {state.participants.map((p) => (
          <span
            key={p.name}
            data-testid={`participant-${p.name}`}
            className={`rounded-full border px-2.5 py-1 text-[12.5px] ${
              active && p.voted ? "border-[#1F3D2B] bg-[#0F1A14] text-ok" : "border-edge bg-field text-mid"
            }`}
          >
            {p.name}
            {p.isAdmin && <span className="ml-1 font-mono text-[10px] text-faint">Admin</span>}
            {active && p.voted && <span className="ml-1">✓</span>}
          </span>
        ))}
        <span className="ml-auto self-center font-mono text-[11px] text-faint">
          {estimated} von {state.tickets.length} geschätzt
        </span>
      </div>

      {active ? (
        <div className="card p-[22px]">
          <div className="font-mono text-[11.5px] text-link">{active.jiraKey}</div>
          <div className="mt-1 text-[17px] font-semibold">{active.summary}</div>
          <div className="mt-1 text-[12.5px] text-muted">
            {active.issueType}
            {active.previousPoints !== null && <> · bisher {formatPoints(active.previousPoints)} SP</>}
          </div>

          {!revealed && (
            <div className="mt-5 flex flex-wrap gap-2">
              {POKER_CARDS.map((points) => (
                <button
                  key={points}
                  type="button"
                  aria-label={`${points} Punkte`}
                  onClick={() => onVote(points)}
                  className={`flex h-[64px] w-[46px] items-center justify-center rounded-[9px] border font-mono text-[17px] font-semibold ${
                    active.myVoteGiven && active.myVote === points
                      ? "border-accent bg-chip text-fg"
                      : "border-edge bg-field text-mid hover:border-tipline"
                  }`}
                >
                  {points}
                </button>
              ))}
              <button
                type="button"
                aria-label="Unklar"
                onClick={() => onVote(null)}
                className={`flex h-[64px] w-[46px] items-center justify-center rounded-[9px] border font-mono text-[17px] font-semibold ${
                  active.myVoteGiven && active.myVote === null
                    ? "border-accent bg-chip text-fg"
                    : "border-edge bg-field text-mid hover:border-tipline"
                }`}
              >
                ?
              </button>
            </div>
          )}

          {!revealed && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="text-[12.5px] text-muted">
                {active.myVoteGiven ? "Deine Karte ist gesetzt — warten auf die anderen…" : "Wähle verdeckt deine Karte."}
              </span>
              {isAdmin && (
                <button type="button" onClick={onReveal} className="btn-primary ml-auto px-4 py-[9px]">
                  Aufdecken
                </button>
              )}
            </div>
          )}

          {revealed && (
            <>
              <div data-testid="revealed-votes" className="mt-5 flex flex-wrap gap-2">
                {(active.votes ?? []).map((v) => (
                  <div key={v.name} className="flex flex-col items-center gap-1">
                    <span className="flex h-[64px] w-[46px] items-center justify-center rounded-[9px] border border-accent bg-chip font-mono text-[17px] font-semibold">
                      {cardLabel(v.points)}
                    </span>
                    <span className="max-w-[64px] truncate text-[11px] text-mid">{v.name}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 font-mono text-[12.5px] text-mid">
                {active.stats?.average != null
                  ? `Ø ${formatPoints(active.stats.average)} · Median ${formatPoints(active.stats.median ?? 0)} · ${active.stats.count} Stimmen`
                  : "Keine numerischen Stimmen."}
              </div>
              {isAdmin && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 text-[13px] text-mid">
                    Finale Schätzung
                    <input
                      aria-label="Finale Schätzung"
                      value={finalText}
                      onChange={(e) => setFinalText(e.target.value)}
                      className="w-[72px] rounded-[7px] border border-edge bg-field px-2.5 py-1.5 text-center font-mono text-[13px] text-fg"
                    />
                  </label>
                  <button type="button" onClick={accept} className="btn-primary px-4 py-[9px]">
                    Übernehmen
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="card px-[22px] py-8 text-center text-[13px] text-muted">
          {isAdmin ? "Wähle unten das nächste Ticket." : "Der Admin wählt das nächste Ticket…"}
        </div>
      )}

      {isAdmin && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-3 border-b border-line px-[18px] py-3">
            <div className="text-sm font-semibold">Tickets</div>
            <button type="button" onClick={onFinish} className="btn-secondary ml-auto px-3.5 py-[7px]">
              Refinement abschließen
            </button>
          </div>
          {state.tickets.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t.id)}
              aria-label={`${t.jiraKey} besprechen`}
              className={`flex w-full flex-wrap items-center gap-x-3 gap-y-1 border-b border-row px-[18px] py-2.5 text-left text-[13px] last:border-b-0 hover:bg-raise ${
                t.id === active?.id ? "bg-chip" : ""
              }`}
            >
              <span className="w-[76px] flex-none font-mono text-[11.5px] text-link">{t.jiraKey}</span>
              <span className="min-w-0 flex-1 truncate">{t.summary}</span>
              <span className={`flex-none font-mono text-[11px] ${t.state === "ESTIMATED" ? "text-ok" : "text-dim"}`}>
                {t.state === "ESTIMATED" && t.finalPoints !== null
                  ? `${formatPoints(t.finalPoints)} SP ✓`
                  : t.previousPoints !== null
                    ? `${formatPoints(t.previousPoints)} SP`
                    : "ohne Schätzung"}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
