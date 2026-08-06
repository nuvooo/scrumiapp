/** JSON-Formen des Polling-Endpoints /api/refinement/[id]/state. */

export type RefinementPhase = "DRAFT" | "RUNNING" | "DONE";
export type RefinementTicketPhase = "PENDING" | "VOTING" | "REVEALED" | "ESTIMATED";

export interface RefinementTicketView {
  id: string;
  jiraKey: string;
  summary: string;
  issueType: string;
  /** Beschreibung aus Jira als gekürzter Klartext ("" = keine). */
  description: string;
  /** Link zum Ticket in Jira (null, wenn keine Basis-URL konfiguriert ist). */
  url: string | null;
  previousPoints: number | null;
  state: RefinementTicketPhase;
  finalPoints: number | null;
}

export interface RefinementParticipantView {
  name: string;
  /** Emoji-Avatar ("" = keiner gewählt). */
  avatar: string;
  isAdmin: boolean;
  /** Anwesend = hat innerhalb der letzten ~12 s gepollt (Heartbeat). */
  online: boolean;
  voted: boolean;
}

export interface ActiveTicketView extends Omit<RefinementTicketView, "finalPoints"> {
  /** Eigene Karte (undefined = noch nicht abgestimmt, null = „?"). */
  myVote?: number | null;
  myVoteGiven: boolean;
  /** Erst nach dem Aufdecken gefüllt. */
  votes: { name: string; points: number | null }[] | null;
  stats: { average: number | null; median: number | null; count: number } | null;
}

/** Emojis, mit denen man andere anstupsen (bewerfen) darf. */
export const THROW_EMOJIS = ["🍅", "🥚", "❤️", "👏", "😴"] as const;

/** Auswahl an Emoji-Avataren fürs eigene Profil. */
export const AVATAR_EMOJIS = ["🦊", "🐼", "🐸", "🦄", "🐙", "🐝", "🦖", "🐳", "🦉", "🐱", "🐰", "🦁"] as const;

/** Flüchtiges Wurf-Event — lebt serverseitig nur wenige Sekunden. */
export interface RefinementThrowView {
  id: string;
  from: string;
  to: string;
  emoji: string;
  at: number;
}

export interface RefinementStateView {
  id: string;
  name: string;
  state: RefinementPhase;
  you: { name: string; avatar: string; isAdmin: boolean } | null;
  participants: RefinementParticipantView[];
  tickets: RefinementTicketView[];
  activeTicket: ActiveTicketView | null;
  /** Kürzlich geworfene Emojis (Anstupsen) — Clients animieren neue Events. */
  throws: RefinementThrowView[];
  /** Änderungszähler fürs Long-Polling: Client schickt ihn als ?v= zurück. */
  version: number;
}
