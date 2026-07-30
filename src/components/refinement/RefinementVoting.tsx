"use client";

import { useEffect, useState } from "react";
import { formatPoints } from "@/lib/format";
import type { RefinementStateView, RefinementParticipantView } from "@/lib/view/refinementState";

const POKER_CARDS = [1, 2, 3, 5, 8, 13, 20];

function cardLabel(points: number | null): string {
  return points === null ? "?" : formatPoints(points);
}

/** Ein Sitzplatz am Tisch: Kartenplatz (leer / Rücken / offen) über dem Namen. */
function Seat({
  participant,
  revealedPoints,
}: {
  participant: RefinementParticipantView;
  /** undefined = noch nicht aufgedeckt; sonst der offene Wert (null = „?"). */
  revealedPoints: number | null | undefined;
}) {
  const { name, voted } = participant;
  const faceUp = voted && revealedPoints !== undefined;
  return (
    <div
      data-testid={`participant-${name}`}
      data-voted={voted}
      className="flex w-[64px] flex-col items-center gap-1.5"
    >
      <span
        data-testid={`seat-card-${name}`}
        className={`flex h-[52px] w-[38px] items-center justify-center rounded-[7px] font-mono text-[15px] font-semibold ${
          faceUp
            ? "border border-accent bg-chip text-fg"
            : voted
              ? "border border-accent bg-gradient-to-b from-[#93aeff] to-[#6e8ff6] shadow-btn"
              : "border border-dashed border-edge bg-field"
        }`}
      >
        {faceUp ? cardLabel(revealedPoints ?? null) : ""}
      </span>
      <span className="max-w-[64px] truncate text-[11.5px] text-mid">{name}</span>
    </div>
  );
}

/** Sitzverteilung rund um den Tisch: reihum oben, unten, links, rechts. */
function seats(participants: RefinementParticipantView[]) {
  const top: RefinementParticipantView[] = [];
  const bottom: RefinementParticipantView[] = [];
  const left: RefinementParticipantView[] = [];
  const right: RefinementParticipantView[] = [];
  const order = [top, bottom, left, right];
  participants.forEach((p, i) => order[i % 4].push(p));
  return { top, bottom, left, right };
}

export function RefinementVoting({
  state,
  onVote,
  onRetract,
  onSelect,
  onReveal,
  onAccept,
  onFinish,
}: {
  state: RefinementStateView;
  onVote: (points: number | null) => void;
  /** Erneuter Klick auf die gewählte Karte nimmt die Schätzung zurück. */
  onRetract: () => void;
  onSelect: (ticketId: string) => void;
  onReveal: () => void;
  onAccept: (points: number) => void;
  onFinish: () => void;
}) {
  const isAdmin = state.you?.isAdmin ?? false;
  const active = state.activeTicket;
  // Nach dem Übernehmen (ESTIMATED) bleiben die Karten offen auf dem Tisch.
  const revealed = active?.state === "REVEALED" || active?.state === "ESTIMATED";
  const accepted = active?.state === "ESTIMATED";
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
  // Achtung: „?“-Votes sind null — deshalb has() statt ?? (das würde null verschlucken).
  const revealedFor = (name: string) =>
    revealed && pointsByName.has(name) ? pointsByName.get(name) : undefined;

  // Am Tisch sitzen nur anwesende Schätzende — Moderatoren nie, und wer
  // nicht mehr pollt (Tab zu), verschwindet nach dem Heartbeat-Timeout.
  const estimators = state.participants.filter((p) => !p.isAdmin && p.online);
  const votedCount = estimators.filter((p) => p.voted).length;
  const estimated = state.tickets.filter((t) => t.state === "ESTIMATED").length;
  const { top, bottom, left, right } = seats(estimators);

  // Das nächste offene Ticket (noch nicht geschätzt, nicht das aktuelle).
  const nextTicket = state.tickets.find((t) => t.state !== "ESTIMATED" && t.id !== active?.id) ?? null;
  const activeFinal = state.tickets.find((t) => t.id === active?.id)?.finalPoints ?? null;

  const ticketRow = (t: RefinementStateView["tickets"][number]) => (
    <>
      <span className={`w-[8px] flex-none text-[11px] ${t.id === active?.id ? "text-accent" : "text-transparent"}`}>▶</span>
      <span className="w-[76px] flex-none font-mono text-[11.5px] text-link">{t.jiraKey}</span>
      <span className="min-w-0 flex-1 truncate">{t.summary}</span>
      <span className={`flex-none font-mono text-[11px] ${t.state === "ESTIMATED" ? "text-ok" : "text-dim"}`}>
        {t.state === "ESTIMATED" && t.finalPoints !== null
          ? `${formatPoints(t.finalPoints)} SP ✓`
          : t.previousPoints !== null
            ? `${formatPoints(t.previousPoints)} SP`
            : "ohne Schätzung"}
      </span>
    </>
  );

  return (
    <div className="mt-6 flex flex-col gap-3.5 xl:flex-row xl:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-3.5">
      {active ? (
        <div className="card p-[22px]">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {active.url ? (
              <a
                href={active.url}
                target="_blank"
                rel="noopener noreferrer"
                title="In Jira öffnen"
                className="font-mono text-[11.5px] text-link hover:text-linkhi hover:underline"
              >
                {active.jiraKey} ↗
              </a>
            ) : (
              <span className="font-mono text-[11.5px] text-link">{active.jiraKey}</span>
            )}
            <span className="min-w-0 flex-1 text-[15px] font-semibold">{active.summary}</span>
            <span className="flex-none text-[12px] text-muted">
              {active.issueType}
              {active.previousPoints !== null && <> · bisher {formatPoints(active.previousPoints)} SP</>}
            </span>
          </div>
          {active.description && (
            <p className="mt-2.5 max-h-[130px] overflow-y-auto whitespace-pre-line border-l-2 border-edge pl-3 text-[12.5px] leading-relaxed text-muted">
              {active.description}
            </p>
          )}

          {/* Der Pokertisch */}
          <div className="mt-6 flex flex-col items-center gap-3">
            {top.length > 0 && (
              <div className="flex justify-center gap-4">
                {top.map((p) => <Seat key={p.name} participant={p} revealedPoints={revealedFor(p.name)} />)}
              </div>
            )}
            <div className="flex w-full items-center justify-center gap-4">
              {left.length > 0 && (
                <div className="flex flex-col gap-4">
                  {left.map((p) => <Seat key={p.name} participant={p} revealedPoints={revealedFor(p.name)} />)}
                </div>
              )}
              <div className="flex min-h-[130px] w-full max-w-[440px] flex-col items-center justify-center gap-3 rounded-[22px] border border-line bg-[rgba(124,156,255,0.07)] px-6 py-5 text-center">
                {!revealed && (
                  <>
                    <div className="text-[13px] text-mid">
                      Warten auf Stimmen… <span className="font-mono">{votedCount} / {estimators.length}</span>
                    </div>
                    {isAdmin && (
                      <button type="button" onClick={onReveal} className="btn-primary px-5 py-[9px]">
                        Aufdecken
                      </button>
                    )}
                  </>
                )}
                {revealed && (
                  <>
                    <div className="font-mono text-[13px] text-fg">
                      {active.stats?.average != null
                        ? <>Ø {formatPoints(active.stats.average)} · Median {formatPoints(active.stats.median ?? 0)} · {active.stats.count} Stimmen</>
                        : "Keine numerischen Stimmen."}
                    </div>
                    {accepted && activeFinal !== null && (
                      <div className="text-[13px] font-semibold text-ok">
                        Übernommen: {formatPoints(activeFinal)} SP ✓
                      </div>
                    )}
                    {isAdmin && (
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        {!accepted && (
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
                        <button
                          type="button"
                          onClick={() => onSelect(active.id)}
                          title="Alle Stimmen verwerfen und noch einmal abstimmen"
                          className="btn-secondary px-3.5 py-[9px]"
                        >
                          Neu abstimmen
                        </button>
                        {nextTicket && (
                          <button
                            type="button"
                            onClick={() => onSelect(nextTicket.id)}
                            className={`${accepted ? "btn-primary" : "btn-secondary"} px-3.5 py-[9px]`}
                          >
                            Nächstes Ticket →
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
              {right.length > 0 && (
                <div className="flex flex-col gap-4">
                  {right.map((p) => <Seat key={p.name} participant={p} revealedPoints={revealedFor(p.name)} />)}
                </div>
              )}
            </div>
            {bottom.length > 0 && (
              <div className="flex justify-center gap-4">
                {bottom.map((p) => <Seat key={p.name} participant={p} revealedPoints={revealedFor(p.name)} />)}
              </div>
            )}
          </div>

          {/* Die eigene Hand — nur Schätzende, nicht der Moderator */}
          {!revealed && !isAdmin && (
            <div className="mt-7 flex flex-col items-center gap-3">
              <div className="text-[13px] text-muted">
                {active.myVoteGiven
                  ? "Deine Karte ist gesetzt — nochmal klicken nimmt sie zurück."
                  : "Wähle deine Karte 👇"}
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {POKER_CARDS.map((points) => {
                  const selected = active.myVoteGiven && active.myVote === points;
                  return (
                    <button
                      key={points}
                      type="button"
                      aria-label={`${points} Punkte`}
                      onClick={() => (selected ? onRetract() : onVote(points))}
                      className={`flex h-[64px] w-[46px] items-center justify-center rounded-[9px] border font-mono text-[17px] font-semibold transition-transform ${
                        selected
                          ? "-translate-y-1.5 border-accent bg-gradient-to-b from-[#93aeff] to-[#6e8ff6] text-ink shadow-btn"
                          : "border-edge bg-field text-mid hover:-translate-y-0.5 hover:border-tipline"
                      }`}
                    >
                      {points}
                    </button>
                  );
                })}
                <button
                  type="button"
                  aria-label="Unklar"
                  onClick={() => (active.myVoteGiven && active.myVote === null ? onRetract() : onVote(null))}
                  className={`flex h-[64px] w-[46px] items-center justify-center rounded-[9px] border font-mono text-[17px] font-semibold transition-transform ${
                    active.myVoteGiven && active.myVote === null
                      ? "-translate-y-1.5 border-accent bg-gradient-to-b from-[#93aeff] to-[#6e8ff6] text-ink shadow-btn"
                      : "border-edge bg-field text-mid hover:-translate-y-0.5 hover:border-tipline"
                  }`}
                >
                  ?
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="card flex flex-col items-center gap-4 px-[22px] py-8 text-center text-[13px] text-muted">
          {isAdmin ? "Wähle rechts das nächste Ticket." : "Der Moderator wählt das nächste Ticket…"}
          {isAdmin && nextTicket && (
            <button type="button" onClick={() => onSelect(nextTicket.id)} className="btn-primary px-4 py-[9px]">
              Nächstes Ticket →
            </button>
          )}
        </div>
      )}
      </div>

      {/* Ticketliste als Seitenleiste rechts — der Moderator wählt hier das Voting-Ticket */}
      <div className="card overflow-hidden xl:w-[340px] xl:flex-none">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-[18px] py-3">
          <div className="text-sm font-semibold">Tickets</div>
          <span className="font-mono text-[11px] text-faint">{estimated} von {state.tickets.length} geschätzt</span>
        </div>
        {state.tickets.map((t) =>
          isAdmin ? (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t.id)}
              aria-label={`${t.jiraKey} besprechen`}
              aria-current={t.id === active?.id ? "true" : undefined}
              className={`flex w-full flex-wrap items-center gap-x-2 gap-y-1 border-b border-row px-[14px] py-2.5 text-left text-[13px] last:border-b-0 hover:bg-raise ${
                t.id === active?.id ? "border-l-2 border-l-accent bg-[rgba(124,156,255,0.13)]" : "border-l-2 border-l-transparent"
              }`}
            >
              {ticketRow(t)}
            </button>
          ) : (
            <div
              key={t.id}
              className={`flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-row px-[14px] py-2.5 text-[13px] last:border-b-0 ${
                t.id === active?.id ? "border-l-2 border-l-accent bg-[rgba(124,156,255,0.13)]" : "border-l-2 border-l-transparent"
              }`}
            >
              {ticketRow(t)}
            </div>
          ),
        )}
        {isAdmin && (
          <div className="px-[18px] py-3">
            <button type="button" onClick={onFinish} className="btn-secondary w-full px-3.5 py-[7px]">
              Refinement abschließen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
