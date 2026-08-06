"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { RetroStateView } from "@/lib/view/retroState";
import {
  joinRetro,
  deleteRetro,
  setRetroHidden,
  addRetroColumn,
  renameRetroColumn,
  setRetroColumnColor,
  reorderRetroColumn,
  setRetroColumnCollapsed,
  deleteRetroColumn,
  addRetroCard,
  updateRetroCard,
  deleteRetroCard,
  addRetroComment,
  deleteRetroComment,
  voteRetroCard,
  unvoteRetroCard,
  mergeRetroCards,
  searchGifs,
  setRetroTyping,
  updateRetroProfile,
  setRetroVotingOpen,
  setRetroTimer,
  setRetroMusic,
  setRetroSortMode,
} from "@/app/(app)/retro/actions";
import { RetroBoard } from "./RetroBoard";
import { onProfileSaved, storedProfile, writeProfile } from "@/components/ProfileDock";
import { AmbientMusic } from "@/lib/ambientMusic";

/** Pause vor dem nächsten Versuch, wenn der State-Abruf fehlschlägt. */
const RETRY_MS = 2000;
const tokenKey = (id: string) => `scrumi.retro.${id}.token`;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const TIMER_PRESETS = [
  { label: "1 min", seconds: 60 },
  { label: "3 min", seconds: 180 },
  { label: "5 min", seconds: 300 },
  { label: "10 min", seconds: 600 },
];

const formatTimer = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

const VOLUME_KEY = "scrumi.musicVolume";

/**
 * Hintergrundmusik (generative Lofi-Fläche per WebAudio): Der Moderator
 * schaltet sie für alle ein/aus, jede Person regelt ihre Lautstärke selbst.
 * Blockt der Browser den Ton (Autoplay-Schutz), erscheint ein
 * „Ton aktivieren"-Knopf.
 */
function MusicPanel({
  musicOn,
  isAdmin,
  onToggle,
}: {
  musicOn: boolean;
  isAdmin: boolean;
  onToggle: () => void;
}) {
  const musicRef = useRef<AmbientMusic | null>(null);
  const [volume, setVolume] = useState(0.7);
  const [needsGesture, setNeedsGesture] = useState(false);

  useEffect(() => {
    const stored = Number(window.localStorage.getItem(VOLUME_KEY));
    if (Number.isFinite(stored) && stored >= 0 && stored <= 1) setVolume(stored);
  }, []);

  // Musik folgt dem Board-Status: an für alle, aus für alle.
  useEffect(() => {
    if (!AmbientMusic.supported()) return;
    if (musicOn) {
      if (!musicRef.current) {
        musicRef.current = new AmbientMusic();
        musicRef.current.start(volume);
      }
      setNeedsGesture(musicRef.current.suspended);
    } else {
      musicRef.current?.stop();
      musicRef.current = null;
      setNeedsGesture(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [musicOn]);

  useEffect(() => () => musicRef.current?.stop(), []);

  if (!AmbientMusic.supported()) return null;

  const changeVolume = (v: number) => {
    setVolume(v);
    try {
      window.localStorage.setItem(VOLUME_KEY, String(v));
    } catch {
      // egal — dann eben ohne Merken
    }
    musicRef.current?.setVolume(v);
  };

  return (
    <span className="flex items-center gap-1.5">
      {isAdmin ? (
        <button
          type="button"
          title={musicOn ? "Hintergrundmusik für alle ausschalten" : "Hintergrundmusik für alle einschalten"}
          onClick={onToggle}
          className={`px-3 py-[7px] ${musicOn ? "btn-primary" : "btn-secondary"}`}
        >
          {musicOn ? "🎵 Musik aus" : "🎵 Musik an"}
        </button>
      ) : (
        musicOn && (
          <span className="rounded-full border border-edge bg-field px-2.5 py-1 text-[12px] text-mid">🎵</span>
        )
      )}
      {musicOn && needsGesture && (
        <button
          type="button"
          title="Der Browser braucht einen Klick, bevor er Ton abspielen darf"
          onClick={() => {
            musicRef.current?.resume().then(() => setNeedsGesture(false));
          }}
          className="btn-primary px-2.5 py-[7px] text-[12px]"
        >
          🔊 Ton aktivieren
        </button>
      )}
      {musicOn && !needsGesture && (
        <input
          type="range"
          aria-label="Musik-Lautstärke"
          title="Deine Lautstärke (nur für dich)"
          min={0}
          max={100}
          value={Math.round(volume * 100)}
          onChange={(e) => changeVolume(Number(e.target.value) / 100)}
          className="w-[84px] accent-[#6e8ff6]"
        />
      )}
    </span>
  );
}

/** Countdown im Kopf: Server liefert Restsekunden, der Client tickt lokal weiter. */
function TimerChip({
  remaining,
  isAdmin,
  onStart,
  onStop,
}: {
  remaining: number | null;
  isAdmin: boolean;
  onStart: (seconds: number) => void;
  onStop: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(remaining);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setSecondsLeft(remaining);
    if (remaining === null || remaining <= 0) return;
    const timer = setInterval(
      () => setSecondsLeft((s) => (s === null || s <= 0 ? s : s - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, [remaining]);

  if (secondsLeft === null) {
    if (!isAdmin) return null;
    return (
      <span className="relative">
        <button type="button" onClick={() => setMenuOpen((o) => !o)} className="btn-secondary px-3 py-[7px]">
          ⏱ Timer
        </button>
        {menuOpen && (
          <span className="absolute right-0 top-[38px] z-30 flex gap-1 rounded-[9px] border border-edge bg-field p-1.5 shadow-card">
            {TIMER_PRESETS.map((p) => (
              <button
                key={p.seconds}
                type="button"
                onClick={() => {
                  onStart(p.seconds);
                  setMenuOpen(false);
                }}
                className="btn-secondary whitespace-nowrap px-2.5 py-1.5 text-[12px]"
              >
                {p.label}
              </button>
            ))}
          </span>
        )}
      </span>
    );
  }

  const expired = secondsLeft <= 0;
  return (
    <span
      className={`flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[13px] ${
        expired
          ? "timer-pulse-fast border-[#3A1E24] bg-[#170F12] text-danger"
          : secondsLeft <= 30
            ? "timer-pulse-fast border-[#3A2A1E] bg-[#171106] text-[#F59E4A]"
            : "timer-pulse border-edge bg-field text-fg"
      }`}
    >
      {expired ? "⏰ Zeit ist um!" : `⏱ ${formatTimer(secondsLeft)}`}
      {isAdmin && (
        <button type="button" aria-label="Timer stoppen" title="Timer stoppen" onClick={onStop} className="text-dim hover:text-fg">
          ×
        </button>
      )}
    </span>
  );
}

export function RetroRoom({ retroId }: { retroId: string }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [tokenLoaded, setTokenLoaded] = useState(false);
  const [state, setState] = useState<RetroStateView | null>(null);
  const [joinName, setJoinName] = useState("");
  const [joinAsAdmin, setJoinAsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Poll-Antworten, die vor einer eigenen Aktion gestartet sind, verwerfen.
  const actionSeqRef = useRef(0);
  const versionRef = useRef<number | null>(null);

  useEffect(() => {
    setToken(window.localStorage.getItem(tokenKey(retroId)));
    const profile = storedProfile();
    setJoinName((current) => current || profile.name);
    setJoinAsAdmin(profile.retroRole === "moderator");
    setTokenLoaded(true);
  }, [retroId]);

  /** Sofortiger Abruf (ohne Warten) — direkt nach eigenen Aktionen. */
  const refresh = useCallback(async () => {
    const seq = actionSeqRef.current;
    const res = await fetch(`/api/retro/${retroId}/state?token=${encodeURIComponent(token ?? "")}`, {
      cache: "no-store",
    });
    if (res.ok && seq === actionSeqRef.current) {
      const data = (await res.json()) as RetroStateView;
      versionRef.current = data.version ?? null;
      setState(data);
    }
  }, [retroId, token]);

  const joined = !!state?.you;

  // Zentrales Profil (Dock unten links) gespeichert → in dieses Board übernehmen.
  useEffect(() => {
    if (!joined || !token) return;
    return onProfileSaved(async (p) => {
      await updateRetroProfile(retroId, token, p.name, p.avatar, p.retroRole as "member" | "moderator");
      refresh();
    });
  }, [joined, token, retroId, refresh]);

  // Erstbefüllung: ohne gespeichertes Profil den Board-Namen/-Avatar übernehmen.
  useEffect(() => {
    if (!state?.you) return;
    if (storedProfile().name === "") {
      writeProfile(
        { name: state.you.name, avatar: state.you.avatar, retroRole: state.you.isAdmin ? "moderator" : "member" },
        false,
      );
    }
  }, [state?.you]);

  // WebSocket pusht "changed" → Zustand abrufen; ohne Socket Long-Polling.
  useEffect(() => {
    if (!tokenLoaded) return;
    let stopped = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: number | undefined;
    let fallbackGen = 0;

    const fetchLongPoll = async () => {
      const seq = actionSeqRef.current;
      const v = versionRef.current;
      const res = await fetch(
        `/api/retro/${retroId}/state?token=${encodeURIComponent(token ?? "")}${v !== null ? `&v=${v}` : ""}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error("state failed");
      const data = (await res.json()) as RetroStateView;
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
        `${proto}://${window.location.host}/ws/retro?id=${encodeURIComponent(retroId)}&token=${encodeURIComponent(token ?? "")}`,
      );
      ws.onopen = () => {
        fallbackGen++;
        refresh();
      };
      ws.onmessage = () => refresh();
      ws.onclose = () => {
        if (stopped) return;
        startFallback();
        reconnectTimer = window.setTimeout(connect, 3000);
      };
    };

    refresh();
    connect();

    return () => {
      stopped = true;
      fallbackGen++;
      window.clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [tokenLoaded, retroId, token, refresh]);

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    actionSeqRef.current += 1;
    const result = await fn();
    if (!result.ok) setError(result.error ?? "Aktion fehlgeschlagen.");
    await refresh();
  };

  // Sicherheitsnetz: „schreibt gerade"-Einträge verfallen serverseitig nach
  // ein paar Sekunden ohne eigenen Push — kurz danach einmal nachladen.
  useEffect(() => {
    if (!state || state.typing.filter((t) => !t.mine).length === 0) return;
    const timer = setTimeout(() => refresh(), 7000);
    return () => clearTimeout(timer);
  }, [state, refresh]);

  /** Eigene Stimme sofort anzeigen, ohne auf den Server zu warten. */
  const applyLocalVote = (cardId: string, delta: 1 | -1) => {
    actionSeqRef.current += 1;
    setState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        votesLeft: prev.votesLeft - delta,
        columns: prev.columns.map((c) => ({
          ...c,
          cards: c.cards.map((card) =>
            card.id === cardId
              ? { ...card, votes: card.votes + delta, myVotes: card.myVotes + delta }
              : card,
          ),
        })),
      };
    });
  };

  const join = async () => {
    setError(null);
    const result = await joinRetro(retroId, joinName, joinAsAdmin);
    if (!result.ok || !result.data) {
      setError(result.error ?? "Beitritt fehlgeschlagen.");
      return;
    }
    window.localStorage.setItem(tokenKey(retroId), result.data.token);
    setToken(result.data.token);
  };

  if (!tokenLoaded || state === null) {
    return <div className="mt-8 text-[13px] text-muted">Lade Retro…</div>;
  }

  // Ohne gültiges Token: Beitritt per Name — gleiche Mechanik wie beim Refinement.
  if (!state.you) {
    return (
      <div>
        <Link href="/retro" className="inline-block text-[12.5px] text-muted hover:text-fg hover:underline">
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
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-[13px] text-mid">
            <input
              type="checkbox"
              checked={joinAsAdmin}
              onChange={(e) => setJoinAsAdmin(e.target.checked)}
              className="h-4 w-4 accent-[#6e8ff6]"
            />
            Als Moderator beitreten (Spalten, Verdeckt-Modus, Mergen)
          </label>
          {error && <div className="mt-2 text-[12.5px] text-danger">{error}</div>}
        </div>
      </div>
    );
  }

  const isAdmin = state.you.isAdmin;
  const t = token ?? "";

  const remove = async () => {
    if (!window.confirm(`Retro „${state.name}" wirklich löschen?`)) return;
    const result = await deleteRetro(retroId, t);
    if (!result.ok) {
      setError(result.error ?? "Löschen fehlgeschlagen.");
      return;
    }
    router.push("/retro");
  };

  return (
    <div data-full-width>
      <Link href="/retro" className="inline-block text-[12.5px] text-muted hover:text-fg hover:underline">
        ← Zur Übersicht
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <h1 className="text-[29px] font-semibold tracking-[-0.028em]">{state.name}</h1>
          <div className="mt-[7px] text-[13px] text-muted">
            Retroperspektive · du bist {state.you.name}
            {isAdmin ? " (Moderator)" : ""}
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <MusicPanel
            musicOn={state.musicOn}
            isAdmin={isAdmin}
            onToggle={() => run(() => setRetroMusic(retroId, t, !state.musicOn))}
          />
          <TimerChip
            remaining={state.timerRemainingSec}
            isAdmin={isAdmin}
            onStart={(seconds) => run(() => setRetroTimer(retroId, t, seconds))}
            onStop={() => run(() => setRetroTimer(retroId, t, null))}
          />
          {isAdmin ? (
            <button
              type="button"
              title={
                state.votingOpen
                  ? "Voting läuft — Klick sperrt es wieder"
                  : "Voting freigeben, damit alle Stimmen vergeben können"
              }
              onClick={() => run(() => setRetroVotingOpen(retroId, t, !state.votingOpen))}
              className={`px-3.5 py-[7px] ${state.votingOpen ? "btn-secondary" : "btn-primary"}`}
            >
              {state.votingOpen ? "🗳 Voting sperren" : "🗳 Voting freigeben"}
            </button>
          ) : (
            <span className="rounded-full border border-edge bg-field px-2.5 py-1 text-[12px] text-mid">
              {state.votingOpen ? "🗳 Voting offen" : "🗳 Voting gesperrt"}
            </span>
          )}
          {isAdmin ? (
            <button
              type="button"
              title={
                state.hidden
                  ? "Karten sind verdeckt — Klick macht sie für alle lesbar"
                  : "Karten sind sichtbar — Klick verdeckt fremde Karten (anonym schreiben)"
              }
              onClick={() => run(() => setRetroHidden(retroId, t, !state.hidden))}
              className={`px-3.5 py-[7px] ${state.hidden ? "btn-primary" : "btn-secondary"}`}
            >
              {state.hidden ? "🙈 Verdeckt — aufdecken" : "👁 Sichtbar — verdecken"}
            </button>
          ) : (
            <span className="rounded-full border border-edge bg-field px-2.5 py-1 text-[12px] text-mid">
              {state.hidden ? "🙈 Karten verdeckt" : "👁 Karten sichtbar"}
            </span>
          )}
          {isAdmin && (
            <button type="button" onClick={remove} className="btn-danger px-3.5 py-[7px]">
              Löschen
            </button>
          )}
        </div>
      </div>
      {error && <div className="mt-3 text-[12.5px] text-danger">{error}</div>}

      {/* Wer ist da? */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {state.participants
          .filter((p) => p.online)
          .map((p) => (
            <span
              key={p.name}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] ${
                p.name === state.you?.name ? "border-accent bg-chip font-medium text-fg" : "border-edge bg-field text-mid"
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
            </span>
          ))}
      </div>

      <RetroBoard
        state={state}
        onAddCard={(columnId, text) => run(() => addRetroCard(retroId, t, columnId, text))}
        onUpdateCard={(cardId, text) => run(() => updateRetroCard(retroId, t, cardId, text))}
        onDeleteCard={(cardId) => run(() => deleteRetroCard(retroId, t, cardId))}
        onVote={(cardId) => {
          if (state.votesLeft <= 0 || !state.votingOpen) return;
          applyLocalVote(cardId, 1);
          run(() => voteRetroCard(retroId, t, cardId));
        }}
        onUnvote={(cardId) => {
          if (!state.votingOpen) return;
          applyLocalVote(cardId, -1);
          run(() => unvoteRetroCard(retroId, t, cardId));
        }}
        onAddComment={(cardId, text) => run(() => addRetroComment(retroId, t, cardId, text))}
        onDeleteComment={(commentId) => run(() => deleteRetroComment(retroId, t, commentId))}
        onMerge={(sourceId, targetId) => run(() => mergeRetroCards(retroId, t, sourceId, targetId))}
        onAddColumn={(name, color) => run(() => addRetroColumn(retroId, t, name, color))}
        onRenameColumn={(columnId, name) => run(() => renameRetroColumn(retroId, t, columnId, name))}
        onSetColumnColor={(columnId, color) => run(() => setRetroColumnColor(retroId, t, columnId, color))}
        onReorderColumn={(columnId, targetColumnId) => run(() => reorderRetroColumn(retroId, t, columnId, targetColumnId))}
        onSetColumnCollapsed={(columnId, collapsed) => run(() => setRetroColumnCollapsed(retroId, t, columnId, collapsed))}
        onSetSortMode={(mode) => run(() => setRetroSortMode(retroId, t, mode))}
        onDeleteColumn={(columnId) => run(() => deleteRetroColumn(retroId, t, columnId))}
        onSearchGifs={searchGifs}
        onTyping={(columnId) => {
          // Fire-and-forget: kein refresh(), das Update kommt über den WebSocket.
          setRetroTyping(retroId, t, columnId).catch(() => {});
        }}
      />

    </div>
  );
}
