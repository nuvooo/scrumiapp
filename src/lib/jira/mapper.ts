import type { DomainIssue, SprintState, StatusCategory } from "@/lib/domain/types";
import type { JiraIssueRaw } from "./types";

export function mapStatusCategory(key: string): StatusCategory {
  switch (key) {
    case "done":
      return "DONE";
    case "indeterminate":
      return "IN_PROGRESS";
    default:
      return "TODO";
  }
}

export function mapSprintState(state: string): SprintState {
  switch (state) {
    case "active":
      return "ACTIVE";
    case "closed":
      return "CLOSED";
    default:
      // "future" und unbekannte Zustände werden bewusst auf FUTURE abgebildet.
      return "FUTURE";
  }
}

export function mapIssue(raw: JiraIssueRaw, storyPointsField: string, onBoard = true): DomainIssue {
  const rawPoints = raw.fields[storyPointsField];
  const storyPoints = typeof rawPoints === "number" ? rawPoints : 0;
  return {
    jiraKey: raw.key,
    summary: raw.fields.summary,
    issueType: raw.fields.issuetype?.name ?? "",
    storyPoints,
    status: raw.fields.status.name,
    statusCategory: mapStatusCategory(raw.fields.status.statusCategory.key),
    resolvedAt: raw.fields.resolutiondate ? new Date(raw.fields.resolutiondate) : null,
    addedAfterSprintStart: false,
    onBoard,
    assignee: raw.fields.assignee?.displayName ?? null,
  };
}

export interface SprintPoints {
  committedPoints: number;
  completedPoints: number;
}

/** Sprint-Zeitraum: start..end (end = completeDate, sonst endDate; null = offen). */
export interface SprintWindow {
  start: Date | null;
  end: Date | null;
}

/**
 * completed = SP der im Sprint-Zeitraum erledigten Issues (resolvedAt im Fenster);
 * committed = completed + SP der offenen Board-Issues. Dem Sprint zugeordnete
 * Altlasten (längst erledigt oder nicht auf dem Board) zählen nicht — sonst
 * blähen sie Commitment und Velocity auf.
 */
export function computeSprintPoints(issues: DomainIssue[], window: SprintWindow): SprintPoints {
  const inWindow = (d: Date | null) =>
    d !== null &&
    window.start !== null &&
    d >= window.start &&
    (window.end === null || d <= window.end);

  let committedPoints = 0;
  let completedPoints = 0;
  for (const issue of issues) {
    if (issue.statusCategory === "DONE") {
      if (inWindow(issue.resolvedAt)) completedPoints += issue.storyPoints;
    } else if (issue.onBoard) {
      committedPoints += issue.storyPoints;
    }
  }
  return { committedPoints: committedPoints + completedPoints, completedPoints };
}

/**
 * Anzahl offener (nicht-DONE) Bugs auf dem Board. bugTypes ist ein Set
 * lowercased Vorgangstyp-Namen. Zählt nur Board-sichtbare Issues, damit die
 * Zahl mit der Jira-Board-Ansicht übereinstimmt.
 */
export function countOpenBugs(issues: DomainIssue[], bugTypes: Set<string>): number {
  return issues.filter(
    (i) => i.onBoard && bugTypes.has(i.issueType.toLowerCase()) && i.statusCategory !== "DONE",
  ).length;
}

/**
 * Anzahl offener (nicht-DONE) Vorgänge auf dem Board — ohne Bugs, die separat
 * gezählt werden (countOpenBugs).
 */
export function countOpenTickets(issues: DomainIssue[], bugTypes: Set<string>): number {
  return issues.filter(
    (i) => i.onBoard && i.statusCategory !== "DONE" && !bugTypes.has(i.issueType.toLowerCase()),
  ).length;
}
