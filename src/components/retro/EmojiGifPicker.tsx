"use client";

import { useEffect, useState } from "react";
import type { GifResult } from "@/app/(app)/retro/actions";

/** Emoji-Auswahl für Karten — bewusst kompakt, die Tastatur kann den Rest. */
export const COMPOSER_EMOJIS = [
  "😀", "😅", "😂", "🥹", "😊", "😍", "🤩", "😎",
  "🤔", "🙃", "😴", "🥳", "😭", "😡", "🤯", "🫠",
  "👍", "👎", "👏", "🙌", "💪", "🔥", "✨", "🎉",
  "❤️", "💡", "✅", "❌", "❓", "🚀", "🐢", "🎯",
] as const;

/** Fallback ohne GIPHY_API_KEY: kuratierte Reaktions-GIFs (Giphy-CDN, geprüft). */
export const RETRO_GIFS = [
  "https://media.giphy.com/media/111ebonMs90YLu/giphy.gif",
  "https://media.giphy.com/media/7rj2ZgttvgomY/giphy.gif",
  "https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif",
  "https://media.giphy.com/media/g9582DNuQppxC/giphy.gif",
  "https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif",
  "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif",
  "https://media.giphy.com/media/S9i8jJxTvAKVHVMvvW/giphy.gif",
  "https://media.giphy.com/media/mCRJDo24UvJMA/giphy.gif",
  "https://media.giphy.com/media/BlVnrxJgTGsUw/giphy.gif",
  "https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif",
  "https://media.giphy.com/media/YRuFixSNWFVcXaxpmX/giphy.gif",
] as const;

export type GifSearch = (query: string) => Promise<{ ok: boolean; error?: string; data?: GifResult[] }>;

function GifDialog({
  searchGifs,
  onPick,
  onClose,
}: {
  searchGifs: GifSearch;
  onPick: (url: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<GifResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Kein API-Key → kuratierte Galerie statt Suche. */
  const [fallback, setFallback] = useState(false);

  // Suche mit kleiner Tipp-Pause; leerer Begriff = Trending.
  useEffect(() => {
    if (fallback) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await searchGifs(query);
      if (cancelled) return;
      if (result.ok) {
        setGifs(result.data ?? []);
        setError(null);
      } else if ((result.error ?? "").includes("GIPHY_API_KEY")) {
        setFallback(true);
      } else {
        setError(result.error ?? "Suche fehlgeschlagen.");
      }
    }, query ? 450 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, fallback]);

  return (
    <div
      role="dialog"
      aria-label="GIF auswählen"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="card flex max-h-[76vh] w-full max-w-[560px] flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-line px-[16px] py-[11px]">
          <div className="text-sm font-semibold">GIF auswählen</div>
          {!fallback && <span className="text-[11px] text-dim">powered by GIPHY</span>}
          <button
            type="button"
            aria-label="Schließen"
            onClick={onClose}
            className="btn-secondary ml-auto h-[26px] w-[26px] rounded-[7px]"
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-[14px]">
          {fallback ? (
            <>
              <div className="mb-2.5 text-[12px] text-muted">
                Für die Giphy-Suche <code className="font-mono">GIPHY_API_KEY</code> in der .env setzen
                (kostenlos auf developers.giphy.com) — bis dahin eine kleine Auswahl:
              </div>
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                {RETRO_GIFS.map((url, i) => (
                  <button
                    key={url}
                    type="button"
                    aria-label={`GIF ${i + 1} einfügen`}
                    onClick={() => onPick(url)}
                    className="overflow-hidden rounded-[7px] border border-edge hover:border-accent"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`GIF ${i + 1}`} loading="lazy" className="h-[80px] w-full object-cover" />
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <input
                aria-label="GIFs durchsuchen"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Suchen… (leer = Trending)"
                autoFocus
                className="input-field mb-2.5"
              />
              {error && <div className="text-[12.5px] text-danger">{error}</div>}
              {gifs === null && !error && <div className="text-[13px] text-muted">Lade GIFs…</div>}
              {gifs !== null && gifs.length === 0 && (
                <div className="text-[13px] text-muted">Nichts gefunden — anderer Suchbegriff?</div>
              )}
              {gifs !== null && gifs.length > 0 && (
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                  {gifs.map((gif, i) => (
                    <button
                      key={`${gif.url}-${i}`}
                      type="button"
                      aria-label={`GIF ${i + 1} einfügen`}
                      onClick={() => onPick(gif.url)}
                      className="overflow-hidden rounded-[7px] border border-edge hover:border-accent"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={gif.preview} alt={`GIF ${i + 1}`} loading="lazy" className="h-[80px] w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Werkzeugleiste für Karten-Eingaben: 😊 öffnet die Emoji-Auswahl, GIF die
 * Giphy-Suche (bzw. eine kuratierte Galerie ohne API-Key). Beide öffnen als
 * zentrierter Dialog — nichts wird mehr vom Spalten-Scroller abgeschnitten.
 */
export function EmojiGifPicker({
  onInsert,
  searchGifs,
}: {
  onInsert: (snippet: string) => void;
  searchGifs: GifSearch;
}) {
  const [open, setOpen] = useState<"emoji" | "gif" | null>(null);

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label="Emoji auswählen"
        title="Emoji einfügen"
        onClick={() => setOpen("emoji")}
        className="btn-secondary h-[26px] w-[28px] rounded-[7px] text-[14px] leading-none"
      >
        😊
      </button>
      <button
        type="button"
        aria-label="GIF auswählen"
        title="GIF einfügen"
        onClick={() => setOpen("gif")}
        className="btn-secondary h-[26px] rounded-[7px] px-1.5 font-mono text-[10.5px] font-semibold leading-none"
      >
        GIF
      </button>

      {open === "emoji" && (
        <div
          role="dialog"
          aria-label="Emoji auswählen"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(null)}
        >
          <div
            className="card grid w-full max-w-[340px] grid-cols-8 gap-1.5 p-3"
            onClick={(e) => e.stopPropagation()}
          >
            {COMPOSER_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={`Emoji ${emoji}`}
                onClick={() => {
                  onInsert(emoji);
                  setOpen(null);
                }}
                className="rounded text-[19px] leading-[1.5] transition-transform hover:-translate-y-0.5"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {open === "gif" && (
        <GifDialog
          searchGifs={searchGifs}
          onPick={(url) => {
            onInsert(url);
            setOpen(null);
          }}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
