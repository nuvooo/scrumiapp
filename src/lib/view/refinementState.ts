/** JSON-Formen des Polling-Endpoints /api/refinement/[id]/state. */

export type RefinementPhase = "DRAFT" | "RUNNING" | "DONE";
export type RefinementTicketPhase = "PENDING" | "VOTING" | "REVEALED" | "ESTIMATED";

export interface RefinementTicketView {
  id: string;
  jiraKey: string;
  summary: string;
  issueType: string;
  previousPoints: number | null;
  state: RefinementTicketPhase;
  finalPoints: number | null;
}

export interface RefinementParticipantView {
  name: string;
  isAdmin: boolean;
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

export interface RefinementStateView {
  id: string;
  name: string;
  state: RefinementPhase;
  you: { name: string; isAdmin: boolean } | null;
  participants: RefinementParticipantView[];
  tickets: RefinementTicketView[];
  activeTicket: ActiveTicketView | null;
}
