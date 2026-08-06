"use client";

import { useState } from "react";
import { cardSegments } from "@/lib/retroCardText";
import { EmojiGifPicker, type GifSearch } from "./EmojiGifPicker";
import {
  RETRO_COLORS,
  type RetroCardView,
  type RetroColumnView,
  type RetroStateView,
} from "@/lib/view/retroState";

const CARD_DRAG_TYPE = "application/x-retro-card";
const COLUMN_DRAG_TYPE = "application/x-retro-column";

/** Kartentext in Freitext und angehängte Bild-URLs zerlegen (fürs Bearbeiten). */
function splitCardText(text: string): { text: string; gifs: string[] } {
  const segments = cardSegments(text);
  return {
    text: segments.filter((s) => s.kind === "text").map((s) => (s.kind === "text" ? s.value : "")).join("\n"),
    gifs: segments.filter((s) => s.kind === "image").map((s) => (s.kind === "image" ? s.url : "")),
  };
}

/** Freitext + angehängte GIFs wieder zu einem Kartentext zusammensetzen. */
function joinCardText(text: string, gifs: string[]): string {
  return [text.trim(), ...gifs].filter(Boolean).join("\n");
}

/** Vorschau der angehängten GIFs unter dem Eingabefeld, einzeln entfernbar. */
function GifAttachments({ gifs, onRemove }: { gifs: string[]; onRemove: (index: number) => void }) {
  if (gifs.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {gifs.map((url, i) => (
        <span key={`${url}-${i}`} className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={`Angehängtes GIF ${i + 1}`} className="h-[64px] rounded-[7px] border border-edge object-cover" />
          <button
            type="button"
            aria-label={`Angehängtes GIF ${i + 1} entfernen`}
            title="GIF entfernen"
            onClick={() => onRemove(i)}
            className="absolute -right-1.5 -top-1.5 flex h-[18px] w-[18px] items-center justify-center rounded-full border border-edge bg-field text-[10px] leading-none text-fg hover:text-danger"
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
}

/** Kartentext mit Inline-Bildern (GIFs) rendern. */
function CardText({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      {cardSegments(text).map((seg, i) =>
        seg.kind === "text" ? (
          <p key={i} className="whitespace-pre-line leading-relaxed">{seg.value}</p>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={seg.url} alt="" className="max-h-[180px] w-auto max-w-full rounded-[8px] object-contain" />
        ),
      )}
    </div>
  );
}

function Card({
  card,
  color,
  isAdmin,
  youName,
  votesLeft,
  searchGifs,
  onUpdate,
  onDelete,
  onVote,
  onUnvote,
  onAddComment,
  onDeleteComment,
  onMerge,
}: {
  card: RetroCardView;
  color: string;
  isAdmin: boolean;
  youName: string;
  votesLeft: number;
  searchGifs: GifSearch;
  onUpdate: (text: string) => void;
  onDelete: () => void;
  onVote: () => void;
  onUnvote: () => void;
  onAddComment: (text: string) => void;
  onDeleteComment: (commentId: string) => void;
  onMerge: (sourceId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [editGifs, setEditGifs] = useState<string[]>([]);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const canEdit = card.mine || isAdmin;

  const saveEdit = () => {
    const combined = joinCardText(editText, editGifs);
    if (!combined) return;
    onUpdate(combined);
    setEditing(false);
  };

  const submitComment = () => {
    if (!commentText.trim()) return;
    onAddComment(commentText);
    setCommentText("");
  };

  return (
    <div
      data-testid={`card-${card.id}`}
      draggable={isAdmin && !card.covered}
      onDragStart={(e) => {
        e.dataTransfer.setData(CARD_DRAG_TYPE, card.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(e) => {
        if (!isAdmin || !e.dataTransfer.types.includes(CARD_DRAG_TYPE)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        setDragOver(false);
        const sourceId = e.dataTransfer.getData(CARD_DRAG_TYPE);
        if (!sourceId || sourceId === card.id) return;
        e.preventDefault();
        e.stopPropagation();
        onMerge(sourceId);
      }}
      className={`rounded-[10px] border border-edge bg-field p-2.5 text-[13px] text-fg ${
        dragOver ? "ring-2 ring-[#6e8ff6]" : ""
      } ${isAdmin && !card.covered ? "cursor-grab" : ""}`}
      style={{ borderLeft: `3px solid ${color}` }}
    >
      {card.covered ? (
        <div className="select-none py-1 text-center text-[13px] tracking-[0.3em] text-dim" title="Noch verdeckt">
          🙈 ▪▪▪▪▪
        </div>
      ) : editing ? (
        <div className="flex flex-col gap-2">
          <textarea
            aria-label="Karte bearbeiten"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={3}
            className="input-field resize-y text-[13px]"
          />
          <GifAttachments gifs={editGifs} onRemove={(i) => setEditGifs((g) => g.filter((_, j) => j !== i))} />
          <div className="flex items-center gap-1.5">
            <EmojiGifPicker
              searchGifs={searchGifs}
              onInsert={(s) =>
                s.startsWith("http") ? setEditGifs((g) => [...g, s]) : setEditText((t) => t + s)
              }
            />
            <button type="button" onClick={saveEdit} className="btn-primary ml-auto px-3 py-1.5">Speichern</button>
            <button type="button" onClick={() => setEditing(false)} className="btn-secondary px-3 py-1.5">Abbrechen</button>
          </div>
        </div>
      ) : (
        <>
          <CardText text={card.text} />
          {card.author && (
            <div className="mt-1.5 text-[11px] font-medium text-dim" title="Autor der Karte">
              ✍️ {card.author}
            </div>
          )}
          <div className="mt-2 flex items-center gap-1.5">
            {/* Stimmen */}
            <span className={`font-mono text-[11.5px] ${card.votes > 0 ? "text-fg" : "text-dim"}`}>👍 {card.votes}</span>
            <button
              type="button"
              aria-label="Stimme geben"
              title={votesLeft > 0 ? "Stimme geben" : "Keine Stimmen mehr übrig"}
              onClick={onVote}
              disabled={votesLeft <= 0}
              className="btn-secondary h-[22px] w-[22px] rounded-[6px] text-[12px] leading-none disabled:cursor-not-allowed disabled:opacity-40"
            >
              +
            </button>
            {card.myVotes > 0 && (
              <button
                type="button"
                aria-label="Stimme zurücknehmen"
                title={`Deine Stimmen: ${card.myVotes}`}
                onClick={onUnvote}
                className="btn-secondary h-[22px] w-[22px] rounded-[6px] text-[12px] leading-none"
              >
                –
              </button>
            )}
            <button
              type="button"
              aria-label="Kommentare"
              onClick={() => setCommentsOpen((o) => !o)}
              className={`ml-auto font-mono text-[11.5px] ${card.comments.length > 0 ? "text-link" : "text-dim"} hover:text-linkhi`}
            >
              💬 {card.comments.length}
            </button>
            {canEdit && (
              <>
                <button
                  type="button"
                  aria-label="Karte bearbeiten"
                  title="Bearbeiten"
                  onClick={() => {
                    const parts = splitCardText(card.text);
                    setEditText(parts.text);
                    setEditGifs(parts.gifs);
                    setEditing(true);
                  }}
                  className="text-[12px] text-dim hover:text-fg"
                >
                  ✎
                </button>
                <button
                  type="button"
                  aria-label="Karte löschen"
                  title="Löschen"
                  onClick={onDelete}
                  className="text-[12px] text-dim hover:text-danger"
                >
                  ×
                </button>
              </>
            )}
          </div>
          {commentsOpen && (
            <div className="mt-2 flex flex-col gap-1.5 border-t border-row pt-2">
              {card.comments.map((c) => (
                <div key={c.id} className="flex items-start gap-1.5 text-[12.5px]">
                  <span className="flex-none font-medium text-mid">{c.author}:</span>
                  <span className="min-w-0 flex-1 whitespace-pre-line text-fg">{c.text}</span>
                  {(isAdmin || c.author === youName) && (
                    <button
                      type="button"
                      aria-label="Kommentar löschen"
                      onClick={() => onDeleteComment(c.id)}
                      className="flex-none text-[11px] text-dim hover:text-danger"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <div className="flex gap-1.5">
                <input
                  aria-label="Kommentar schreiben"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitComment()}
                  placeholder="Kommentar…"
                  className="input-field min-w-0 flex-1 px-2 py-1.5 text-[12.5px]"
                />
                <button type="button" onClick={submitComment} className="btn-secondary px-2.5 py-1.5 text-[12px]">
                  OK
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Column({
  column,
  isAdmin,
  votesLeft,
  sortByVotes,
  searchGifs,
  onAddCard,
  onRename,
  onSetColor,
  onReorder,
  onDelete,
  cardHandlers,
}: {
  column: RetroColumnView;
  isAdmin: boolean;
  votesLeft: number;
  sortByVotes: boolean;
  searchGifs: GifSearch;
  onAddCard: (text: string) => void;
  onRename: (name: string) => void;
  onSetColor: (color: string) => void;
  /** Eine andere Spalte wurde auf diese gezogen — an diese Position schieben. */
  onReorder: (sourceColumnId: string) => void;
  onDelete: () => void;
  cardHandlers: (card: RetroCardView) => Parameters<typeof Card>[0];
}) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerText, setComposerText] = useState("");
  const [composerGifs, setComposerGifs] = useState<string[]>([]);
  const [renaming, setRenaming] = useState(false);
  const [nameText, setNameText] = useState("");
  const [colorOpen, setColorOpen] = useState(false);
  const [columnDragOver, setColumnDragOver] = useState(false);

  const cards = sortByVotes ? [...column.cards].sort((a, b) => b.votes - a.votes) : column.cards;

  const submitCard = () => {
    const combined = joinCardText(composerText, composerGifs);
    if (!combined) return;
    onAddCard(combined);
    setComposerText("");
    setComposerGifs([]);
    setComposerOpen(false);
  };

  const saveName = () => {
    onRename(nameText);
    setRenaming(false);
  };

  return (
    <div
      data-testid={`column-${column.name}`}
      onDragOver={(e) => {
        if (!isAdmin || !e.dataTransfer.types.includes(COLUMN_DRAG_TYPE)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setColumnDragOver(true);
      }}
      onDragLeave={() => setColumnDragOver(false)}
      onDrop={(e) => {
        setColumnDragOver(false);
        const sourceId = e.dataTransfer.getData(COLUMN_DRAG_TYPE);
        if (!sourceId || sourceId === column.id) return;
        e.preventDefault();
        onReorder(sourceId);
      }}
      className={`flex w-[300px] flex-none flex-col gap-2 rounded-[12px] ${columnDragOver ? "ring-2 ring-[#6e8ff6]" : ""}`}
    >
      <div
        draggable={isAdmin}
        onDragStart={(e) => {
          e.dataTransfer.setData(COLUMN_DRAG_TYPE, column.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        title={isAdmin ? "Spalte per Drag & Drop verschieben" : undefined}
        className={`flex items-center gap-2 rounded-[10px] border border-line bg-field px-3 py-2 ${isAdmin ? "cursor-grab" : ""}`}
        style={{ borderTop: `3px solid ${column.color}` }}
      >
        {renaming ? (
          <>
            <input
              aria-label="Spaltenname"
              value={nameText}
              onChange={(e) => setNameText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveName()}
              className="input-field min-w-0 flex-1 px-2 py-1 text-[13px]"
            />
            <button type="button" onClick={saveName} className="btn-primary px-2.5 py-1 text-[12px]">OK</button>
          </>
        ) : (
          <>
            <span className="h-2 w-2 flex-none rounded-full" style={{ background: column.color }} />
            <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{column.name}</span>
            <span className="flex-none font-mono text-[11px] text-faint">{column.cards.length}</span>
            {isAdmin && (
              <span className="relative flex flex-none items-center gap-1">
                <button
                  type="button"
                  aria-label={`Spalte ${column.name} umbenennen`}
                  title="Umbenennen"
                  onClick={() => {
                    setNameText(column.name);
                    setRenaming(true);
                  }}
                  className="text-[12px] text-dim hover:text-fg"
                >
                  ✎
                </button>
                <button
                  type="button"
                  aria-label={`Farbe von ${column.name} ändern`}
                  title="Farbe ändern"
                  onClick={() => setColorOpen((o) => !o)}
                  className="h-[14px] w-[14px] rounded-full border border-edge"
                  style={{ background: column.color }}
                />
                <button
                  type="button"
                  aria-label={`Spalte ${column.name} löschen`}
                  title="Spalte löschen (samt Karten)"
                  onClick={() => {
                    if (window.confirm(`Spalte „${column.name}" samt Karten löschen?`)) onDelete();
                  }}
                  className="text-[13px] text-dim hover:text-danger"
                >
                  ×
                </button>
                {colorOpen && (
                  <span className="absolute right-0 top-[24px] z-20 flex gap-1 rounded-[9px] border border-edge bg-field p-1.5 shadow-card">
                    {RETRO_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-label={`Farbe ${c}`}
                        onClick={() => {
                          onSetColor(c);
                          setColorOpen(false);
                        }}
                        className="h-[18px] w-[18px] rounded-full border border-edge"
                        style={{ background: c }}
                      />
                    ))}
                  </span>
                )}
              </span>
            )}
          </>
        )}
      </div>

      <button
        type="button"
        aria-label={`Karte in ${column.name} anlegen`}
        onClick={() => setComposerOpen(true)}
        className="btn-secondary w-full rounded-[10px] border-dashed py-1.5 text-[13px] text-mid"
      >
        +
      </button>

      {composerOpen && (
        <div className="flex flex-col gap-2 rounded-[10px] border border-edge bg-field p-2.5">
          <textarea
            aria-label={`Neue Karte in ${column.name}`}
            value={composerText}
            onChange={(e) => setComposerText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submitCard();
              }
            }}
            rows={3}
            autoFocus
            placeholder="Text, Emojis 🎉 oder GIF-URL…"
            className="input-field resize-y text-[13px]"
          />
          <GifAttachments gifs={composerGifs} onRemove={(i) => setComposerGifs((g) => g.filter((_, j) => j !== i))} />
          <div className="flex items-center gap-1.5">
            <EmojiGifPicker
              searchGifs={searchGifs}
              onInsert={(s) =>
                s.startsWith("http") ? setComposerGifs((g) => [...g, s]) : setComposerText((t) => t + s)
              }
            />
            <button type="button" onClick={submitCard} className="btn-primary ml-auto px-3 py-1.5">Hinzufügen</button>
            <button
              type="button"
              onClick={() => {
                setComposerOpen(false);
                setComposerText("");
                setComposerGifs([]);
              }}
              className="btn-secondary px-3 py-1.5"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {cards.map((card) => (
        <Card key={card.id} {...cardHandlers(card)} />
      ))}
    </div>
  );
}

export function RetroBoard({
  state,
  onAddCard,
  onUpdateCard,
  onDeleteCard,
  onVote,
  onUnvote,
  onAddComment,
  onDeleteComment,
  onMerge,
  onAddColumn,
  onRenameColumn,
  onSetColumnColor,
  onReorderColumn,
  onDeleteColumn,
  onSearchGifs,
}: {
  state: RetroStateView;
  onAddCard: (columnId: string, text: string) => void;
  onUpdateCard: (cardId: string, text: string) => void;
  onDeleteCard: (cardId: string) => void;
  onVote: (cardId: string) => void;
  onUnvote: (cardId: string) => void;
  onAddComment: (cardId: string, text: string) => void;
  onDeleteComment: (commentId: string) => void;
  /** Moderator zieht eine Karte auf eine andere — sie werden zusammengeführt. */
  onMerge: (sourceId: string, targetId: string) => void;
  onAddColumn: (name: string, color: string) => void;
  onRenameColumn: (columnId: string, name: string) => void;
  onSetColumnColor: (columnId: string, color: string) => void;
  onReorderColumn: (columnId: string, targetColumnId: string) => void;
  onDeleteColumn: (columnId: string) => void;
  /** GIF-Suche (Giphy-Proxy) für die Karten-Eingabe. */
  onSearchGifs: GifSearch;
}) {
  const isAdmin = state.you?.isAdmin ?? false;
  const [sortByVotes, setSortByVotes] = useState(false);
  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [newColumnColor, setNewColumnColor] = useState<string>(RETRO_COLORS[0]);
  /** Merge erst nach Bestätigung — der Drop merkt sich nur die Absicht. */
  const [mergeIntent, setMergeIntent] = useState<{ sourceId: string; targetId: string } | null>(null);

  const findCard = (id: string) => state.columns.flatMap((c) => c.cards).find((k) => k.id === id);

  const submitColumn = () => {
    if (!newColumnName.trim()) return;
    onAddColumn(newColumnName, newColumnColor);
    setNewColumnName("");
    setAddColumnOpen(false);
  };

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-[12px] text-mid">
          🗳️ Noch {state.votesLeft} von {state.votesPerUser} Stimmen
        </span>
        <label className="flex cursor-pointer items-center gap-1.5 text-[12.5px] text-mid">
          <input
            type="checkbox"
            checked={sortByVotes}
            onChange={(e) => setSortByVotes(e.target.checked)}
            className="h-3.5 w-3.5 accent-[#6e8ff6]"
          />
          Nach Stimmen sortiert
        </label>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setAddColumnOpen((o) => !o)}
            className="btn-secondary ml-auto px-3 py-[6px] text-[12.5px]"
          >
            + Spalte
          </button>
        )}
      </div>

      {addColumnOpen && (
        <div className="card mt-3 flex max-w-[460px] flex-wrap items-center gap-2 p-3">
          <input
            aria-label="Name der neuen Spalte"
            value={newColumnName}
            onChange={(e) => setNewColumnName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitColumn()}
            placeholder="Spaltenname"
            className="input-field min-w-0 flex-1"
          />
          <span className="flex gap-1">
            {RETRO_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Neue Spalte in ${c}`}
                onClick={() => setNewColumnColor(c)}
                className={`h-[20px] w-[20px] rounded-full border ${newColumnColor === c ? "border-fg" : "border-edge"}`}
                style={{ background: c }}
              />
            ))}
          </span>
          <button type="button" onClick={submitColumn} className="btn-primary px-3.5 py-2">
            Anlegen
          </button>
        </div>
      )}

      <div className="mt-3.5 flex items-start gap-3.5 overflow-x-auto pb-4">
        {state.columns.map((column) => (
          <Column
            key={column.id}
            column={column}
            isAdmin={isAdmin}
            votesLeft={state.votesLeft}
            sortByVotes={sortByVotes}
            searchGifs={onSearchGifs}
            onAddCard={(text) => onAddCard(column.id, text)}
            onRename={(name) => onRenameColumn(column.id, name)}
            onSetColor={(color) => onSetColumnColor(column.id, color)}
            onReorder={(sourceColumnId) => onReorderColumn(sourceColumnId, column.id)}
            onDelete={() => onDeleteColumn(column.id)}
            cardHandlers={(card) => ({
              card,
              color: column.color,
              isAdmin,
              youName: state.you?.name ?? "",
              votesLeft: state.votesLeft,
              searchGifs: onSearchGifs,
              onUpdate: (text: string) => onUpdateCard(card.id, text),
              onDelete: () => onDeleteCard(card.id),
              onVote: () => onVote(card.id),
              onUnvote: () => onUnvote(card.id),
              onAddComment: (text: string) => onAddComment(card.id, text),
              onDeleteComment,
              onMerge: (sourceId: string) => setMergeIntent({ sourceId, targetId: card.id }),
            })}
          />
        ))}
        {state.columns.length === 0 && (
          <div className="text-[13px] text-muted">Noch keine Spalten — der Moderator legt sie an.</div>
        )}
      </div>

      {mergeIntent && (
        <div
          role="dialog"
          aria-label="Karten zusammenführen"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setMergeIntent(null)}
        >
          <div className="card w-full max-w-[440px] p-[20px]" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-semibold">Karten wirklich zusammenführen?</div>
            <div className="mt-3 flex flex-col gap-2 text-[12.5px]">
              <div className="rounded-[8px] border border-edge bg-field px-3 py-2 text-mid">
                {findCard(mergeIntent.sourceId)?.text || "(verdeckte Karte)"}
              </div>
              <div className="text-center text-[13px] text-dim">⤵ wird angehängt an</div>
              <div className="rounded-[8px] border border-edge bg-field px-3 py-2 text-mid">
                {findCard(mergeIntent.targetId)?.text || "(verdeckte Karte)"}
              </div>
            </div>
            <div className="mt-2.5 text-[12px] text-muted">Kommentare und Stimmen wandern mit auf die Zielkarte.</div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  onMerge(mergeIntent.sourceId, mergeIntent.targetId);
                  setMergeIntent(null);
                }}
                className="btn-primary px-4 py-2"
              >
                Zusammenführen
              </button>
              <button type="button" onClick={() => setMergeIntent(null)} className="btn-secondary px-3.5 py-2">
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
