import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { StandupBoard, type StandupGroupView } from "./StandupBoard";

const groups: StandupGroupView[] = [
  {
    name: "Ben",
    openIssues: [
      { jiraKey: "A-1", summary: "Login bauen", issueType: "Story", status: "In Arbeit", url: "https://x.atlassian.net/browse/A-1", daysInStatus: 3, stale: false },
    ],
    doneIssues: [],
  },
  {
    name: "Zoe",
    openIssues: [],
    doneIssues: [
      { jiraKey: "A-2", summary: "Bug fixen", issueType: "Bug", status: "Geschlossen", url: "https://x.atlassian.net/browse/A-2", daysInStatus: null, stale: false },
    ],
  },
];


describe("StandupBoard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Deterministische "Zufalls"-Reihenfolge: [Zoe, Ben]
    vi.spyOn(Math, "random").mockReturnValue(0);
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function start() {
    render(<StandupBoard groups={groups} />);
    fireEvent.click(screen.getByRole("button", { name: "Standup starten" }));
  }

  it("shows a setup screen with participants and speaking time", () => {
    render(<StandupBoard groups={groups} />);
    expect(screen.getByText(/2 Teilnehmer/)).toBeInTheDocument();
    expect(screen.getByLabelText("Redezeit pro Person")).toHaveValue("2:00");
  });

  it("renders open tickets as row cards with their status", () => {
    start();
    fireEvent.click(screen.getByRole("button", { name: "Weiter" })); // zu Ben
    const card = screen.getByTestId("standup-card-A-1");
    expect(card).toHaveTextContent("Login bauen");
    expect(card).toHaveTextContent("In Arbeit");
    expect(card).toHaveTextContent("Story");
  });

  it("links each card to the Jira ticket in a new tab", () => {
    start();
    const link = screen.getByRole("link", { name: "A-2 in Jira öffnen" });
    expect(link).toHaveAttribute("href", "https://x.atlassian.net/browse/A-2");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("marks tickets done since yesterday as erledigt", () => {
    start(); // Zoe zuerst
    const card = screen.getByTestId("standup-card-A-2");
    expect(card).toHaveTextContent("Bug fixen");
    expect(card).toHaveTextContent("erledigt");
  });

  it("zeigt die Verweildauer auf offenen Cards", () => {
    start();
    fireEvent.click(screen.getByRole("button", { name: "Weiter" })); // zu Ben
    expect(screen.getByText("seit 3 Tagen")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /Warnung/ })).not.toBeInTheDocument();
  });

  it("zeigt ein rotes Warn-Icon, wenn das Ticket hängt", () => {
    const stale: StandupGroupView[] = [
      {
        name: "Ben",
        openIssues: [
          { jiraKey: "A-3", summary: "Hängt", issueType: "Story", status: "Review", url: null, daysInStatus: 8, stale: true },
        ],
        doneIssues: [],
      },
    ];
    render(<StandupBoard groups={stale} />);
    fireEvent.click(screen.getByRole("button", { name: "Standup starten" }));
    expect(screen.getByText("seit 8 Tagen")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Warnung/ })).toBeInTheDocument();
    expect(screen.getByTestId("status-age-A-3")).toHaveAttribute(
      "title",
      'Seit 8 Arbeitstagen in „Review"',
    );
  });

  it("zeigt bei daysInStatus 0 „heute“ und ohne Wert nichts", () => {
    const mixed: StandupGroupView[] = [
      {
        name: "Ben",
        openIssues: [
          { jiraKey: "A-4", summary: "Frisch", issueType: "Story", status: "In Arbeit", url: null, daysInStatus: 0, stale: false },
          { jiraKey: "A-5", summary: "Alt gesynct", issueType: "Story", status: "In Arbeit", url: null, daysInStatus: null, stale: false },
        ],
        doneIssues: [],
      },
    ];
    render(<StandupBoard groups={mixed} />);
    fireEvent.click(screen.getByRole("button", { name: "Standup starten" }));
    expect(screen.getByText("heute")).toBeInTheDocument();
    expect(screen.queryByTestId("status-age-A-5")).not.toBeInTheDocument();
  });

  it("counts down for the active person", () => {
    start();
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByLabelText("Verbleibende Redezeit")).toHaveTextContent("1:57");
  });

  it("goes negative and warns on overrun", () => {
    start();
    act(() => vi.advanceTimersByTime(125_000));
    expect(screen.getByLabelText("Verbleibende Redezeit")).toHaveTextContent("-0:05");
    expect(screen.getByText("Redezeit überzogen")).toBeInTheDocument();
  });

  it("advances to the next person and resets the clock", () => {
    start();
    expect(screen.getByRole("heading", { name: "Zoe" })).toBeInTheDocument(); // gemischte Reihenfolge: Zoe zuerst
    act(() => vi.advanceTimersByTime(10_000));
    fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
    expect(screen.getByRole("heading", { name: "Ben" })).toBeInTheDocument();
    expect(screen.getByLabelText("Verbleibende Redezeit")).toHaveTextContent("2:00");
    expect(screen.getByText("Login bauen")).toBeInTheDocument();
  });

  it("shows a summary with overruns after the last person", () => {
    start();
    act(() => vi.advanceTimersByTime(130_000)); // Zoe überzieht
    fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
    fireEvent.click(screen.getByRole("button", { name: "Fertig" }));
    expect(screen.getByText(/Standup beendet/)).toBeInTheDocument();
    expect(screen.getByText(/überzogen/)).toBeInTheDocument();
  });

  it("advances with the space key", () => {
    start();
    fireEvent.keyDown(window, { code: "Space" });
    expect(screen.getByRole("heading", { name: "Ben" })).toBeInTheDocument();
  });
});
