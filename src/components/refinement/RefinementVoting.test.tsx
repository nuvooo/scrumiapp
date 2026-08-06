import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

vi.mock("canvas-confetti", () => ({ default: vi.fn() }));

import confetti from "canvas-confetti";
import { RefinementVoting } from "./RefinementVoting";
import type { RefinementStateView } from "@/lib/view/refinementState";

afterEach(() => {
  cleanup();
  vi.mocked(confetti).mockClear();
});

const baseState = (over: Partial<RefinementStateView> = {}): RefinementStateView => ({
  id: "r1",
  name: "Refinement KW 31",
  state: "RUNNING",
  you: { name: "Ben", avatar: "", isAdmin: false },
  participants: [
    { name: "Anna", avatar: "", isAdmin: true, online: true, voted: false },
    { name: "Ben", avatar: "", isAdmin: false, online: true, voted: false },
    { name: "Zoe", avatar: "🦊", isAdmin: false, online: true, voted: true },
  ],
  tickets: [
    { id: "t1", jiraKey: "AB-1", summary: "Login", issueType: "Story", description: "", url: null, previousPoints: null, state: "VOTING", finalPoints: null },
    { id: "t2", jiraKey: "AB-2", summary: "Suche", issueType: "Story", description: "", url: null, previousPoints: 5, state: "PENDING", finalPoints: null },
  ],
  activeTicket: {
    id: "t1", jiraKey: "AB-1", summary: "Login", issueType: "Story", description: "", url: null, previousPoints: null,
    state: "VOTING", myVoteGiven: false, votes: null, stats: null,
  },
  throws: [],
  version: 0,
  ...over,
});

const revealedState = (): RefinementStateView =>
  baseState({
    you: { name: "Anna", avatar: "", isAdmin: true },
    participants: [
      { name: "Anna", avatar: "", isAdmin: true, online: true, voted: false },
      { name: "Ben", avatar: "", isAdmin: false, online: true, voted: true },
      { name: "Zoe", avatar: "", isAdmin: false, online: true, voted: true },
    ],
    activeTicket: {
      id: "t1", jiraKey: "AB-1", summary: "Login", issueType: "Story", description: "", url: null, previousPoints: null,
      state: "REVEALED", myVoteGiven: false,
      votes: [
        { name: "Ben", points: 8 },
        { name: "Zoe", points: null },
      ],
      stats: { average: 8, median: 8, count: 1 },
    },
  });

const noop = () => {};
const handlers = { onVote: noop, onRetract: noop, onSelect: noop, onReveal: noop, onAccept: noop, onFinish: noop, onThrow: noop };

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

  it("ein erneuter Klick auf die gewählte Karte nimmt die Schätzung zurück", () => {
    const onVote = vi.fn();
    const onRetract = vi.fn();
    const voted = baseState({
      activeTicket: {
        id: "t1", jiraKey: "AB-1", summary: "Login", issueType: "Story", description: "", url: null, previousPoints: null,
        state: "VOTING", myVoteGiven: true, myVote: 8, votes: null, stats: null,
      },
    });
    render(<RefinementVoting state={voted} {...handlers} onVote={onVote} onRetract={onRetract} />);
    fireEvent.click(screen.getByRole("button", { name: "8 Punkte" }));
    expect(onRetract).toHaveBeenCalled();
    expect(onVote).not.toHaveBeenCalled();
    // eine andere Karte wählt normal um
    fireEvent.click(screen.getByRole("button", { name: "5 Punkte" }));
    expect(onVote).toHaveBeenCalledWith(5);
  });

  it("der Moderator schätzt nicht mit: keine Kartenhand, aber Aufdecken und Ticketwahl", () => {
    const onReveal = vi.fn();
    const admin = baseState({ you: { name: "Anna", avatar: "", isAdmin: true } });
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

  it("abwesende Teilnehmer sitzen nicht am Tisch und zählen nicht", () => {
    const withOffline = baseState({
      participants: [
        { name: "Anna", avatar: "", isAdmin: true, online: true, voted: false },
        { name: "Ben", avatar: "", isAdmin: false, online: true, voted: false },
        { name: "Zoe", avatar: "", isAdmin: false, online: false, voted: true }, // Tab zu
      ],
    });
    render(<RefinementVoting state={withOffline} {...handlers} />);
    expect(screen.queryByTestId("participant-Zoe")).not.toBeInTheDocument();
    expect(screen.getByText(/0\s*\/\s*1/)).toBeInTheDocument();
  });

  it("markiert das ausgewählte Ticket in der Seitenliste", () => {
    render(<RefinementVoting state={baseState({ you: { name: "Anna", avatar: "", isAdmin: true } })} {...handlers} />);
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
    const idle = baseState({ you: { name: "Anna", avatar: "", isAdmin: true }, activeTicket: null });
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

  it("aufgedeckte Karten liegen als Flip offen (is-open)", () => {
    render(<RefinementVoting state={revealedState()} {...handlers} />);
    expect(screen.getByTestId("seat-card-Ben").querySelector(".flip-card")).toHaveClass("is-open");
    // Vor dem Aufdecken bleibt die Karte zu
    cleanup();
    render(<RefinementVoting state={baseState()} {...handlers} />);
    expect(screen.getByTestId("seat-card-Zoe").querySelector(".flip-card")).not.toHaveClass("is-open");
  });

  it("Klick auf einen fremden Sitz öffnet den Emoji-Picker und wirft", () => {
    const onThrow = vi.fn();
    render(<RefinementVoting state={baseState()} {...handlers} onThrow={onThrow} />);
    fireEvent.click(screen.getByRole("button", { name: "Zoe bewerfen" }));
    fireEvent.click(screen.getByRole("button", { name: "🍅 auf Zoe werfen" }));
    expect(onThrow).toHaveBeenCalledWith("Zoe", "🍅");
    // Picker schließt nach dem Wurf
    expect(screen.queryByRole("button", { name: "🍅 auf Zoe werfen" })).not.toBeInTheDocument();
  });

  it("den eigenen Sitz kann man nicht bewerfen", () => {
    render(<RefinementVoting state={baseState()} {...handlers} />);
    expect(screen.queryByRole("button", { name: "Ben bewerfen" })).not.toBeInTheDocument();
    expect(screen.getByTestId("seat-card-Ben")).toBeDisabled();
  });

  it("feiert Einstimmigkeit mit Konfetti — aber nur einmal pro Aufdecken", () => {
    const unanimousState = (): RefinementStateView =>
      baseState({
        activeTicket: {
          id: "t1", jiraKey: "AB-1", summary: "Login", issueType: "Story", description: "", url: null, previousPoints: null,
          state: "REVEALED", myVoteGiven: true, myVote: 8,
          votes: [
            { name: "Ben", points: 8 },
            { name: "Zoe", points: 8 },
          ],
          stats: { average: 8, median: 8, count: 2 },
        },
      });
    const { rerender } = render(<RefinementVoting state={unanimousState()} {...handlers} />);
    expect(confetti).toHaveBeenCalled();
    expect(screen.getByText(/Einstimmig!/)).toBeInTheDocument();

    // Ein weiterer Poll mit gleichem Stand feiert nicht erneut
    vi.mocked(confetti).mockClear();
    rerender(<RefinementVoting state={unanimousState()} {...handlers} />);
    expect(confetti).not.toHaveBeenCalled();
  });

  it("kein Konfetti bei unterschiedlichen Karten oder „?“", () => {
    render(<RefinementVoting state={revealedState()} {...handlers} />);
    expect(confetti).not.toHaveBeenCalled();
    expect(screen.queryByText(/Einstimmig!/)).not.toBeInTheDocument();
  });

  it("markiert den eigenen Sitz und zeigt Avatare", () => {
    render(<RefinementVoting state={baseState()} {...handlers} />);
    // Ben (du) ist deutlich hervorgehoben
    expect(screen.getByTestId("participant-Ben")).toHaveAttribute("data-you");
    expect(screen.getByText(/Ben \(du\)/)).toBeInTheDocument();
    expect(screen.getByTestId("participant-Zoe")).not.toHaveAttribute("data-you");
    // Zoes Fuchs-Avatar erscheint am Sitz
    expect(screen.getByTestId("participant-Zoe")).toHaveTextContent("🦊");
  });
});
