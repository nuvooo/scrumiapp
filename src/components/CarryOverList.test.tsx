import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { CarryOverList, type CarryOverItemView } from "./CarryOverList";

vi.mock("@/app/(app)/planning/actions", () => ({
  saveCarryOverMark: vi.fn(async () => ({ ok: true })),
  moveIssueToPlannedSprint: vi.fn(async () => ({ ok: true })),
  fetchIssueDescription: vi.fn(async () => ({ ok: true, data: "Details aus Jira" })),
}));

window.HTMLElement.prototype.scrollIntoView = vi.fn();

afterEach(cleanup);

const item = (jiraKey: string, over: Partial<CarryOverItemView> = {}): CarryOverItemView => ({
  id: jiraKey,
  jiraKey,
  summary: `Ticket ${jiraKey}`,
  issueType: "Story",
  status: "In Arbeit",
  storyPoints: 5,
  assignee: "Anna",
  url: null,
  takeAlong: false,
  remainingPoints: 5,
  ...over,
});

const renderList = (items = [item("AB-1"), item("AB-2")]) =>
  render(<CarryOverList sprintId="s1" items={items} plannedSprints={[{ id: "sp2", name: "Sprint 2" }]} />);

describe("CarryOverList Durchgeh-Modus", () => {
  it("startet mit dem ersten Ticket und lädt dessen Jira-Beschreibung", async () => {
    renderList();

    fireEvent.click(screen.getByRole("button", { name: /Tickets durchgehen/ }));

    expect(screen.getByText("1 / 2", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Weiter/ })).toBeInTheDocument();
    expect(await screen.findByText("Details aus Jira")).toBeInTheDocument();
  });

  it("geht mit Weiter zum nächsten und mit Zurück wieder hoch", () => {
    renderList();
    fireEvent.click(screen.getByRole("button", { name: /Tickets durchgehen/ }));

    fireEvent.click(screen.getByRole("button", { name: /Weiter/ }));
    expect(screen.getByText("2 / 2", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Weiter/ })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /Zurück/ }));
    expect(screen.getByText("1 / 2", { exact: false })).toBeInTheDocument();
  });

  it("navigiert mit den Pfeiltasten und beendet mit Escape", () => {
    renderList();
    fireEvent.click(screen.getByRole("button", { name: /Tickets durchgehen/ }));

    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(screen.getByText("2 / 2", { exact: false })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByText("2 / 2", { exact: false })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tickets durchgehen/ })).toBeInTheDocument();
  });

  it("zeigt im aktiven Ticket Bearbeiter und Details", () => {
    renderList();
    fireEvent.click(screen.getByRole("button", { name: /Tickets durchgehen/ }));

    expect(screen.getByText("👤 Anna", { exact: false })).toBeInTheDocument();
  });
});
