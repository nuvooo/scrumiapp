/** JSON-Formen des Retro-Endpoints /api/retro/[id]/state plus Templates. */

/** Farbpalette für Retro-Spalten (Akzentfarben passend zum Theme). */
export const RETRO_COLORS = [
  "#5E80EE", // Blau
  "#3EDBB6", // Türkis
  "#4CC38A", // Grün
  "#F59E4A", // Orange
  "#E5484D", // Rot
  "#E93D82", // Pink
  "#B085F5", // Violett
  "#8AB4F8", // Hellblau
] as const;

export interface RetroTemplate {
  key: string;
  name: string;
  columns: { name: string; color: string }[];
}

/** Gängige Retro-Formate — der Moderator muss Spalten nicht jedes Mal neu definieren. */
export const RETRO_TEMPLATES: RetroTemplate[] = [
  {
    key: "well-improve-actions",
    name: "Lief gut / Geht besser / Aktionen",
    columns: [
      { name: "Lief gut 👍", color: "#4CC38A" },
      { name: "Geht besser 🤔", color: "#E5484D" },
      { name: "Aktionen ✅", color: "#B085F5" },
    ],
  },
  {
    key: "start-stop-continue",
    name: "Start / Stop / Continue",
    columns: [
      { name: "Start 🚀", color: "#4CC38A" },
      { name: "Stop ✋", color: "#E5484D" },
      { name: "Continue 🔁", color: "#5E80EE" },
    ],
  },
  {
    key: "mad-sad-glad",
    name: "Mad / Sad / Glad",
    columns: [
      { name: "Mad 😡", color: "#E5484D" },
      { name: "Sad 😢", color: "#F59E4A" },
      { name: "Glad 😄", color: "#4CC38A" },
    ],
  },
  {
    key: "4l",
    name: "4L — Liked / Learned / Lacked / Longed for",
    columns: [
      { name: "Liked ❤️", color: "#E93D82" },
      { name: "Learned 🧠", color: "#5E80EE" },
      { name: "Lacked 🕳️", color: "#F59E4A" },
      { name: "Longed for ✨", color: "#B085F5" },
    ],
  },
  {
    key: "kalm",
    name: "Keep / Add / Less / More",
    columns: [
      { name: "Keep 👌", color: "#4CC38A" },
      { name: "Add ➕", color: "#5E80EE" },
      { name: "Less ➖", color: "#F59E4A" },
      { name: "More ⏫", color: "#E93D82" },
    ],
  },
];

export interface RetroCommentView {
  id: string;
  author: string;
  text: string;
}

export interface RetroCardView {
  id: string;
  /** Eigene Karte — darf bearbeitet und gelöscht werden. */
  mine: boolean;
  /** Verdeckt-Modus: fremde Karten kommen ohne Inhalt ("" ) und ohne Kommentare. */
  covered: boolean;
  text: string;
  votes: number;
  /** Eigene Stimmen auf dieser Karte (fürs Zurücknehmen). */
  myVotes: number;
  comments: RetroCommentView[];
}

export interface RetroColumnView {
  id: string;
  name: string;
  color: string;
  cards: RetroCardView[];
}

export interface RetroStateView {
  id: string;
  name: string;
  /** Verdeckt-Modus an? Fremde Karten sind dann unkenntlich. */
  hidden: boolean;
  votesPerUser: number;
  /** Eigene verbleibende Stimmen. */
  votesLeft: number;
  you: { name: string; isAdmin: boolean } | null;
  participants: { name: string; isAdmin: boolean; online: boolean }[];
  columns: RetroColumnView[];
  /** Änderungszähler fürs Long-Polling (Fallback ohne WebSocket). */
  version: number;
}
