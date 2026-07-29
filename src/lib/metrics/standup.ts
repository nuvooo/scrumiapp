import type { DomainIssue } from "@/lib/domain/types";

export interface StandupGroup {
  /** Anzeigename des Bearbeiters; null = "Ohne Bearbeiter" (steht immer am Ende). */
  name: string | null;
  openIssues: DomainIssue[];
  doneIssues: DomainIssue[];
}

/** Letzter Arbeitstag (Mo–Fr) vor dem übergebenen Datum, 00:00 lokale Zeit. */
export function previousWorkingDay(today: Date): Date {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  do {
    d.setDate(d.getDate() - 1);
  } while (d.getDay() === 0 || d.getDay() === 6);
  return d;
}

/**
 * Standup-Gruppen: je Bearbeiter die offenen Board-Tickets plus die seit
 * `doneSince` erledigten Tickets. Alphabetisch sortiert, unzugewiesene
 * Tickets als letzte Gruppe. Personen ohne relevante Tickets entfallen.
 */
export function buildStandupGroups(issues: DomainIssue[], doneSince: Date): StandupGroup[] {
  const byName = new Map<string | null, StandupGroup>();
  const group = (name: string | null): StandupGroup => {
    let g = byName.get(name);
    if (!g) {
      g = { name, openIssues: [], doneIssues: [] };
      byName.set(name, g);
    }
    return g;
  };

  for (const issue of issues) {
    if (issue.statusCategory !== "DONE" && issue.onBoard) {
      group(issue.assignee).openIssues.push(issue);
    } else if (
      issue.statusCategory === "DONE" &&
      issue.resolvedAt !== null &&
      issue.resolvedAt >= doneSince
    ) {
      group(issue.assignee).doneIssues.push(issue);
    }
  }

  return [...byName.values()].sort((a, b) => {
    if (a.name === null) return 1;
    if (b.name === null) return -1;
    return a.name.localeCompare(b.name, "de");
  });
}
