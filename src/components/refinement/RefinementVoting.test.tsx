import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import type { SceneParticipant, SceneHand } from "./PokerTableScene";

// jsdom kann kein WebGL — die three.js-Szene wird durch ein Props-Echo ersetzt.
vi.mock("./PokerTableScene", () => ({
  PokerTableScene: ({
    participants,
    revealed,
    hand,
    viewpoint,
  }: {
    participants: SceneParticipant[];
    revealed: boolean;
    hand: SceneHand | null;
    viewpoint?: string;
  }) => (
    <div data-testid="poker-scene" data-revealed={String(revealed)} data-viewpoint={viewpoint}>
      {participants.map((p) => (
        <span key={p.name} data-testid={`participant-${p.name}`} data-voted={String(p.voted)}>
          {p.name}:{p.revealedPoints === undefined ? "" : p.revealedPoints === null ? "?" : p.revealedPoints}
        </span>
      ))}
      {hand &&
        hand.cards.map((c) => (
          <button
            key={c === null ? "?" : c}
            aria-label={c === null ? "Unklar" : `${c} Punkte`}
            onClick={() => hand.onPick(c)}
          />
        ))}
    </div>
  ),
}));

import { RefinementVoting } from "./RefinementVoting";
import type { RefinementStateView } from "@/lib/view/refinementState";

afterEach(cleanup);

const baseState = (over: Partial<RefinementStateView> = {}): RefinementStateView => ({
  id: "r1",
  name: "Refinement KW 31",
  state: "RUNNING",
  you: { name: "Ben", isAdmin: false },
  participants: [
    { name: "Anna", isAdmin: true, voted: true },
    { name: "Ben", isAdmin: false, voted: false },
  ],
  tickets: [
    { id: "t1", jiraKey: "AB-1", summary: "Login", issueType: "Story", previousPoints: null, state: "VOTING", finalPoints: null },
    { id: "t2", jiraKey: "AB-2", summary: "Suche", issueType: "Story", previousPoints: 5, state: "PENDING", finalPoints: null },
  ],
  activeTicket: {
    id: "t1", jiraKey: "AB-1", summary: "Login", issueType: "Story", previousPoints: null,
    state: "VOTING", myVoteGiven: false, votes: null, stats: null,
  },
  ...over,
});

const revealedState = (): RefinementStateView =>
  baseState({
    you: { name: "Anna", isAdmin: true },
    participants: [
      { name: "Anna", isAdmin: true, voted: false },
      { name: "Ben", isAdmin: false, voted: true },
      { name: "Zoe", isAdmin: false, voted: true },
    ],
    activeTicket: {
      id: "t1", jiraKey: "AB-1", summary: "Login", issueType: "Story", previousPoints: null,
      state: "REVEALED", myVoteGiven: false,
      votes: [
        { name: "Ben", points: 8 },
        { name: "Zoe", points: null },
      ],
      stats: { average: 6.5, median: 6.5, count: 2 },
    },
  });

const noop = () => {};
const handlers = { onVote: noop, onSelect: noop, onReveal: noop, onAccept: noop, onFinish: noop };

describe("RefinementVoting", () => {
  it("Teilnehmer sehen die Ego-Perspektive mit Kartenhand — Moderatoren sitzen nicht am Tisch", () => {
    const onVote = vi.fn();
    render(<RefinementVoting state={baseState()} {...handlers} onVote={onVote} />);
    expect(screen.getByText("AB-1")).toBeInTheDocument();
    expect(screen.getByTestId("poker-scene")).toHaveAttribute("data-viewpoint", "first-person");
    expect(screen.queryByTestId("participant-Anna")).not.toBeInTheDocument(); // Admin ohne Sitzplatz
    expect(screen.getByTestId("participant-Ben")).toHaveAttribute("data-voted", "false");
    fireEvent.click(screen.getByRole("button", { name: "8 Punkte" }));
    expect(onVote).toHaveBeenCalledWith(8);
    fireEvent.click(screen.getByRole("button", { name: "Unklar" }));
    expect(onVote).toHaveBeenCalledWith(null);
    expect(screen.getByText(/0\s*\/\s*1/)).toBeInTheDocument(); // nur Schätzende zählen
  });

  it("der Moderator sieht die Draufsicht und schätzt nicht mit", () => {
    const admin = baseState({ you: { name: "Anna", isAdmin: true } });
    render(<RefinementVoting state={admin} {...handlers} />);
    expect(screen.getByTestId("poker-scene")).toHaveAttribute("data-viewpoint", "top");
    expect(screen.queryByRole("button", { name: "5 Punkte" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Unklar" })).not.toBeInTheDocument();
    expect(screen.getByText(/Warten, bis alle ihre Karte verdeckt gelegt haben/)).toBeInTheDocument();
  });

  it("Admin sieht Aufdecken und die Ticketwahl, Teilnehmer nicht", () => {
    const onReveal = vi.fn();
    const admin = baseState({ you: { name: "Anna", isAdmin: true } });
    const { unmount } = render(<RefinementVoting state={admin} {...handlers} onReveal={onReveal} />);
    fireEvent.click(screen.getByRole("button", { name: "Aufdecken" }));
    expect(onReveal).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "AB-2 besprechen" })).toBeInTheDocument();
    unmount();

    render(<RefinementVoting state={baseState()} {...handlers} />);
    expect(screen.queryByRole("button", { name: "Aufdecken" })).not.toBeInTheDocument();
  });

  it("nach dem Aufdecken bekommen die Sitze ihre offenen Werte — inklusive „?“", () => {
    render(<RefinementVoting state={revealedState()} {...handlers} />);
    expect(screen.getByTestId("poker-scene")).toHaveAttribute("data-revealed", "true");
    expect(screen.queryByTestId("participant-Anna")).not.toBeInTheDocument();
    expect(screen.getByTestId("participant-Ben")).toHaveTextContent("Ben:8");
    expect(screen.getByTestId("participant-Zoe")).toHaveTextContent("Zoe:?");
    expect(screen.getByText(/Ø 6,5/)).toBeInTheDocument();
  });

  it("Admin übernimmt mit Median vorbelegt oder passt an", () => {
    const onAccept = vi.fn();
    render(<RefinementVoting state={revealedState()} {...handlers} onAccept={onAccept} />);
    const input = screen.getByLabelText("Finale Schätzung") as HTMLInputElement;
    expect(input.value).toBe("6.5");
    fireEvent.change(input, { target: { value: "8" } });
    fireEvent.click(screen.getByRole("button", { name: "Übernehmen" }));
    expect(onAccept).toHaveBeenCalledWith(8);
  });
});
