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

export function mapIssue(raw: JiraIssueRaw, storyPointsField: string): DomainIssue {
  const rawPoints = raw.fields[storyPointsField];
  const storyPoints = typeof rawPoints === "number" ? rawPoints : 0;
  return {
    jiraKey: raw.key,
    summary: raw.fields.summary,
    storyPoints,
    status: raw.fields.status.name,
    statusCategory: mapStatusCategory(raw.fields.status.statusCategory.key),
    resolvedAt: raw.fields.resolutiondate ? new Date(raw.fields.resolutiondate) : null,
    addedAfterSprintStart: false,
  };
}

export interface SprintPoints {
  committedPoints: number;
  completedPoints: number;
}

/** committed = alle Story Points; completed = nur DONE. */
export function computeSprintPoints(issues: DomainIssue[]): SprintPoints {
  let committedPoints = 0;
  let completedPoints = 0;
  for (const issue of issues) {
    committedPoints += issue.storyPoints;
    if (issue.statusCategory === "DONE") completedPoints += issue.storyPoints;
  }
  return { committedPoints, completedPoints };
}
