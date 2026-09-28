import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BacklogTable, filterBacklog } from "./BacklogTable";
import type { JiraSearchResult } from "@/lib/jira/jiraClient";

const ticket = (jiraKey: string, extra: Partial<JiraSearchResult> = {}): JiraSearchResult => ({
  jiraKey,
  summary: `Ticket ${jiraKey}`,
  issueType: "Story",
  status: "Backlog",
  statusCategory: "new",
  description: "",
  storyPoints: null,
  url: `https://x.atlassian.net/browse/${jiraKey}`,
  parent: null,
  labels: [],
  components: [],
  ...extra,
});

const rows = [
  ticket("AB-1", { parent: "AB-100 · Checkout", labels: ["web"], components: ["Frontend"] }),
  ticket("AB-2", { issueType: "Bug", status: "To Do", parent: "AB-100 · Checkout" }),
  ticket("AB-3", { labels: ["api"], components: ["Backend"] }),
];

describe("filterBacklog", () => {
  it("combines facets with AND", () => {
    expect(filterBacklog(rows, { parent: "AB-100 · Checkout", issueType: "Story" }).map((r) => r.jiraKey)).toEqual(["AB-1"]);
  });

  it("finds tickets without an epic", () => {
    expect(filterBacklog(rows, { parent: "__none__" }).map((r) => r.jiraKey)).toEqual(["AB-3"]);
  });
});

describe("BacklogTable filters", () => {
  it("filters by the chosen label and can be reset", () => {
    render(<BacklogTable rows={rows} addedKeys={new Set()} onAdd={vi.fn()} onAddMany={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Nach Label filtern"), { target: { value: "api" } });
    expect(screen.queryByText("Ticket AB-1")).toBeNull();
    expect(screen.getByText("Ticket AB-3")).toBeTruthy();
    expect(screen.getByText("1 von 3 Tickets")).toBeTruthy();

    fireEvent.click(screen.getByText("Filter zurücksetzen"));
    expect(screen.getByText("Ticket AB-1")).toBeTruthy();
  });
});
