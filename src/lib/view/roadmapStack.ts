/** Stapelung überlappender Roadmap-Balken einer Bahn in Unterzeilen. */

export interface StackableBar {
  id: string;
  /** Monatsindizes im Raster (inklusive) */
  start: number;
  end: number;
  /** Gespeicherte Reihenfolge innerhalb der Bahn */
  position: number;
}

export interface StackResult {
  rowById: Record<string, number>;
  /** Mindestens 1, damit leere Bahnen als Drop-Ziel sichtbar bleiben */
  rowCount: number;
}

export function stackBars(bars: StackableBar[]): StackResult {
  const sorted = [...bars].sort(
    (a, b) => a.position - b.position || a.start - b.start || a.id.localeCompare(b.id),
  );
  const rowEnds: number[] = [];
  const rowById: Record<string, number> = {};
  for (const bar of sorted) {
    let row = rowEnds.findIndex((end) => bar.start > end);
    if (row === -1) {
      row = rowEnds.length;
      rowEnds.push(bar.end);
    } else {
      rowEnds[row] = bar.end;
    }
    rowById[bar.id] = row;
  }
  return { rowById, rowCount: Math.max(rowEnds.length, 1) };
}
