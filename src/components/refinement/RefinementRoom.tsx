"use client";

import { useCallback, useEffect, useState } from "react";
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
  revealVotes,
  acceptEstimate,
  finishRefinement,
} from "@/app/(app)/refinement/actions";
import { RefinementDraft } from "./RefinementDraft";
import { RefinementVoting } from "./RefinementVoting";

const POLL_MS = 2000;
const tokenKey = (id: string) => `scrumi.refinement.${id}.token`;

export function RefinementRoom({ refinementId }: { refinementId: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [tokenLoaded, setTokenLoaded] = useState(false);
  const [state, setState] = useState<RefinementStateView | null>(null);
  const [joinName, setJoinName] = useState("");
  const [joinAsAdmin, setJoinAsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setToken(window.localStorage.getItem(tokenKey(refinementId)));
    setTokenLoaded(true);
  }, [refinementId]);

  const refresh = useCallback(async () => {
    const res = await fetch(
      `/api/refinement/${refinementId}/state?token=${encodeURIComponent(token ?? "")}`,
      { cache: "no-store" },
    );
    if (res.ok) setState((await res.json()) as RefinementStateView);
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

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-[29px] font-semibold tracking-[-0.028em]">{state.name}</h1>
          <div className="mt-[7px] text-[13px] text-muted">
            {state.state === "DRAFT" && "Vorbereitung — Tickets zusammenstellen"}
            {state.state === "RUNNING" && "Refinement läuft"}
            {state.state === "DONE" && "Abgeschlossen"}
            {state.you && <> · du bist {state.you.name}{isAdmin ? " (Admin)" : ""}</>}
          </div>
        </div>
      </div>
      {error && <div className="mt-3 text-[12.5px] text-danger">{error}</div>}

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
            if (state.activeTicket) run(() => vote(refinementId, t, state.activeTicket!.id, points));
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
