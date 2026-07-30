import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

const estimateIssue = vi.fn();
vi.mock("@/app/(app)/planning/actions", () => ({
  estimateIssue: (...args: unknown[]) => estimateIssue(...args),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { PlanningList, type PlanningIssueView } from "./PlanningList";

const issues: PlanningIssueView[] = [
  { id: "1", jiraKey: "AB-1", summary: "Login bauen", issueType: "Story", status: "To Do", storyPoints: 5, url: null },
  { id: "2", jiraKey: "AB-2", summary: "Suche bauen", issueType: "Story", status: "To Do", storyPoints: 0, url: null },
  { id: "3", jiraKey: "AB-3", summary: "Export bauen", issueType: "Story", status: "To Do", storyPoints: 0, url: null },
];

beforeEach(() => estimateIssue.mockReset().mockResolvedValue({ ok: true }));
afterEach(cleanup);

describe("PlanningList", () => {
  it("zeigt unbewertete Tickets zuerst und markiert sie", () => {
    render(<PlanningList issues={issues} />);
    const cards = screen.getAllByTestId(/planning-card-/);
    expect(cards[0]).toHaveTextContent("AB-2");
    expect(cards[2]).toHaveTextContent("AB-1");
    expect(screen.getAllByText("ohne Schätzung")).toHaveLength(2);
    expect(screen.getByText("5 SP")).toBeInTheDocument();
  });

  it("übernimmt eine Poker-Karte und ruft die Action", async () => {
    render(<PlanningList issues={issues} />);
    fireEvent.click(screen.getByRole("button", { name: "AB-2 schätzen" }));
    fireEvent.click(screen.getByRole("button", { name: "5 Punkte" }));
    fireEvent.click(screen.getByRole("button", { name: "Übernehmen" }));
    await waitFor(() => expect(estimateIssue).toHaveBeenCalledWith("AB-2", 5));
  });

  it("springt nach dem Übernehmen zum nächsten unbewerteten Ticket", async () => {
    render(<PlanningList issues={issues} />);
    fireEvent.click(screen.getByRole("button", { name: "AB-2 schätzen" }));
    fireEvent.click(screen.getByRole("button", { name: "3 Punkte" }));
    fireEvent.click(screen.getByRole("button", { name: "Übernehmen" }));
    await waitFor(() => expect(screen.getByTestId("poker-overlay")).toHaveTextContent("AB-3"));
  });

  it("zeigt den Fehler der Action im Overlay", async () => {
    estimateIssue.mockResolvedValue({ ok: false, error: "Jira request failed: 403" });
    render(<PlanningList issues={issues} />);
    fireEvent.click(screen.getByRole("button", { name: "AB-2 schätzen" }));
    fireEvent.click(screen.getByRole("button", { name: "8 Punkte" }));
    fireEvent.click(screen.getByRole("button", { name: "Übernehmen" }));
    await waitFor(() => expect(screen.getByTestId("poker-overlay")).toHaveTextContent("403"));
    expect(screen.getByTestId("poker-overlay")).toHaveTextContent("AB-2"); // bleibt stehen
  });

  it("Escape schließt das Overlay ohne zu schreiben", () => {
    render(<PlanningList issues={issues} />);
    fireEvent.click(screen.getByRole("button", { name: "AB-2 schätzen" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("poker-overlay")).not.toBeInTheDocument();
    expect(estimateIssue).not.toHaveBeenCalled();
  });
});
