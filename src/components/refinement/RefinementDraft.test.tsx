import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { RefinementDraft } from "./RefinementDraft";
import type { RefinementTicketView } from "@/lib/view/refinementState";

afterEach(cleanup);

const tickets: RefinementTicketView[] = [
  { id: "t1", jiraKey: "AB-1", summary: "Login", issueType: "Story", description: "", url: null, previousPoints: null, state: "PENDING", finalPoints: null },
];

const handlers = {
  onSearch: vi.fn(async () => ({
    ok: true,
    data: [{ jiraKey: "AB-9", summary: "Neu", issueType: "Story", status: "Backlog", description: "", storyPoints: null }],
  })),
  onLoadBacklog: vi.fn(async () => ({
    ok: true,
    data: [
      { jiraKey: "AB-20", summary: "Backlog eins", issueType: "Story", status: "Backlog", description: "", storyPoints: null },
      { jiraKey: "AB-21", summary: "Backlog zwei", issueType: "Bug", status: "Backlog", description: "", storyPoints: null },
    ],
  })),
  onAdd: vi.fn(),
  onRemove: vi.fn(),
  onMove: vi.fn(),
  onStart: vi.fn(),
};

describe("RefinementDraft", () => {
  it("sucht in Jira und fügt Treffer hinzu", async () => {
    render(<RefinementDraft tickets={tickets} isAdmin {...handlers} />);
    fireEvent.change(screen.getByLabelText("Jira durchsuchen"), { target: { value: "neu" } });
    fireEvent.click(screen.getByRole("button", { name: "Suchen" }));
    await waitFor(() => expect(screen.getByText("AB-9")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "AB-9 hinzufügen" }));
    expect(handlers.onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ jiraKey: "AB-9", summary: "Neu" }),
    );
  });

  it("listet ausgewählte Tickets mit Entfernen und Verschieben", () => {
    render(<RefinementDraft tickets={tickets} isAdmin {...handlers} />);
    expect(screen.getByText("AB-1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "AB-1 entfernen" }));
    expect(handlers.onRemove).toHaveBeenCalledWith("t1");
    fireEvent.click(screen.getByRole("button", { name: "AB-1 nach unten" }));
    expect(handlers.onMove).toHaveBeenCalledWith("t1", "down");
  });

  it("startet das Refinement", () => {
    render(<RefinementDraft tickets={tickets} isAdmin {...handlers} />);
    fireEvent.click(screen.getByRole("button", { name: "Refinement starten" }));
    expect(handlers.onStart).toHaveBeenCalled();
  });

  it("zeigt die unbewerteten Backlog-Tickets als Grid mit Hinzufügen", async () => {
    render(<RefinementDraft tickets={tickets} isAdmin {...handlers} />);
    await waitFor(() => expect(screen.getByTestId("backlog-grid")).toBeInTheDocument());
    expect(screen.getByText("AB-20")).toBeInTheDocument();
    expect(screen.getByText("Backlog zwei")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "AB-20 hinzufügen" }));
    expect(handlers.onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ jiraKey: "AB-20", summary: "Backlog eins" }),
    );
  });

  it("Teilnehmer sehen nur die Warteliste ohne Bedienelemente", () => {
    render(<RefinementDraft tickets={tickets} isAdmin={false} {...handlers} />);
    expect(screen.getByText("AB-1")).toBeInTheDocument();
    expect(screen.queryByLabelText("Jira durchsuchen")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Refinement starten" })).not.toBeInTheDocument();
  });
});
