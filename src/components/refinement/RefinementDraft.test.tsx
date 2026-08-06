import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { RefinementDraft } from "./RefinementDraft";
import type { RefinementTicketView } from "@/lib/view/refinementState";

afterEach(cleanup);

const tickets: RefinementTicketView[] = [
  { id: "t1", jiraKey: "AB-1", summary: "Login", issueType: "Story", description: "", url: null, previousPoints: null, state: "PENDING", finalPoints: null },
];

const handlers = {
  onLoadBacklog: vi.fn(async () => ({
    ok: true,
    data: [
      { jiraKey: "AB-20", summary: "Backlog eins", issueType: "Story", status: "Backlog", description: "", storyPoints: null, url: "https://x.atlassian.net/browse/AB-20" },
      { jiraKey: "AB-21", summary: "Backlog zwei", issueType: "Bug", status: "Backlog", description: "", storyPoints: null, url: "https://x.atlassian.net/browse/AB-21" },
    ],
  })),
  onAdd: vi.fn(),
  onAddMany: vi.fn(async () => {}),
  onRemove: vi.fn(),
  onMove: vi.fn(),
  onStart: vi.fn(),
};

describe("RefinementDraft", () => {
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

  it("zeigt die unbewerteten Backlog-Tickets als Datagrid mit Hinzufügen", async () => {
    render(<RefinementDraft tickets={tickets} isAdmin {...handlers} />);
    await waitFor(() => expect(screen.getByTestId("backlog-grid")).toBeInTheDocument());
    expect(screen.getByText("AB-20")).toBeInTheDocument();
    expect(screen.getByText("Backlog zwei")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "AB-20 hinzufügen" }));
    expect(handlers.onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ jiraKey: "AB-20", summary: "Backlog eins" }),
    );
  });

  it("filtert das Backlog-Datagrid über das Suchfeld", async () => {
    render(<RefinementDraft tickets={tickets} isAdmin {...handlers} />);
    await waitFor(() => expect(screen.getByTestId("backlog-grid")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Backlog filtern"), { target: { value: "zwei" } });
    expect(screen.getByText("AB-21")).toBeInTheDocument();
    expect(screen.queryByText("AB-20")).not.toBeInTheDocument();
    expect(screen.getByText("1 von 2 Tickets")).toBeInTheDocument();
  });

  it("fügt mehrere ausgewählte Backlog-Tickets auf einmal hinzu", async () => {
    render(<RefinementDraft tickets={tickets} isAdmin {...handlers} />);
    await waitFor(() => expect(screen.getByTestId("backlog-grid")).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText("AB-20 auswählen"));
    fireEvent.click(screen.getByLabelText("AB-21 auswählen"));
    fireEvent.click(screen.getByRole("button", { name: "2 ausgewählte hinzufügen" }));
    await waitFor(() =>
      expect(handlers.onAddMany).toHaveBeenCalledWith([
        expect.objectContaining({ jiraKey: "AB-20" }),
        expect.objectContaining({ jiraKey: "AB-21" }),
      ]),
    );
  });

  it("wählt über die Kopf-Checkbox alle Backlog-Tickets aus", async () => {
    render(<RefinementDraft tickets={tickets} isAdmin {...handlers} />);
    await waitFor(() => expect(screen.getByTestId("backlog-grid")).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText("Alle auswählen"));
    expect(screen.getByRole("button", { name: "2 ausgewählte hinzufügen" })).toBeInTheDocument();
  });

  it("sortiert das Backlog-Datagrid per Klick auf den Spaltenkopf", async () => {
    render(<RefinementDraft tickets={tickets} isAdmin {...handlers} />);
    await waitFor(() => expect(screen.getByTestId("backlog-grid")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /^Typ/ }));
    const rows = screen.getAllByRole("row").slice(1); // Kopfzeile überspringen
    expect(rows[0]).toHaveTextContent("AB-21"); // Bug sortiert vor Story
  });

  it("zieht ein Backlog-Ticket per Drag & Drop in die Auswahl", async () => {
    render(<RefinementDraft tickets={tickets} isAdmin {...handlers} />);
    await waitFor(() => expect(screen.getByTestId("backlog-grid")).toBeInTheDocument());
    const ticket = { jiraKey: "AB-20", summary: "Backlog eins", issueType: "Story", status: "Backlog", description: "", storyPoints: null, url: "https://x.atlassian.net/browse/AB-20" };
    fireEvent.drop(screen.getByTestId("selected-panel"), {
      dataTransfer: {
        types: ["application/x-backlog-ticket"],
        getData: (type: string) => (type === "application/x-backlog-ticket" ? JSON.stringify(ticket) : ""),
      },
    });
    expect(handlers.onAdd).toHaveBeenCalledWith(expect.objectContaining({ jiraKey: "AB-20" }));
  });

  it("zieht ein ausgewähltes Ticket per Drag & Drop zurück ins Backlog", async () => {
    render(<RefinementDraft tickets={tickets} isAdmin {...handlers} />);
    await waitFor(() => expect(screen.getByTestId("backlog-grid")).toBeInTheDocument());
    fireEvent.drop(screen.getByTestId("backlog-panel"), {
      dataTransfer: {
        types: ["application/x-selected-ticket"],
        getData: (type: string) => (type === "application/x-selected-ticket" ? "t1" : ""),
      },
    });
    expect(handlers.onRemove).toHaveBeenCalledWith("t1");
  });

  it("verlinkt jedes Backlog-Ticket zu Jira in neuem Tab", async () => {
    render(<RefinementDraft tickets={tickets} isAdmin {...handlers} />);
    await waitFor(() => expect(screen.getByTestId("backlog-grid")).toBeInTheDocument());
    const link = screen.getByRole("link", { name: "AB-20 in Jira öffnen" });
    expect(link).toHaveAttribute("href", "https://x.atlassian.net/browse/AB-20");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("verlinkt ausgewählte Tickets mit URL nach Jira", () => {
    const withUrl: RefinementTicketView[] = [
      { ...tickets[0], url: "https://x.atlassian.net/browse/AB-1" },
    ];
    render(<RefinementDraft tickets={withUrl} isAdmin={false} {...handlers} />);
    const link = screen.getByRole("link", { name: /AB-1/ });
    expect(link).toHaveAttribute("href", "https://x.atlassian.net/browse/AB-1");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("Teilnehmer sehen nur die Warteliste ohne Bedienelemente", () => {
    render(<RefinementDraft tickets={tickets} isAdmin={false} {...handlers} />);
    expect(screen.getByText("AB-1")).toBeInTheDocument();
    expect(screen.queryByTestId("backlog-grid")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Refinement starten" })).not.toBeInTheDocument();
  });
});
