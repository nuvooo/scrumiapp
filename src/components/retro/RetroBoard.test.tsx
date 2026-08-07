import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { RetroBoard } from "./RetroBoard";
import type { RetroStateView } from "@/lib/view/retroState";

afterEach(cleanup);

const baseState = (over: Partial<RetroStateView> = {}): RetroStateView => ({
  id: "re1",
  name: "Retro Sprint 42",
  hidden: false,
  votesPerUser: 3,
  votesLeft: 2,
  votingOpen: true,
  timerRemainingSec: null,
  sortMode: "default",
  sortOrder: [],
  musicOn: false,
  background: "",
  you: { name: "Ben", avatar: "", isAdmin: false },
  participants: [
    { name: "Anna", avatar: "", isAdmin: true, online: true },
    { name: "Ben", avatar: "", isAdmin: false, online: true },
    { name: "Zoe", avatar: "🦊", isAdmin: false, online: true },
  ],
  columns: [
    {
      id: "c1",
      name: "Lief gut 👍",
      color: "#4CC38A",
      collapsed: false,
      cards: [
        { id: "k1", mine: true, covered: false, author: "Ben", text: "Gutes Pairing", votes: 2, myVotes: 1, comments: [{ id: "m1", author: "Zoe", text: "stimmt!" }] },
        { id: "k2", mine: false, covered: false, author: "Zoe", text: "Deploy lief rund", votes: 5, myVotes: 0, comments: [] },
      ],
    },
    { id: "c2", name: "Geht besser 🤔", color: "#E5484D", collapsed: false, cards: [] },
  ],
  typing: [],
  version: 0,
  ...over,
});

const noop = () => {};
const handlers = {
  onAddCard: noop, onUpdateCard: noop, onDeleteCard: noop,
  onVote: noop, onUnvote: noop,
  onAddComment: noop, onDeleteComment: noop,
  onMerge: noop,
  onAddColumn: noop, onRenameColumn: noop, onSetColumnColor: noop, onReorderColumn: noop,
  onSetColumnCollapsed: noop, onSetSortMode: noop, onDeleteColumn: noop,
  // Ohne API-Key fällt der GIF-Dialog auf die kuratierte Galerie zurück.
  onSearchGifs: async () => ({ ok: false, error: "Kein GIPHY_API_KEY konfiguriert." }),
  onTyping: noop,
};

describe("RetroBoard", () => {
  it("zeigt Spalten mit Karten, Autor und Stimmen", () => {
    render(<RetroBoard state={baseState()} {...handlers} />);
    expect(screen.getByTestId("column-Lief gut 👍")).toBeInTheDocument();
    expect(screen.getByTestId("column-Geht besser 🤔")).toBeInTheDocument();
    expect(screen.getByText("Gutes Pairing")).toBeInTheDocument();
    expect(within(screen.getByTestId("card-k2")).getByText("👍 5")).toBeInTheDocument();
    // Autor mit Avatar aus der Teilnehmerliste
    expect(within(screen.getByTestId("card-k2")).getByText(/🦊 Zoe/)).toBeInTheDocument();
    expect(screen.getByText(/Noch 2 von 3 Stimmen/)).toBeInTheDocument();
  });

  it("legt über das Plus eine neue Karte an", () => {
    const onAddCard = vi.fn();
    render(<RetroBoard state={baseState()} {...handlers} onAddCard={onAddCard} />);
    fireEvent.click(screen.getByRole("button", { name: "Karte in Geht besser 🤔 anlegen" }));
    fireEvent.change(screen.getByLabelText("Neue Karte in Geht besser 🤔"), { target: { value: "Weniger Meetings 🎯" } });
    fireEvent.click(screen.getByRole("button", { name: "Hinzufügen" }));
    expect(onAddCard).toHaveBeenCalledWith("c2", "Weniger Meetings 🎯");
  });

  it("vergibt Stimmen und nimmt eigene zurück", () => {
    const onVote = vi.fn();
    const onUnvote = vi.fn();
    render(<RetroBoard state={baseState()} {...handlers} onVote={onVote} onUnvote={onUnvote} />);
    fireEvent.click(within(screen.getByTestId("card-k2")).getByRole("button", { name: "Stimme geben" }));
    expect(onVote).toHaveBeenCalledWith("k2");
    // Zurücknehmen nur bei eigenen Stimmen (k1 hat myVotes=1, k2 nicht)
    expect(within(screen.getByTestId("card-k1")).getByRole("button", { name: "Stimme zurücknehmen" })).toBeInTheDocument();
    expect(within(screen.getByTestId("card-k2")).queryByRole("button", { name: "Stimme zurücknehmen" })).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByTestId("card-k1")).getByRole("button", { name: "Stimme zurücknehmen" }));
    expect(onUnvote).toHaveBeenCalledWith("k1");
  });

  it("ohne restliche Stimmen ist Voten gesperrt", () => {
    render(<RetroBoard state={baseState({ votesLeft: 0 })} {...handlers} />);
    expect(within(screen.getByTestId("card-k2")).getByRole("button", { name: "Stimme geben" })).toBeDisabled();
  });

  it("vor der Freigabe durch den Moderator ist das Voting komplett gesperrt", () => {
    render(<RetroBoard state={baseState({ votingOpen: false })} {...handlers} />);
    expect(screen.getByText("🗳️ Voting noch nicht freigegeben")).toBeInTheDocument();
    expect(within(screen.getByTestId("card-k2")).getByRole("button", { name: "Stimme geben" })).toBeDisabled();
    expect(within(screen.getByTestId("card-k1")).getByRole("button", { name: "Stimme zurücknehmen" })).toBeDisabled();
  });

  it("verdeckte fremde Karten zeigen eine geblurte Vorschau ohne Autor", () => {
    const covered = baseState({
      hidden: true,
      columns: [
        {
          id: "c1", name: "Lief gut 👍", color: "#4CC38A", collapsed: false,
          cards: [
            { id: "k1", mine: true, covered: false, author: "Ben", text: "Meine Karte", votes: 0, myVotes: 0, comments: [] },
            { id: "k2", mine: false, covered: true, author: "", text: "Geheimer Text 🤫", votes: 0, myVotes: 0, comments: [] },
          ],
        },
      ],
    });
    render(<RetroBoard state={covered} {...handlers} />);
    expect(screen.getByText("Meine Karte")).toBeInTheDocument();
    // Inhalt steckt in der geblurten, nicht interagierbaren Vorschau
    const preview = within(screen.getByTestId("card-k2")).getByTestId("covered-k2");
    expect(preview).toHaveTextContent("Geheimer Text 🤫");
    expect(preview).toHaveClass("blur-[7px]");
    expect(preview).toHaveAttribute("aria-hidden", "true");
    expect(within(screen.getByTestId("card-k2")).getByText(/🙈/)).toBeInTheDocument();
    // Verdeckt = anonym: kein Autor, keine Bearbeiten-/Vote-Knöpfe
    expect(within(screen.getByTestId("card-k2")).queryByText(/✍️/)).not.toBeInTheDocument();
    expect(within(screen.getByTestId("card-k2")).queryByRole("button", { name: "Stimme geben" })).not.toBeInTheDocument();
  });

  it("nur eigene Karten (oder Moderator) lassen sich bearbeiten", () => {
    const onUpdateCard = vi.fn();
    render(<RetroBoard state={baseState()} {...handlers} onUpdateCard={onUpdateCard} />);
    expect(within(screen.getByTestId("card-k2")).queryByRole("button", { name: "Karte bearbeiten" })).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByTestId("card-k1")).getByRole("button", { name: "Karte bearbeiten" }));
    fireEvent.change(screen.getByLabelText("Karte bearbeiten"), { target: { value: "Noch besseres Pairing" } });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    expect(onUpdateCard).toHaveBeenCalledWith("k1", "Noch besseres Pairing");
  });

  it("kommentiert eine Karte", () => {
    const onAddComment = vi.fn();
    render(<RetroBoard state={baseState()} {...handlers} onAddComment={onAddComment} />);
    fireEvent.click(within(screen.getByTestId("card-k1")).getByRole("button", { name: "Kommentare" }));
    expect(screen.getByText("stimmt!")).toBeInTheDocument();
    // Zoes Kommentar gehört nicht Ben → kein Löschen-Knopf
    expect(within(screen.getByTestId("card-k1")).queryByRole("button", { name: "Kommentar löschen" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Kommentar schreiben"), { target: { value: "Sehe ich auch so" } });
    fireEvent.click(within(screen.getByTestId("card-k1")).getByRole("button", { name: "OK" }));
    expect(onAddComment).toHaveBeenCalledWith("k1", "Sehe ich auch so");
  });

  it("sortiert nach Stimmen, wenn der Moderator das festgelegt hat", () => {
    render(<RetroBoard state={baseState({ sortMode: "votes" })} {...handlers} />);
    const column = screen.getByTestId("column-Lief gut 👍");
    const cards = within(column).getAllByTestId(/^card-/);
    expect(cards[0]).toHaveAttribute("data-testid", "card-k2"); // 5 Stimmen vor 2
    // Teilnehmer sehen die Sortierung nur als Text, ohne Auswahl
    expect(screen.getByText(/Sortierung: Nach Stimmen/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Sortierung")).not.toBeInTheDocument();
  });

  it("der Moderator ändert die Sortierung für alle", () => {
    const onSetSortMode = vi.fn();
    const admin = baseState({ you: { name: "Anna", avatar: "", isAdmin: true } });
    render(<RetroBoard state={admin} {...handlers} onSetSortMode={onSetSortMode} />);
    fireEvent.change(screen.getByLabelText("Sortierung"), { target: { value: "author" } });
    expect(onSetSortMode).toHaveBeenCalledWith("author");
  });

  it("sortiert nach Ersteller (A–Z)", () => {
    const withAuthors = baseState({
      sortMode: "author",
      columns: [
        {
          id: "c1", name: "Lief gut 👍", color: "#4CC38A", collapsed: false,
          cards: [
            { id: "k1", mine: false, covered: false, author: "Zoe", text: "Z-Karte", votes: 0, myVotes: 0, comments: [] },
            { id: "k2", mine: false, covered: false, author: "Anna", text: "A-Karte", votes: 0, myVotes: 0, comments: [] },
          ],
        },
      ],
    });
    render(<RetroBoard state={withAuthors} {...handlers} />);
    const cards = within(screen.getByTestId("column-Lief gut 👍")).getAllByTestId(/^card-/);
    expect(cards[0]).toHaveAttribute("data-testid", "card-k2"); // Anna vor Zoe
  });

  it("Ersteller-Pakete folgen der geteilten Server-Reihenfolge", () => {
    const mixed = baseState({
      sortMode: "shuffle",
      sortOrder: ["Zoe", "Anna"],
      you: { name: "Anna", avatar: "", isAdmin: true },
      columns: [
        {
          id: "c1", name: "Lief gut 👍", color: "#4CC38A", collapsed: false,
          cards: [
            { id: "k1", mine: false, covered: false, author: "Zoe", text: "Z1", votes: 0, myVotes: 0, comments: [] },
            { id: "k2", mine: false, covered: false, author: "Anna", text: "A1", votes: 0, myVotes: 0, comments: [] },
            { id: "k3", mine: false, covered: false, author: "Zoe", text: "Z2", votes: 0, myVotes: 0, comments: [] },
          ],
        },
      ],
    });
    const onSetSortMode = vi.fn();
    render(<RetroBoard state={mixed} {...handlers} onSetSortMode={onSetSortMode} />);
    const order = within(screen.getByTestId("column-Lief gut 👍"))
      .getAllByTestId(/^card-/)
      .map((c) => c.getAttribute("data-testid"));
    expect(order).toEqual(["card-k1", "card-k3", "card-k2"]); // Zoe-Paket vor Anna
    // Neu mischen setzt shuffle erneut (Server mischt neu, für alle)
    fireEvent.click(screen.getByRole("button", { name: "🎲 Neu mischen" }));
    expect(onSetSortMode).toHaveBeenCalledWith("shuffle");
  });

  it("der Moderator blendet Spalten aus und wieder ein", () => {
    const onSetColumnCollapsed = vi.fn();
    const admin = baseState({ you: { name: "Anna", avatar: "", isAdmin: true } });
    const { unmount } = render(<RetroBoard state={admin} {...handlers} onSetColumnCollapsed={onSetColumnCollapsed} />);
    fireEvent.click(screen.getByRole("button", { name: "Spalte Lief gut 👍 ausblenden" }));
    expect(onSetColumnCollapsed).toHaveBeenCalledWith("c1", true);
    unmount();

    // Eingeklappt: schmale Leiste ohne Karten; Moderator kann wieder einblenden
    const collapsed = baseState({
      you: { name: "Anna", avatar: "", isAdmin: true },
      columns: [
        { id: "c1", name: "Lief gut 👍", color: "#4CC38A", collapsed: true,
          cards: [{ id: "k1", mine: false, covered: false, author: "Zoe", text: "Versteckt", votes: 0, myVotes: 0, comments: [] }] },
      ],
    });
    onSetColumnCollapsed.mockClear();
    render(<RetroBoard state={collapsed} {...handlers} onSetColumnCollapsed={onSetColumnCollapsed} />);
    expect(screen.queryByText("Versteckt")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Spalte Lief gut 👍 einblenden" }));
    expect(onSetColumnCollapsed).toHaveBeenCalledWith("c1", false);
  });

  it("Teilnehmer sehen eingeklappte Spalten nur als Leiste ohne Knöpfe", () => {
    const collapsed = baseState({
      columns: [
        { id: "c1", name: "Lief gut 👍", color: "#4CC38A", collapsed: true,
          cards: [{ id: "k1", mine: false, covered: false, author: "Zoe", text: "Versteckt", votes: 0, myVotes: 0, comments: [] }] },
      ],
    });
    render(<RetroBoard state={collapsed} {...handlers} />);
    expect(screen.queryByText("Versteckt")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Spalte Lief gut 👍 einblenden" })).not.toBeInTheDocument();
  });

  it("das Plus steht unter dem letzten Post, der Composer öffnet dort", () => {
    render(<RetroBoard state={baseState()} {...handlers} />);
    const column = screen.getByTestId("column-Lief gut 👍");
    const plus = within(column).getByRole("button", { name: "Karte in Lief gut 👍 anlegen" });
    const lastCard = within(column).getAllByTestId(/^card-/).at(-1)!;
    // Plus kommt im DOM nach der letzten Karte
    expect(lastCard.compareDocumentPosition(plus) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Composer ersetzt das Plus an gleicher Stelle
    fireEvent.click(plus);
    expect(within(column).queryByRole("button", { name: "Karte in Lief gut 👍 anlegen" })).not.toBeInTheDocument();
    const textarea = within(column).getByLabelText("Neue Karte in Lief gut 👍");
    expect(lastCard.compareDocumentPosition(textarea) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("Mergen darf jeder Teilnehmer — mit Bestätigungs-Dialog", () => {
    const onMerge = vi.fn();
    // Ben ist normaler Teilnehmer, kein Moderator
    render(<RetroBoard state={baseState()} {...handlers} onMerge={onMerge} />);
    const drop = () =>
      fireEvent.drop(screen.getByTestId("card-k2"), {
        dataTransfer: {
          types: ["application/x-retro-card"],
          getData: (type: string) => (type === "application/x-retro-card" ? "k1" : ""),
        },
      });

    // Abbrechen: kein Merge — der Dialog fragt nur, ohne Karteninhalte zu zeigen
    drop();
    const dialog = screen.getByRole("dialog", { name: "Karten zusammenführen" });
    expect(within(dialog).getByText("Karten wirklich zusammenführen?")).toBeInTheDocument();
    expect(within(dialog).queryByText("Gutes Pairing")).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Abbrechen" }));
    expect(onMerge).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Bestätigen: Merge läuft
    drop();
    fireEvent.click(screen.getByRole("button", { name: "Zusammenführen" }));
    expect(onMerge).toHaveBeenCalledWith("k1", "k2");
  });

  it("der Moderator sortiert Spalten per Drag & Drop um", () => {
    const onReorderColumn = vi.fn();
    const admin = baseState({ you: { name: "Anna", avatar: "", isAdmin: true } });
    render(<RetroBoard state={admin} {...handlers} onReorderColumn={onReorderColumn} />);
    fireEvent.drop(screen.getByTestId("column-Geht besser 🤔"), {
      dataTransfer: {
        types: ["application/x-retro-column"],
        getData: (type: string) => (type === "application/x-retro-column" ? "c1" : ""),
      },
    });
    expect(onReorderColumn).toHaveBeenCalledWith("c1", "c2");
  });

  it("Spalten-Werkzeuge nur für den Moderator", () => {
    const { unmount } = render(<RetroBoard state={baseState()} {...handlers} />);
    expect(screen.queryByRole("button", { name: "Spalte Lief gut 👍 umbenennen" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+ Spalte" })).not.toBeInTheDocument();
    unmount();

    const onRenameColumn = vi.fn();
    const admin = baseState({ you: { name: "Anna", avatar: "", isAdmin: true } });
    render(<RetroBoard state={admin} {...handlers} onRenameColumn={onRenameColumn} />);
    fireEvent.click(screen.getByRole("button", { name: "Spalte Lief gut 👍 umbenennen" }));
    fireEvent.change(screen.getByLabelText("Spaltenname"), { target: { value: "Highlights" } });
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(onRenameColumn).toHaveBeenCalledWith("c1", "Highlights");
  });

  it("der Moderator legt neue Spalten mit Farbe an", () => {
    const onAddColumn = vi.fn();
    const admin = baseState({ you: { name: "Anna", avatar: "", isAdmin: true } });
    render(<RetroBoard state={admin} {...handlers} onAddColumn={onAddColumn} />);
    fireEvent.click(screen.getByRole("button", { name: "+ Spalte" }));
    fireEvent.change(screen.getByLabelText("Name der neuen Spalte"), { target: { value: "Aktionen" } });
    fireEvent.click(screen.getByRole("button", { name: "Neue Spalte in #E5484D" }));
    fireEvent.click(screen.getByRole("button", { name: "Anlegen" }));
    expect(onAddColumn).toHaveBeenCalledWith("Aktionen", "#E5484D");
  });

  it("fügt Emojis über die Auswahl in die Karte ein", () => {
    const onAddCard = vi.fn();
    render(<RetroBoard state={baseState()} {...handlers} onAddCard={onAddCard} />);
    fireEvent.click(screen.getByRole("button", { name: "Karte in Geht besser 🤔 anlegen" }));
    fireEvent.change(screen.getByLabelText("Neue Karte in Geht besser 🤔"), { target: { value: "Super Sprint" } });
    fireEvent.click(screen.getByRole("button", { name: "Emoji auswählen" }));
    fireEvent.click(screen.getByRole("button", { name: "Emoji 🎉" }));
    fireEvent.click(screen.getByRole("button", { name: "Hinzufügen" }));
    expect(onAddCard).toHaveBeenCalledWith("c2", "Super Sprint🎉");
  });

  it("fügt ein GIF aus der Fallback-Galerie in die Karte ein (ohne API-Key)", async () => {
    const onAddCard = vi.fn();
    render(<RetroBoard state={baseState()} {...handlers} onAddCard={onAddCard} />);
    fireEvent.click(screen.getByRole("button", { name: "Karte in Geht besser 🤔 anlegen" }));
    fireEvent.click(screen.getByRole("button", { name: "GIF auswählen" }));
    fireEvent.click(await screen.findByRole("button", { name: "GIF 1 einfügen" }));
    // Das GIF erscheint als Vorschau, nicht als URL im Textfeld
    const textarea = screen.getByLabelText("Neue Karte in Geht besser 🤔") as HTMLTextAreaElement;
    expect(textarea.value).not.toContain("http");
    expect(screen.getByAltText("Angehängtes GIF 1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hinzufügen" }));
    expect(onAddCard).toHaveBeenCalledWith("c2", expect.stringContaining("giphy.gif"));
  });

  it("angehängte GIFs lassen sich vor dem Absenden wieder entfernen", async () => {
    const onAddCard = vi.fn();
    render(<RetroBoard state={baseState()} {...handlers} onAddCard={onAddCard} />);
    fireEvent.click(screen.getByRole("button", { name: "Karte in Geht besser 🤔 anlegen" }));
    fireEvent.click(screen.getByRole("button", { name: "GIF auswählen" }));
    fireEvent.click(await screen.findByRole("button", { name: "GIF 1 einfügen" }));
    fireEvent.click(screen.getByRole("button", { name: "Angehängtes GIF 1 entfernen" }));
    expect(screen.queryByAltText("Angehängtes GIF 1")).not.toBeInTheDocument();
    // Ohne Text und ohne GIF wird nichts abgeschickt
    fireEvent.click(screen.getByRole("button", { name: "Hinzufügen" }));
    expect(onAddCard).not.toHaveBeenCalled();
  });

  it("mit API-Key zeigt der GIF-Dialog die Giphy-Suche", async () => {
    const onAddCard = vi.fn();
    const onSearchGifs = vi.fn(async () => ({
      ok: true,
      data: [{ url: "https://media0.giphy.com/media/abc/200.gif?cid=1", preview: "https://media0.giphy.com/media/abc/200_s.gif" }],
    }));
    render(<RetroBoard state={baseState()} {...handlers} onSearchGifs={onSearchGifs} onAddCard={onAddCard} />);
    fireEvent.click(screen.getByRole("button", { name: "Karte in Geht besser 🤔 anlegen" }));
    fireEvent.click(screen.getByRole("button", { name: "GIF auswählen" }));
    expect(await screen.findByLabelText("GIFs durchsuchen")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "GIF 1 einfügen" }));
    fireEvent.click(screen.getByRole("button", { name: "Hinzufügen" }));
    expect(onSearchGifs).toHaveBeenCalledWith("");
    expect(onAddCard).toHaveBeenCalledWith("c2", "https://media0.giphy.com/media/abc/200.gif?cid=1");
  });

  it("zeigt Geister-Karten, wenn jemand schreibt — anonym im Verdeckt-Modus", () => {
    const { unmount } = render(
      <RetroBoard
        state={baseState({
          typing: [
            { columnId: "c1", name: "Zoe", mine: false },
            { columnId: "c2", name: "", mine: false }, // verdeckt = anonym
            { columnId: "c1", name: "Ben", mine: true }, // man selbst: keine Geister-Karte
          ],
        })}
        {...handlers}
      />,
    );
    expect(screen.getByText("✍️ Zoe schreibt…")).toBeInTheDocument();
    expect(screen.getByText("✍️ Jemand schreibt…")).toBeInTheDocument();
    expect(screen.queryByText("✍️ Ben schreibt…")).not.toBeInTheDocument();
    unmount();
  });

  it("meldet Schreiben beim Öffnen und Schließen des Composers", () => {
    const onTyping = vi.fn();
    render(<RetroBoard state={baseState()} {...handlers} onTyping={onTyping} />);
    fireEvent.click(screen.getByRole("button", { name: "Karte in Geht besser 🤔 anlegen" }));
    expect(onTyping).toHaveBeenCalledWith("c2");
    fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
    expect(onTyping).toHaveBeenCalledWith(null);
  });

  it("rendert GIF-URLs in Karten als Bild", () => {
    const withGif = baseState({
      columns: [
        {
          id: "c1", name: "Lief gut 👍", color: "#4CC38A", collapsed: false,
          cards: [{ id: "k1", mine: true, covered: false, author: "Ben", text: "https://media.giphy.com/x/giphy.gif", votes: 0, myVotes: 0, comments: [] }],
        },
      ],
    });
    render(<RetroBoard state={withGif} {...handlers} />);
    const img = within(screen.getByTestId("card-k1")).getByRole("presentation");
    expect(img).toHaveAttribute("src", "https://media.giphy.com/x/giphy.gif");
  });
});
