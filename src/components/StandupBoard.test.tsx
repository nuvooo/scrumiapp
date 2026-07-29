import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { StandupBoard, type StandupGroupView } from "./StandupBoard";

const groups: StandupGroupView[] = [
  {
    name: "Ben",
    openIssues: [{ jiraKey: "A-1", summary: "Login bauen", issueType: "Story", status: "In Arbeit" }],
    doneIssues: [],
  },
  {
    name: "Zoe",
    openIssues: [],
    doneIssues: [{ jiraKey: "A-2", summary: "Bug fixen", issueType: "Bug", status: "Geschlossen" }],
  },
];

const columns = [
  { name: "Offen", statuses: ["Open"] },
  { name: "In Arbeit", statuses: ["In Arbeit"] },
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
    render(<StandupBoard groups={groups} columns={columns} />);
    fireEvent.click(screen.getByRole("button", { name: "Standup starten" }));
  }

  it("shows a setup screen with participants and speaking time", () => {
    render(<StandupBoard groups={groups} columns={columns} />);
    expect(screen.getByText(/2 Teilnehmer/)).toBeInTheDocument();
    expect(screen.getByLabelText("Redezeit pro Person")).toHaveValue("2:00");
  });

  it("renders the board columns like Jira and sorts tickets into them", () => {
    start();
    fireEvent.click(screen.getByRole("button", { name: "Weiter" })); // zu Ben
    const inArbeit = screen.getByTestId("standup-col-In Arbeit");
    expect(inArbeit).toHaveTextContent("Login bauen");
    expect(screen.getByTestId("standup-col-Offen")).not.toHaveTextContent("Login bauen");
  });

  it("shows done tickets in a trailing Erledigt column", () => {
    start(); // Zoe zuerst
    expect(screen.getByTestId("standup-col-Erledigt")).toHaveTextContent("Bug fixen");
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
