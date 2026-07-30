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

const noop = () => {};
const handlers = { onVote: noop, onSelect: noop, onReveal: noop, onAccept: noop, onFinish: noop };

describe("RefinementVoting", () => {
  it("zeigt das aktive Ticket, Karten und den Abstimm-Status", () => {
    render(<RefinementVoting state={baseState()} {...handlers} />);
    expect(screen.getByText("AB-1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "5 Punkte" })).toBeInTheDocument();
    expect(screen.getByTestId("participant-Anna")).toHaveTextContent("✓");
    expect(screen.getByTestId("participant-Ben")).not.toHaveTextContent("✓");
  });

  it("gibt die gewählte Karte an onVote weiter", () => {
    const onVote = vi.fn();
    render(<RefinementVoting state={baseState()} {...handlers} onVote={onVote} />);
    fireEvent.click(screen.getByRole("button", { name: "8 Punkte" }));
    expect(onVote).toHaveBeenCalledWith(8);
    fireEvent.click(screen.getByRole("button", { name: "Unklar" }));
    expect(onVote).toHaveBeenCalledWith(null);
  });

  it("zeigt vor dem Aufdecken keine Vote-Werte", () => {
    render(<RefinementVoting state={baseState()} {...handlers} />);
    expect(screen.queryByTestId("revealed-votes")).not.toBeInTheDocument();
  });

  it("Admin sieht Aufdecken und Ticketwahl, Teilnehmer nicht", () => {
    const onReveal = vi.fn();
    const admin = baseState({ you: { name: "Anna", isAdmin: true } });
    const { unmount } = render(<RefinementVoting state={admin} {...handlers} onReveal={onReveal} />);
    fireEvent.click(screen.getByRole("button", { name: "Aufdecken" }));
    expect(onReveal).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /AB-2/ })).toBeInTheDocument();
    unmount();

    render(<RefinementVoting state={baseState()} {...handlers} />);
    expect(screen.queryByRole("button", { name: "Aufdecken" })).not.toBeInTheDocument();
  });

  it("nach dem Aufdecken: Votes, Statistik und Übernehmen mit Median vorbelegt", () => {
    const onAccept = vi.fn();
    const revealed = baseState({
      you: { name: "Anna", isAdmin: true },
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
    render(<RefinementVoting state={revealed} {...handlers} onAccept={onAccept} />);
    expect(screen.getByTestId("revealed-votes")).toHaveTextContent("Anna");
    expect(screen.getByTestId("revealed-votes")).toHaveTextContent("?");
    expect(screen.getByText(/Ø 6,5/)).toBeInTheDocument();
    const input = screen.getByLabelText("Finale Schätzung") as HTMLInputElement;
    expect(input.value).toBe("6.5");
    fireEvent.change(input, { target: { value: "8" } });
    fireEvent.click(screen.getByRole("button", { name: "Übernehmen" }));
    expect(onAccept).toHaveBeenCalledWith(8);
  });
});
