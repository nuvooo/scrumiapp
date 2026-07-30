import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { PlanningList, type PlanningIssueView } from "./PlanningList";

afterEach(cleanup);

const issues: PlanningIssueView[] = [
  { id: "1", jiraKey: "AB-1", summary: "Login bauen", issueType: "Story", status: "To Do", storyPoints: 5, url: null },
  { id: "2", jiraKey: "AB-2", summary: "Suche bauen", issueType: "Story", status: "To Do", storyPoints: 0, url: null },
  { id: "3", jiraKey: "AB-3", summary: "Export bauen", issueType: "Story", status: "To Do", storyPoints: 0, url: null },
];

describe("PlanningList", () => {
  it("zeigt unbewertete Tickets zuerst und markiert sie", () => {
    render(<PlanningList issues={issues} />);
    const cards = screen.getAllByTestId(/planning-card-/);
    expect(cards[0]).toHaveTextContent("AB-2");
    expect(cards[2]).toHaveTextContent("AB-1");
    expect(screen.getAllByText("ohne Schätzung")).toHaveLength(2);
    expect(screen.getByText("5 SP")).toBeInTheDocument();
  });

  it("zeigt einen Hinweis ohne Tickets", () => {
    render(<PlanningList issues={[]} />);
    expect(screen.getByText("Keine offenen Tickets im geplanten Sprint.")).toBeInTheDocument();
  });
});
