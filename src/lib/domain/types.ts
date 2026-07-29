export type SprintState = "ACTIVE" | "CLOSED" | "FUTURE";
export type StatusCategory = "TODO" | "IN_PROGRESS" | "DONE";
export type TrendDirection = "UP" | "DOWN" | "FLAT";

export interface DomainIssue {
  jiraKey: string;
  summary: string;
  issueType: string;
  storyPoints: number;
  status: string;
  statusCategory: StatusCategory;
  resolvedAt: Date | null;
  addedAfterSprintStart: boolean;
  /** Sichtbar auf dem Jira-Board (Board-Filter + Spalten-Mapping). */
  onBoard: boolean;
  /** Anzeigename des Bearbeiters aus Jira (null = nicht zugewiesen). */
  assignee: string | null;
}

export interface DomainSprint {
  id: string;
  name: string;
  state: SprintState;
  startDate: Date | null;
  endDate: Date | null;
  completeDate: Date | null;
  committedPoints: number;
  completedPoints: number;
}

export interface DomainBurndownPoint {
  date: Date;
  remainingPoints: number;
  completedPoints: number;
  remainingBugs: number;
  remainingTickets: number;
}

export interface DomainCapacityEntry {
  teamMemberId: string | null;
  name: string;
  plannedPersonDays: number;
  actualPersonDays: number;
}
