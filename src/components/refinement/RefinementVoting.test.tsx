import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
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
      { name: "Anna", isAdmin: true, voted: true },
      { name: "Ben", isAdmin: false, voted: true },
      { name: "Zoe", isAdmin: false, voted: true },
    ],
    activeTicket: {
      id: "t1", jiraKey: "AB-1", summary: "Login", issueType: "Story", previousPoints: null,
      state: "REVEALED", myVoteGiven: true, myVote: 5,
      votes: [
        { name: "Anna", points: 5 },
        { name: "Ben", points: 8 },
        { name: "Zoe", points: null },
      ],
      stats: { average: 6.5, median: 6.5, count: 2 },
    },
  });

const noop = () => {};
const handlers = { onVote: noop, onSelect: noop, onReveal: noop, onAccept: noop, onFinish: noop };

describe("RefinementVoting", () => {
  it("zeigt den Tisch mit Sitzen: abgestimmt = Kartenrücken, sonst leerer Platz", () => {
    render(<RefinementVoting state={baseState()} {...handlers} />);
    expect(screen.getByText("AB-1")).toBeInTheDocument();
    expect(screen.getByTestId("participant-Anna")).toHaveAttribute("data-voted", "true");
    expect(screen.getByTestId("participant-Ben")).toHaveAttribute("data-voted", "false");
    expect(screen.getByTestId("seat-card-Anna")).toHaveTextContent("");
    expect(screen.getByText(/Warten auf Stimmen/)).toBeInTheDocument();
    expect(screen.getByText(/1\s*\/\s*2/)).toBeInTheDocument();
  });

  it("bietet die eigene Kartenhand an und meldet die Wahl", () => {
    const onVote = vi.fn();
    render(<RefinementVoting state={baseState()} {...handlers} onVote={onVote} />);
    expect(screen.getByText(/Wähle deine Karte/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "8 Punkte" }));
    expect(onVote).toHaveBeenCalledWith(8);
    fireEvent.click(screen.getByRole("button", { name: "Unklar" }));
    expect(onVote).toHaveBeenCalledWith(null);
  });

  it("Admin sieht Aufdecken im Tisch und die Ticketwahl, Teilnehmer nicht", () => {
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

  it("nach dem Aufdecken liegen die Karten offen an den Sitzen", () => {
    render(<RefinementVoting state={revealedState()} {...handlers} />);
    expect(screen.getByTestId("seat-card-Anna")).toHaveTextContent("5");
    expect(screen.getByTestId("seat-card-Ben")).toHaveTextContent("8");
    expect(screen.getByTestId("seat-card-Zoe")).toHaveTextContent("?");
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
