/** Story-Points-Fortschritt einer Bahn, aufgeschlüsselt nach Statuskategorie. */

export interface ProgressInput {
  storyPoints: number;
  /** "done" | "indeterminate" | "new" | null (unbekannt = offen) */
  statusCategory: string | null;
}

export interface LaneProgress {
  done: number;
  inProgress: number;
  open: number;
  total: number;
  donePct: number;
  inProgressPct: number;
  openPct: number;
}

export function laneProgress(items: ProgressInput[]): LaneProgress {
  let done = 0;
  let inProgress = 0;
  let open = 0;
  for (const i of items) {
    const sp = Number.isFinite(i.storyPoints) ? i.storyPoints : 0;
    if (i.statusCategory === "done") done += sp;
    else if (i.statusCategory === "indeterminate") inProgress += sp;
    else open += sp;
  }
  const total = done + inProgress + open;
  const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);
  return {
    done, inProgress, open, total,
    donePct: pct(done),
    inProgressPct: pct(inProgress),
    openPct: pct(open),
  };
}
