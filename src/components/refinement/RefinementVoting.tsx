"use client";

import { useEffect, useState } from "react";
import { formatPoints } from "@/lib/format";
import type { RefinementStateView } from "@/lib/view/refinementState";
import { PokerTableScene, type SceneParticipant, type SceneHand } from "./PokerTableScene";

const POKER_CARDS: (number | null)[] = [1, 2, 3, 5, 8, 13, 20, null];

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

  const pointsByName = new Map((active?.votes ?? []).map((v) => [v.name, v.points]));
  // Moderatoren sitzen nicht am Tisch und schätzen nicht mit — gezählt und
  // gerendert werden nur die Schätzenden. Achtung: „?“-Votes sind null —
  // deshalb has() statt ?? (das würde null verschlucken).
  const estimators = state.participants.filter((p) => !p.isAdmin);
  const sceneParticipants: SceneParticipant[] = estimators.map((p) => ({
    name: p.name,
    isAdmin: p.isAdmin,
    voted: p.voted,
    revealedPoints: revealed && pointsByName.has(p.name) ? pointsByName.get(p.name) : undefined,
  }));
  const votedCount = estimators.filter((p) => p.voted).length;
  const estimated = state.tickets.filter((t) => t.state === "ESTIMATED").length;

  // Nur Teilnehmer halten eine Kartenhand — der Moderator beobachtet von oben.
  const hand: SceneHand | null =
    !revealed && !isAdmin && state.you
      ? {
          cards: POKER_CARDS,
          selected: active?.myVote,
          hasSelection: active?.myVoteGiven ?? false,
          onPick: onVote,
        }
      : null;

  return (
    <div className="mt-6 flex flex-col gap-3.5">
      {active ? (
        <div className="card overflow-hidden">
          {/* Ticket-Panel wie im Referenzbild oben links */}
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line px-[22px] py-3.5">
            <span className="font-mono text-[11.5px] text-link">{active.jiraKey}</span>
            <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{active.summary}</span>
            <span className="flex-none text-[12px] text-muted">
              {active.issueType}
              {active.previousPoints !== null && <> · bisher {formatPoints(active.previousPoints)} SP</>}
            </span>
          </div>

          {/* Der 3D-Pokertisch */}
          <div className="h-[380px] w-full md:h-[460px]">
            <PokerTableScene
              participants={sceneParticipants}
              revealed={revealed}
              youName={state.you?.name ?? null}
              hand={hand}
              viewpoint={isAdmin ? "top" : "first-person"}
            />
          </div>

          {/* Bedienleiste unter dem Tisch */}
          <div className="flex flex-wrap items-center justify-center gap-3 border-t border-line px-[22px] py-3.5">
            {!revealed && (
              <>
                <span className="text-[13px] text-mid">
                  {isAdmin
                    ? "Warten, bis alle ihre Karte verdeckt gelegt haben…"
                    : active.myVoteGiven
                      ? "Deine Karte liegt verdeckt auf dem Tisch — du kannst noch wechseln."
                      : "Wähle deine Karte in der Hand 👆"}
                </span>
                <span className="text-[13px] text-mid">
                  Stimmen: <span className="font-mono">{votedCount} / {estimators.length}</span>
                </span>
                {isAdmin && (
                  <button type="button" onClick={onReveal} className="btn-primary px-5 py-[9px]">
                    Aufdecken
                  </button>
                )}
              </>
            )}
            {revealed && (
              <>
                <span className="font-mono text-[13px] text-fg">
                  {active.stats?.average != null
                    ? <>Ø {formatPoints(active.stats.average)} · Median {formatPoints(active.stats.median ?? 0)} · {active.stats.count} Stimmen</>
                    : "Keine numerischen Stimmen."}
                </span>
                {isAdmin && (
                  <>
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
                  </>
                )}
              </>
            )}
          </div>

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
            <span className="font-mono text-[11px] text-faint">{estimated} von {state.tickets.length} geschätzt</span>
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
      {!isAdmin && (
        <div className="text-center font-mono text-[11px] text-faint">
          {estimated} von {state.tickets.length} Tickets geschätzt
        </div>
      )}
    </div>
  );
}
