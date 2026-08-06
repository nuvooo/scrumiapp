"use client";

import { useState } from "react";

/** Emoji-Auswahl für Karten — bewusst kompakt, die Tastatur kann den Rest. */
export const COMPOSER_EMOJIS = [
  "😀", "😅", "😂", "🥹", "😊", "😍", "🤩", "😎",
  "🤔", "🙃", "😴", "🥳", "😭", "😡", "🤯", "🫠",
  "👍", "👎", "👏", "🙌", "💪", "🔥", "✨", "🎉",
  "❤️", "💡", "✅", "❌", "❓", "🚀", "🐢", "🎯",
] as const;

/** Kuratierte Reaktions-GIFs (Giphy-CDN, Erreichbarkeit geprüft) — eigene GIF-URLs gehen weiter per Copy & Paste. */
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

/**
 * Kleine Werkzeugleiste für Karten-Eingaben: 😊 öffnet die Emoji-Auswahl,
 * GIF eine Galerie mit Reaktions-GIFs. Beides fügt in den Text ein.
 */
export function EmojiGifPicker({ onInsert }: { onInsert: (snippet: string) => void }) {
  const [open, setOpen] = useState<"emoji" | "gif" | null>(null);

  return (
    <div className="relative flex items-center gap-1">
      <button
        type="button"
        aria-label="Emoji auswählen"
        title="Emoji einfügen"
        onClick={() => setOpen((o) => (o === "emoji" ? null : "emoji"))}
        className={`btn-secondary h-[26px] w-[28px] rounded-[7px] text-[14px] leading-none ${open === "emoji" ? "border-accent" : ""}`}
      >
        😊
      </button>
      <button
        type="button"
        aria-label="GIF auswählen"
        title="GIF einfügen"
        onClick={() => setOpen((o) => (o === "gif" ? null : "gif"))}
        className={`btn-secondary h-[26px] rounded-[7px] px-1.5 font-mono text-[10.5px] font-semibold leading-none ${open === "gif" ? "border-accent" : ""}`}
      >
        GIF
      </button>
      {open === "emoji" && (
        <div className="absolute bottom-[32px] left-0 z-30 grid w-[268px] grid-cols-8 gap-1 rounded-[9px] border border-edge bg-field p-2 shadow-card">
          {COMPOSER_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-label={`Emoji ${emoji}`}
              onClick={() => onInsert(emoji)}
              className="rounded text-[17px] leading-[1.4] transition-transform hover:-translate-y-0.5"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
      {open === "gif" && (
        <div className="absolute bottom-[32px] left-0 z-30 grid max-h-[290px] w-[318px] grid-cols-3 gap-1.5 overflow-y-auto rounded-[9px] border border-edge bg-field p-2 shadow-card">
          {RETRO_GIFS.map((url, i) => (
            <button
              key={url}
              type="button"
              aria-label={`GIF ${i + 1} einfügen`}
              onClick={() => {
                onInsert(url);
                setOpen(null);
              }}
              className="overflow-hidden rounded-[7px] border border-edge hover:border-accent"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`GIF ${i + 1}`} loading="lazy" className="h-[64px] w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
