"use client";

import { dayFromNumber, formatDay } from "@/lib/view/roadmapDays";
import { INBOX_ID, blockProgress, blockSpan, leaves, pathOf, typeAt, type DaySpan, type TreeBlock } from "@/lib/view/roadmapTree";

/**
 * Detailkarte eines Blocks unten rechts: Typ, Zuordnung, Zeitraum, Fortschritt.
 * Löschen und Bearbeiten erscheinen hier an der Auswahl, nicht in der Werkzeugleiste.
 */
export function RoadmapBlockDrawer({
  block,
  fallback,
  readOnly,
  onClose,
  onEdit,
  onDelete,
}: {
  block: TreeBlock;
  /** Spanne leerer Blöcke ohne geplante Spanne */
  fallback: DaySpan;
  readOnly: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const inbox = block.id === INBOX_ID;
  const span = blockSpan(block, fallback);
  const all = leaves(block);
  const { done } = blockProgress(block);
  const sp = all.reduce((s, t) => s + t.storyPoints, 0);
  const subBlocks = block.children.length;
  return (
    <aside className="rm-drawer" aria-live="polite" data-roadmap-drawer>
      <button type="button" className="x" onClick={onClose} aria-label="Schließen">
        ✕
      </button>
      <div className="k">{inbox ? "Eingangskorb" : typeAt(block.depth).one}</div>
      <h3>{block.name}</h3>
      <dl>
        {!inbox && <dt>Zuordnung</dt>}
        {!inbox && <dd>{pathOf(block.parent) || "oberste Ebene"}</dd>}
        <dt>Zeitraum</dt>
        <dd>
          {formatDay(dayFromNumber(span.start))} – {formatDay(dayFromNumber(span.end))}
        </dd>
        <dt>Dauer</dt>
        <dd>{span.end - span.start + 1} Tage</dd>
        <dt>Tickets</dt>
        <dd>{all.length ? `${done} von ${all.length} erledigt` : "noch keine"}</dd>
        <dt>Story Points</dt>
        <dd>{sp}</dd>
        {!inbox && <dt>Unterblöcke</dt>}
        {!inbox && <dd>{subBlocks}</dd>}
      </dl>
      <p className="hint">
        {inbox
          ? "Tickets ohne Block. Von hier in einen Block ziehen."
          : all.length
            ? "Anfang und Ende ergeben sich aus dem Inhalt. Kopfzeile ziehen = Termin verschieben, auf einen anderen Block ziehen = umhängen."
            : "Noch leer: Breite an den Rändern ziehen, Kopfzeile ziehen = Termin verschieben."}
      </p>
      {!readOnly && !inbox && (
        <div className="dfoot">
          <button type="button" className="rm-btn" onClick={onEdit}>
            Bearbeiten …
          </button>
          <button type="button" className="rm-btn danger" onClick={onDelete}>
            Block löschen
          </button>
        </div>
      )}
    </aside>
  );
}
