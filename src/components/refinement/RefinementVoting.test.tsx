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
    { name: "Anna", isAdmin: true, voted: false },
    { name: "Ben", isAdmin: false, voted: false },
    { name: "Zoe", isAdmin: false, voted: true },
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
      stats: { average: 8, median: 8, count: 1 },
    },
  });

const noop = () => {};
const handlers = { onVote: noop, onSelect: noop, onReveal: noop, onAccept: noop, onFinish: noop };

describe("RefinementVoting", () => {
  it("zeigt den Tisch: abgestimmt = Kartenrücken, Moderator ohne Sitzplatz", () => {
    render(<RefinementVoting state={baseState()} {...handlers} />);
    // Ticket erscheint am Tisch UND in der Seitenliste (auch für Teilnehmer sichtbar)
    expect(screen.getAllByText("AB-1").length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByTestId("participant-Anna")).not.toBeInTheDocument(); // Moderator sitzt nicht am Tisch
    expect(screen.getByTestId("participant-Zoe")).toHaveAttribute("data-voted", "true");
    expect(screen.getByTestId("participant-Ben")).toHaveAttribute("data-voted", "false");
    expect(screen.getByTestId("seat-card-Zoe")).toHaveTextContent("");
    expect(screen.getByText(/Warten auf Stimmen/)).toBeInTheDocument();
    expect(screen.getByText(/1\s*\/\s*2/)).toBeInTheDocument(); // nur Schätzende zählen
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

  it("der Moderator schätzt nicht mit: keine Kartenhand, aber Aufdecken und Ticketwahl", () => {
    const onReveal = vi.fn();
    const admin = baseState({ you: { name: "Anna", isAdmin: true } });
    const { unmount } = render(<RefinementVoting state={admin} {...handlers} onReveal={onReveal} />);
    expect(screen.queryByRole("button", { name: "5 Punkte" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Unklar" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Aufdecken" }));
    expect(onReveal).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "AB-2 besprechen" })).toBeInTheDocument();
    unmount();

    render(<RefinementVoting state={baseState()} {...handlers} />);
    expect(screen.queryByRole("button", { name: "Aufdecken" })).not.toBeInTheDocument();
  });

  it("nach dem Aufdecken liegen die Karten offen an den Sitzen — inklusive „?“", () => {
    render(<RefinementVoting state={revealedState()} {...handlers} />);
    expect(screen.getByTestId("seat-card-Ben")).toHaveTextContent("8");
    expect(screen.getByTestId("seat-card-Zoe")).toHaveTextContent("?");
    expect(screen.getByText(/Ø 8/)).toBeInTheDocument();
  });

  it("markiert das ausgewählte Ticket in der Seitenliste", () => {
    render(<RefinementVoting state={baseState({ you: { name: "Anna", isAdmin: true } })} {...handlers} />);
    expect(screen.getByRole("button", { name: "AB-1 besprechen" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: "AB-2 besprechen" })).not.toHaveAttribute("aria-current");
  });

  it("„Nächstes Ticket“ springt zum nächsten offenen Ticket", () => {
    const onSelect = vi.fn();
    // Aufgedeckt: weiter zum nächsten offenen Ticket (t2)
    const { unmount } = render(<RefinementVoting state={revealedState()} {...handlers} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Nächstes Ticket →" }));
    expect(onSelect).toHaveBeenCalledWith("t2");
    unmount();

    // Kein aktives Ticket: Button erscheint im Platzhalter
    const idle = baseState({ you: { name: "Anna", isAdmin: true }, activeTicket: null });
    onSelect.mockClear();
    render(<RefinementVoting state={idle} {...handlers} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Nächstes Ticket →" }));
    expect(onSelect).toHaveBeenCalledWith("t1");
  });

  it("der Moderator kann das Voting neu starten", () => {
    const onSelect = vi.fn();
    render(<RefinementVoting state={revealedState()} {...handlers} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Neu abstimmen" }));
    expect(onSelect).toHaveBeenCalledWith("t1");
  });

  it("Admin übernimmt mit Median vorbelegt oder passt an", () => {
    const onAccept = vi.fn();
    render(<RefinementVoting state={revealedState()} {...handlers} onAccept={onAccept} />);
    const input = screen.getByLabelText("Finale Schätzung") as HTMLInputElement;
    expect(input.value).toBe("8");
    fireEvent.change(input, { target: { value: "13" } });
    fireEvent.click(screen.getByRole("button", { name: "Übernehmen" }));
    expect(onAccept).toHaveBeenCalledWith(13);
  });
});
