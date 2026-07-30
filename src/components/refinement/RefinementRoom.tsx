"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatPoints } from "@/lib/format";
import type { RefinementStateView } from "@/lib/view/refinementState";
import type { JiraSearchResult } from "@/lib/jira/jiraClient";
import {
  joinRefinement,
  searchJira,
  loadBacklogSuggestions,
  addTicket,
  removeTicket,
  moveTicket,
  startRefinement,
  selectTicket,
  vote,
  retractVote,
  revealVotes,
  acceptEstimate,
  finishRefinement,
  renameRefinement,
  deleteRefinement,
  backToDraft,
} from "@/app/(app)/refinement/actions";
import { RefinementDraft } from "./RefinementDraft";
import { RefinementVoting } from "./RefinementVoting";

const POLL_MS = 2000;
const tokenKey = (id: string) => `scrumi.refinement.${id}.token`;

export function RefinementRoom({ refinementId }: { refinementId: string }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [tokenLoaded, setTokenLoaded] = useState(false);
  const [state, setState] = useState<RefinementStateView | null>(null);
  const [joinName, setJoinName] = useState("");
  const [joinAsAdmin, setJoinAsAdmin] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameText, setNameText] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Zählt lokale Aktionen: Poll-Antworten, die vor einer Aktion gestartet
  // sind, werden verworfen — sonst überschreibt veralteter Server-Stand die
  // optimistische Anzeige (Karte "flackert" zurück).
  const actionSeqRef = useRef(0);

  useEffect(() => {
    setToken(window.localStorage.getItem(tokenKey(refinementId)));
    setTokenLoaded(true);
  }, [refinementId]);

  const refresh = useCallback(async () => {
    const seq = actionSeqRef.current;
    const res = await fetch(
      `/api/refinement/${refinementId}/state?token=${encodeURIComponent(token ?? "")}`,
      { cache: "no-store" },
    );
    if (res.ok && seq === actionSeqRef.current) {
      setState((await res.json()) as RefinementStateView);
    }
  }, [refinementId, token]);

  useEffect(() => {
    if (!tokenLoaded) return;
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [tokenLoaded, refresh]);

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
    const result = await joinRefinement(refinementId, joinName, joinAsAdmin);
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
      <div className="card mt-6 max-w-[460px] p-[22px]">
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
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-[13px] text-mid">
          <input
            type="checkbox"
            checked={joinAsAdmin}
            onChange={(e) => setJoinAsAdmin(e.target.checked)}
            className="h-4 w-4 accent-[#6e8ff6]"
          />
          Als Moderator beitreten (Draufsicht, deckt auf und übernimmt Schätzungen)
        </label>
        {error && <div className="mt-2 text-[12.5px] text-danger">{error}</div>}
      </div>
    );
  }

  const isAdmin = state.you?.isAdmin ?? false;
  const t = token ?? "";

  const saveName = async () => {
    await run(() => renameRefinement(refinementId, t, nameText));
    setRenaming(false);
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
      <div className="flex flex-wrap items-center gap-3">
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
            {state.you && <> · du bist {state.you.name}{isAdmin ? " (Moderator)" : ""}</>}
          </div>
        </div>
        {isAdmin && !renaming && (
          <div className="ml-auto flex flex-wrap gap-2">
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
              className="flex items-center gap-1.5 rounded-full border border-edge bg-field px-2.5 py-1 text-[12.5px] text-mid"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-ok" />
              {p.name}
              {p.isAdmin && <span className="font-mono text-[10px] uppercase text-faint">Mod</span>}
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
          onSearch={(q) => searchJira(q)}
          onLoadBacklog={() => loadBacklogSuggestions(refinementId, t)}
          onAdd={(r: JiraSearchResult) => run(() => addTicket(refinementId, t, r))}
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
    </div>
  );
}
