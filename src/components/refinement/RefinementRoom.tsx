"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatPoints } from "@/lib/format";
import { type RefinementRole, type RefinementStateView } from "@/lib/view/refinementState";
import { ProfileDock, storedProfile } from "@/components/ProfileDock";
import type { JiraSearchResult } from "@/lib/jira/jiraClient";
import {
  joinRefinement,
  loadBacklogSuggestions,
  addTicket,
  addTickets,
  removeTicket,
  moveTicket,
  startRefinement,
  selectTicket,
  vote,
  retractVote,
  revealVotes,
  acceptEstimate,
  throwEmoji,
  finishRefinement,
  renameRefinement,
  deleteRefinement,
  backToDraft,
  updateProfile,
  leaveRefinement,
} from "@/app/(app)/refinement/actions";
import { RefinementDraft } from "./RefinementDraft";
import { RefinementVoting } from "./RefinementVoting";

/** Pause vor dem nächsten Versuch, wenn der State-Abruf fehlschlägt. */
const RETRY_MS = 2000;
const tokenKey = (id: string) => `scrumi.refinement.${id}.token`;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const ROLES: { value: RefinementRole; label: string; hint: string }[] = [
  { value: "estimator", label: "Schätzer", hint: "sitzt am Tisch und stimmt ab" },
  { value: "moderator", label: "Moderator", hint: "deckt auf und übernimmt Schätzungen" },
  { value: "visitor", label: "Besucher", hint: "schaut nur zu" },
];

const roleOf = (you: { isAdmin: boolean; isVisitor: boolean }): RefinementRole =>
  you.isAdmin ? "moderator" : you.isVisitor ? "visitor" : "estimator";

export function RefinementRoom({ refinementId }: { refinementId: string }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [tokenLoaded, setTokenLoaded] = useState(false);
  const [state, setState] = useState<RefinementStateView | null>(null);
  const [joinName, setJoinName] = useState("");
  const [joinRole, setJoinRole] = useState<RefinementRole>("estimator");
  const [renaming, setRenaming] = useState(false);
  const [nameText, setNameText] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Zählt lokale Aktionen: Poll-Antworten, die vor einer Aktion gestartet
  // sind, werden verworfen — sonst überschreibt veralteter Server-Stand die
  // optimistische Anzeige (Karte "flackert" zurück).
  const actionSeqRef = useRef(0);
  // Zuletzt gesehene Server-Version — steuert das Long-Polling.
  const versionRef = useRef<number | null>(null);

  useEffect(() => {
    setToken(window.localStorage.getItem(tokenKey(refinementId)));
    setJoinName((current) => current || storedProfile().name);
    setTokenLoaded(true);
  }, [refinementId]);

  /** Sofortiger Abruf (ohne Warten) — direkt nach eigenen Aktionen. */
  const refresh = useCallback(async () => {
    const seq = actionSeqRef.current;
    const res = await fetch(
      `/api/refinement/${refinementId}/state?token=${encodeURIComponent(token ?? "")}`,
      { cache: "no-store" },
    );
    if (res.ok && seq === actionSeqRef.current) {
      const data = (await res.json()) as RefinementStateView;
      versionRef.current = data.version ?? null;
      setState(data);
    }
  }, [refinementId, token]);

  // Echter Push statt Polling: Der WebSocket (server.mjs) meldet "changed",
  // sobald sich im Raum etwas tut — dann wird der Zustand einmal abgerufen.
  // Fällt der Socket aus, überbrückt Long-Polling, bis die Verbindung wieder steht.
  useEffect(() => {
    if (!tokenLoaded) return;
    let stopped = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: number | undefined;
    // Generationszähler: Erhöhen beendet eine laufende Fallback-Schleife.
    let fallbackGen = 0;

    const fetchLongPoll = async () => {
      const seq = actionSeqRef.current;
      const v = versionRef.current;
      const res = await fetch(
        `/api/refinement/${refinementId}/state?token=${encodeURIComponent(token ?? "")}${v !== null ? `&v=${v}` : ""}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error("state failed");
      const data = (await res.json()) as RefinementStateView;
      versionRef.current = data.version ?? null;
      if (seq === actionSeqRef.current) setState(data);
    };

    const startFallback = async () => {
      const gen = ++fallbackGen;
      while (!stopped && gen === fallbackGen) {
        try {
          await fetchLongPoll();
        } catch {
          await sleep(RETRY_MS);
        }
      }
    };

    const connect = () => {
      if (stopped) return;
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      ws = new WebSocket(
        `${proto}://${window.location.host}/ws/refinement?id=${encodeURIComponent(refinementId)}&token=${encodeURIComponent(token ?? "")}`,
      );
      ws.onopen = () => {
        fallbackGen++; // Fallback stoppen — der Socket übernimmt
        refresh();
      };
      ws.onmessage = () => refresh();
      ws.onclose = () => {
        if (stopped) return;
        startFallback();
        reconnectTimer = window.setTimeout(connect, 3000);
      };
    };

    refresh(); // Erststand sofort laden
    connect();

    return () => {
      stopped = true;
      fallbackGen++;
      window.clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [tokenLoaded, refinementId, token, refresh]);

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    const result = await fn();
    if (!result.ok) setError(result.error ?? "Aktion fehlgeschlagen.");
    await refresh();
  };

  /** Eigene Kartenwahl sofort anzeigen, ohne auf den Server zu warten. */
  const applyLocalVote = (given: boolean, points?: number | null) => {
    actionSeqRef.current += 1;
    setState((prev) => {
      if (!prev || !prev.activeTicket || !prev.you) return prev;
      const youName = prev.you.name;
      return {
        ...prev,
        participants: prev.participants.map((p) => (p.name === youName ? { ...p, voted: given } : p)),
        activeTicket: {
          ...prev.activeTicket,
          myVoteGiven: given,
          myVote: given ? points : undefined,
        },
      };
    });
  };

  const join = async () => {
    setError(null);
    const result = await joinRefinement(refinementId, joinName, joinRole);
    if (!result.ok || !result.data) {
      setError(result.error ?? "Beitritt fehlgeschlagen.");
      return;
    }
    window.localStorage.setItem(tokenKey(refinementId), result.data.token);
    setToken(result.data.token);
  };

  if (!tokenLoaded || state === null) {
    return <div className="mt-8 text-[13px] text-muted">Lade Refinement…</div>;
  }

  // Ohne gültiges Token (oder Token einer anderen Session): Beitritt per Name.
  if (!state.you && state.state !== "DONE") {
    return (
      <div>
        <Link href="/refinement" className="inline-block text-[12.5px] text-muted hover:text-fg hover:underline">
          ← Zur Übersicht
        </Link>
        <div className="card mt-4 max-w-[460px] p-[22px]">
        <div className="text-sm font-semibold">„{state.name}" beitreten</div>
        <div className="mt-1.5 text-[13px] text-muted">Gib deinen Namen an — kein Login nötig.</div>
        <div className="mt-4 flex flex-wrap gap-2">
          <input
            aria-label="Dein Name"
            value={joinName}
            onChange={(e) => setJoinName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && join()}
            placeholder="z. B. Ben"
            className="input-field min-w-0 flex-1"
          />
          <button type="button" onClick={join} className="btn-primary px-4 py-2.5">
            Beitreten
          </button>
        </div>
        <div className="mt-3 flex flex-col gap-1.5">
          {ROLES.map((r) => (
            <label key={r.value} className="flex cursor-pointer items-center gap-2 text-[13px] text-mid">
              <input
                type="radio"
                name="join-role"
                checked={joinRole === r.value}
                onChange={() => setJoinRole(r.value)}
                className="h-4 w-4 accent-[#6e8ff6]"
              />
              <span className="font-medium text-fg">{r.label}</span>
              <span className="text-[12px] text-dim">— {r.hint}</span>
            </label>
          ))}
        </div>
          {error && <div className="mt-2 text-[12.5px] text-danger">{error}</div>}
        </div>
      </div>
    );
  }

  const isAdmin = state.you?.isAdmin ?? false;
  const t = token ?? "";

  const saveName = async () => {
    await run(() => renameRefinement(refinementId, t, nameText));
    setRenaming(false);
  };

  /** Vom Refinement abmelden: Teilnehmer löschen, Token vergessen, zurück zur Übersicht. */
  const leave = async () => {
    if (!window.confirm("Wirklich von diesem Refinement abmelden? Deine Stimmen werden entfernt.")) return;
    const result = await leaveRefinement(refinementId, t);
    if (!result.ok) {
      setError(result.error ?? "Verlassen fehlgeschlagen.");
      return;
    }
    window.localStorage.removeItem(tokenKey(refinementId));
    router.push("/refinement");
  };

  const remove = async () => {
    if (!window.confirm(`Refinement „${state.name}" wirklich löschen?`)) return;
    const result = await deleteRefinement(refinementId, t);
    if (!result.ok) {
      setError(result.error ?? "Löschen fehlgeschlagen.");
      return;
    }
    router.push("/refinement");
  };

  return (
    <div>
      <Link href="/refinement" className="inline-block text-[12.5px] text-muted hover:text-fg hover:underline">
        ← Zur Übersicht
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          {renaming ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                aria-label="Name des Refinements"
                value={nameText}
                onChange={(e) => setNameText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveName()}
                className="input-field w-[280px] text-[17px] font-semibold"
              />
              <button type="button" onClick={saveName} className="btn-primary px-3.5 py-2">
                Speichern
              </button>
              <button type="button" onClick={() => setRenaming(false)} className="btn-secondary px-3.5 py-2">
                Abbrechen
              </button>
            </div>
          ) : (
            <h1 className="text-[29px] font-semibold tracking-[-0.028em]">{state.name}</h1>
          )}
          <div className="mt-[7px] text-[13px] text-muted">
            {state.state === "DRAFT" && "Vorbereitung — Tickets zusammenstellen"}
            {state.state === "RUNNING" && "Refinement läuft"}
            {state.state === "DONE" && "Abgeschlossen"}
            {state.you && (
              <>
                {" · du bist "}
                <span className="font-medium text-fg">
                  {state.you.avatar && <>{state.you.avatar} </>}
                  {state.you.name}
                </span>
                {isAdmin ? " (Moderator)" : state.you.isVisitor ? " (Besucher)" : ""}
              </>
            )}
          </div>
        </div>
        {!renaming && state.you && (
          <div className="ml-auto flex flex-wrap gap-2">
            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setNameText(state.name);
                    setRenaming(true);
                  }}
                  className="btn-secondary px-3.5 py-[7px]"
                >
                  Umbenennen
                </button>
                {state.state === "RUNNING" && (
                  <button
                    type="button"
                    title="Zurück in die Vorbereitung, um Tickets zu bearbeiten"
                    onClick={() => run(() => backToDraft(refinementId, t))}
                    className="btn-secondary px-3.5 py-[7px]"
                  >
                    Tickets bearbeiten
                  </button>
                )}
                <button type="button" onClick={remove} className="btn-danger px-3.5 py-[7px]">
                  Löschen
                </button>
              </>
            )}
            <button
              type="button"
              title="Vom Refinement abmelden — erneut anmelden ist jederzeit möglich"
              onClick={leave}
              className="btn-secondary px-3.5 py-[7px]"
            >
              Abmelden
            </button>
          </div>
        )}
      </div>
      {error && <div className="mt-3 text-[12.5px] text-danger">{error}</div>}


      {/* Wer ist da? Nur wer gerade anwesend ist (Heartbeat) wird angezeigt. */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {state.participants
          .filter((p) => p.online)
          .map((p) => (
            <span
              key={p.name}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] ${
                p.name === state.you?.name
                  ? "border-accent bg-chip font-medium text-fg"
                  : "border-edge bg-field text-mid"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-ok" />
              {p.avatar && (
                <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full border border-edge bg-raise text-[13px] leading-none">
                  {p.avatar}
                </span>
              )}
              {p.name}
              {p.name === state.you?.name && <span className="font-mono text-[10px] uppercase text-faint">du</span>}
              {p.isAdmin && <span className="font-mono text-[10px] uppercase text-faint">Mod</span>}
              {p.isVisitor && <span className="font-mono text-[10px] uppercase text-faint">Gast</span>}
            </span>
          ))}
        {state.participants.filter((p) => p.online).length === 0 && (
          <span className="text-[12.5px] text-muted">Noch niemand da.</span>
        )}
      </div>

      {state.state === "DRAFT" && (
        <RefinementDraft
          tickets={state.tickets}
          isAdmin={isAdmin}
          onLoadBacklog={() => loadBacklogSuggestions(refinementId, t)}
          onAdd={(r: JiraSearchResult) => run(() => addTicket(refinementId, t, r))}
          onAddMany={(rs: JiraSearchResult[]) => run(() => addTickets(refinementId, t, rs))}
          onRemove={(ticketId) => run(() => removeTicket(refinementId, t, ticketId))}
          onMove={(ticketId, direction) => run(() => moveTicket(refinementId, t, ticketId, direction))}
          onStart={() => run(() => startRefinement(refinementId, t))}
        />
      )}

      {state.state === "RUNNING" && (
        <RefinementVoting
          state={state}
          onVote={(points) => {
            if (!state.activeTicket) return;
            applyLocalVote(true, points);
            run(() => vote(refinementId, t, state.activeTicket!.id, points));
          }}
          onRetract={() => {
            if (!state.activeTicket) return;
            applyLocalVote(false);
            run(() => retractVote(refinementId, t, state.activeTicket!.id));
          }}
          onSelect={(ticketId) => run(() => selectTicket(refinementId, t, ticketId))}
          onReveal={() => {
            if (state.activeTicket) run(() => revealVotes(refinementId, t, state.activeTicket!.id));
          }}
          onAccept={(points) => {
            if (state.activeTicket) run(() => acceptEstimate(refinementId, t, state.activeTicket!.id, points));
          }}
          onThrow={(targetName, emoji) => run(() => throwEmoji(refinementId, t, targetName, emoji))}
          onLoadBacklog={() => loadBacklogSuggestions(refinementId, t)}
          onAddTicket={(r: JiraSearchResult) => run(() => addTicket(refinementId, t, r))}
          onAddTickets={(rs: JiraSearchResult[]) => run(() => addTickets(refinementId, t, rs))}
          onFinish={() => run(() => finishRefinement(refinementId, t))}
        />
      )}

      {state.state === "DONE" && (
        <div className="card mt-6 overflow-hidden">
          <div className="border-b border-line px-[18px] py-[15px] text-sm font-semibold">Ergebnis</div>
          {state.tickets.map((ti) => (
            <div key={ti.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-row px-[18px] py-2.5 text-[13px] last:border-b-0">
              <span className="w-[76px] flex-none font-mono text-[11.5px] text-link">{ti.jiraKey}</span>
              <span className="min-w-0 flex-1 truncate">{ti.summary}</span>
              <span className="flex-none font-mono text-[12px] text-mid">
                {ti.previousPoints !== null ? `${formatPoints(ti.previousPoints)} SP` : "–"}
                {" → "}
                <span className={ti.finalPoints !== null ? "text-ok" : "text-dim"}>
                  {ti.finalPoints !== null ? `${formatPoints(ti.finalPoints)} SP` : "nicht geschätzt"}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Zentrales Profil unten links: Name, Avatar und Rolle ändern */}
      {state.you && (
        <ProfileDock
          name={state.you.name}
          avatar={state.you.avatar}
          role={roleOf(state.you)}
          roles={ROLES}
          roleTitle="Rolle in diesem Refinement"
          onSave={(name, avatar, role) =>
            run(() => updateProfile(refinementId, t, name, avatar, role as RefinementRole))
          }
        />
      )}
    </div>
  );
}
