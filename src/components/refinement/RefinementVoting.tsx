"use client";

import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { formatPoints } from "@/lib/format";
import { isUnanimous } from "@/lib/metrics/refinementVotes";
import {
  THROW_EMOJIS,
  type RefinementStateView,
  type RefinementParticipantView,
  type RefinementThrowView,
} from "@/lib/view/refinementState";

const POKER_CARDS = [1, 2, 3, 5, 8, 13, 20];
const SCRUMI_COLORS = ["#A5BAFF", "#5E80EE", "#3EDBB6", "#F59E4A", "#FFFFFF"];

function cardLabel(points: number | null): string {
  return points === null ? "?" : formatPoints(points);
}

/** Konfetti über die ganze Seite, wenn alle dieselbe Karte gelegt haben. */
function playUnanimityConfetti() {
  const sides = () => {
    confetti({ particleCount: 110, angle: 60, spread: 70, origin: { x: 0, y: 0.9 }, startVelocity: 55, ticks: 220, colors: SCRUMI_COLORS });
    confetti({ particleCount: 110, angle: 120, spread: 70, origin: { x: 1, y: 0.9 }, startVelocity: 55, ticks: 220, colors: SCRUMI_COLORS });
  };
  sides();
  setTimeout(sides, 350);
  setTimeout(
    () => confetti({ particleCount: 160, spread: 360, origin: { x: 0.5, y: 0.4 }, startVelocity: 30, ticks: 200, colors: SCRUMI_COLORS }),
    700,
  );
}

const seatRect = (name: string): DOMRect | null =>
  document.querySelector(`[data-seat="${CSS.escape(name)}"]`)?.getBoundingClientRect() ?? null;

/**
 * Lässt ein geworfenes Emoji im Bogen zum Ziel-Sitz fliegen. Löst auf, wenn
 * das Emoji einschlägt (dann wackelt der Sitz). Ohne Ziel-Sitz oder ohne
 * Web-Animations-API (jsdom) passiert einfach nichts.
 */
function launchThrow(t: RefinementThrowView): Promise<boolean> {
  return new Promise((resolve) => {
    const target = seatRect(t.to);
    if (!target) return resolve(false);
    // Der Moderator sitzt nicht am Tisch — sein Wurf kommt vom Seitenrand.
    const source = seatRect(t.from);
    const from = source
      ? { x: source.left + source.width / 2, y: source.top + source.height / 2 }
      : { x: -30, y: window.innerHeight * 0.25 };
    const to = { x: target.left + target.width / 2 - 14, y: target.top + target.height / 2 - 14 };

    const el = document.createElement("span");
    el.textContent = t.emoji;
    el.style.cssText = "position:fixed;left:0;top:0;z-index:60;font-size:28px;line-height:1;pointer-events:none;will-change:transform;";
    document.body.appendChild(el);
    if (typeof el.animate !== "function") {
      el.remove();
      return resolve(true);
    }
    const peakY = Math.min(from.y, to.y) - 80;
    const anim = el.animate(
      [
        { transform: `translate(${from.x}px, ${from.y}px) scale(0.6) rotate(0deg)` },
        { transform: `translate(${(from.x + to.x) / 2}px, ${peakY}px) scale(1.3) rotate(200deg)`, offset: 0.55 },
        { transform: `translate(${to.x}px, ${to.y}px) scale(1) rotate(360deg)` },
      ],
      { duration: 650, easing: "ease-in-out" },
    );
    anim.onfinish = () => {
      el.remove();
      resolve(true);
    };
  });
}

/** Ein Sitzplatz am Tisch: Kartenplatz (leer / Rücken / offen) über dem Namen. */
function Seat({
  participant,
  revealedPoints,
  flipDelayMs,
  isYou,
  canThrow,
  pickerOpen,
  onTogglePicker,
  onThrow,
  hitSeq,
}: {
  participant: RefinementParticipantView;
  /** undefined = noch nicht aufgedeckt; sonst der offene Wert (null = „?"). */
  revealedPoints: number | null | undefined;
  /** Staffelt den Flip beim Aufdecken: Sitz für Sitz statt alle gleichzeitig. */
  flipDelayMs: number;
  /** Der eigene Platz — deutlich markiert, damit man sich sofort findet. */
  isYou: boolean;
  canThrow: boolean;
  pickerOpen: boolean;
  onTogglePicker: () => void;
  onThrow: (emoji: string) => void;
  /** Zählt Treffer — jede Erhöhung spielt das Wackeln neu ab. */
  hitSeq: number;
}) {
  const { name, avatar, voted } = participant;
  const faceUp = voted && revealedPoints !== undefined;
  return (
    <div
      data-testid={`participant-${name}`}
      data-voted={voted}
      data-you={isYou || undefined}
      className="relative flex w-[64px] flex-col items-center gap-1.5"
    >
      <button
        type="button"
        key={hitSeq}
        data-seat={name}
        data-testid={`seat-card-${name}`}
        aria-label={canThrow ? `${name} bewerfen` : undefined}
        title={canThrow ? "Mit einem Emoji bewerfen" : undefined}
        onClick={canThrow ? onTogglePicker : undefined}
        disabled={!canThrow}
        className={`flip-scene block h-[52px] w-[38px] rounded-[7px] ${hitSeq > 0 ? "seat-hit" : ""} ${
          canThrow ? "cursor-pointer" : "cursor-default"
        } ${isYou ? "ring-2 ring-[#6e8ff6] ring-offset-2 ring-offset-[#0d111a]" : ""}`}
      >
        <span
          className={`flip-card ${faceUp ? "is-open" : ""}`}
          style={{ transitionDelay: faceUp ? `${flipDelayMs}ms` : "0ms" }}
        >
          <span
            className={`flip-face ${
              voted
                ? "border border-accent bg-gradient-to-b from-[#93aeff] to-[#6e8ff6] shadow-btn"
                : "border border-dashed border-edge bg-field"
            }`}
          />
          <span className="flip-face flip-face-up border border-accent bg-chip font-mono text-[15px] font-semibold text-fg">
            {faceUp ? cardLabel(revealedPoints ?? null) : ""}
          </span>
        </span>
      </button>
      {/* Avatar als Kreis-Badge; ohne Avatar der Anfangsbuchstabe. */}
      <span
        className={`flex h-[32px] w-[32px] items-center justify-center rounded-full border text-[18px] leading-none ${
          isYou ? "border-accent bg-chip shadow-btn" : "border-edge bg-field"
        }`}
      >
        {avatar || (
          <span className={`text-[13px] font-semibold ${isYou ? "text-accent" : "text-mid"}`}>
            {name.charAt(0).toUpperCase()}
          </span>
        )}
      </span>
      <span
        className={`max-w-[64px] truncate text-[11.5px] ${isYou ? "font-semibold text-accent" : "text-mid"}`}
        title={isYou ? `${name} (du)` : name}
      >
        {name}
        {isYou && " (du)"}
      </span>
      {pickerOpen && (
        <div className="absolute top-full z-20 mt-1 flex gap-1 rounded-[9px] border border-edge bg-field px-1.5 py-1 shadow-card">
          {THROW_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-label={`${emoji} auf ${name} werfen`}
              onClick={() => onThrow(emoji)}
              className="text-[16px] transition-transform hover:-translate-y-0.5"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
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
  onThrow,
}: {
  state: RefinementStateView;
  onVote: (points: number | null) => void;
  /** Erneuter Klick auf die gewählte Karte nimmt die Schätzung zurück. */
  onRetract: () => void;
  onSelect: (ticketId: string) => void;
  onReveal: () => void;
  onAccept: (points: number) => void;
  onFinish: () => void;
  /** Wirft ein Emoji auf eine andere Person am Tisch. */
  onThrow: (targetName: string, emoji: string) => void;
}) {
  const isAdmin = state.you?.isAdmin ?? false;
  const active = state.activeTicket;
  // Nach dem Übernehmen (ESTIMATED) bleiben die Karten offen auf dem Tisch.
  const revealed = active?.state === "REVEALED" || active?.state === "ESTIMATED";
  const accepted = active?.state === "ESTIMATED";
  const [finalText, setFinalText] = useState("");
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  /** Treffer-Zähler pro Name — löst das Wackeln am getroffenen Sitz aus. */
  const [hits, setHits] = useState<Record<string, number>>({});
  const celebratedRef = useRef<string | null>(null);
  // null = erster Poll noch nicht da; dann alles Bisherige als gesehen markieren,
  // damit beim (Wieder-)Beitritt keine alten Würfe nachgespielt werden.
  const seenThrowsRef = useRef<Set<string> | null>(null);

  // Median als Vorschlag, sobald aufgedeckt wird (Admin kann überschreiben).
  useEffect(() => {
    if (revealed && active?.stats?.median != null) {
      setFinalText(String(active.stats.median));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed, active?.id]);

  const unanimous = revealed && !!active?.votes && isUnanimous(active.votes.map((v) => v.points));

  // Konfetti genau einmal pro Aufdeck-Runde; „Neu abstimmen" setzt zurück.
  useEffect(() => {
    if (!active) return;
    if (!revealed) {
      if (celebratedRef.current === active.id) celebratedRef.current = null;
      return;
    }
    if (unanimous && celebratedRef.current !== active.id) {
      celebratedRef.current = active.id;
      playUnanimityConfetti();
    }
  }, [active, revealed, unanimous]);

  // Neue Wurf-Events aus dem Poll animieren; beim Einschlag wackelt der Sitz.
  useEffect(() => {
    const throws = state.throws ?? [];
    if (seenThrowsRef.current === null) {
      seenThrowsRef.current = new Set(throws.map((t) => t.id));
      return;
    }
    const seen = seenThrowsRef.current;
    for (const t of throws) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      launchThrow(t).then((landed) => {
        if (landed) setHits((prev) => ({ ...prev, [t.to]: (prev[t.to] ?? 0) + 1 }));
      });
    }
  }, [state.throws]);

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

  const seat = (p: RefinementParticipantView) => (
    <Seat
      key={p.name}
      participant={p}
      revealedPoints={revealedFor(p.name)}
      flipDelayMs={Math.max(0, estimators.findIndex((e) => e.name === p.name)) * 90}
      isYou={state.you?.name === p.name}
      canThrow={!!state.you && p.name !== state.you.name}
      pickerOpen={pickerFor === p.name}
      onTogglePicker={() => setPickerFor((cur) => (cur === p.name ? null : p.name))}
      onThrow={(emoji) => {
        setPickerFor(null);
        onThrow(p.name, emoji);
      }}
      hitSeq={hits[p.name] ?? 0}
    />
  );

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
                {top.map(seat)}
              </div>
            )}
            <div className="flex w-full items-center justify-center gap-4">
              {left.length > 0 && (
                <div className="flex flex-col gap-4">
                  {left.map(seat)}
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
                    <div className="stats-pop flex flex-col items-center gap-1">
                      {active.stats?.average != null ? (
                        <>
                          <div className="font-mono text-[34px] font-bold leading-none tracking-tight text-fg">
                            Ø {formatPoints(active.stats.average)}
                          </div>
                          <div className="font-mono text-[12px] text-mid">
                            Median {formatPoints(active.stats.median ?? 0)} · {active.stats.count} Stimmen
                          </div>
                        </>
                      ) : (
                        <div className="text-[13px] text-mid">Keine numerischen Stimmen.</div>
                      )}
                      {unanimous && (
                        <div className="text-[12.5px] font-semibold text-ok">Einstimmig! 🎉</div>
                      )}
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
                  {right.map(seat)}
                </div>
              )}
            </div>
            {bottom.length > 0 && (
              <div className="flex justify-center gap-4">
                {bottom.map(seat)}
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
