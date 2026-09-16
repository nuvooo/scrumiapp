/** View-Typen des Roadmap-Editors — Daten kommen serialisiert (Tage als "YYYY-MM-DD") aus der Page. */

export interface RoadmapItemView {
  id: string;
  laneId: string;
  /** null = Eingangskorb */
  blockId: string | null;
  jiraKey: string | null;
  issueType: string | null;
  title: string;
  description: string | null;
  /** "YYYY-MM-DD", inklusive */
  startDate: string;
  endDate: string;
  statusCategory: string | null;
  statusLabel: string | null;
  position: number;
  url: string | null;
  storyPoints: number;
  assignee: string | null;
  /** Jira-Keys, die dieses Ticket blockieren */
  blockedBy: string[];
  labelIds: string[];
}

export interface LaneView {
  id: string;
  name: string;
}

export interface BlockView {
  id: string;
  parentId: string | null;
  name: string;
  /** HSL-Farbton oder null = erbt */
  hue: number | null;
  position: number;
}

export interface LabelView {
  id: string;
  name: string;
  color: string;
}

export interface MilestoneView {
  id: string;
  title: string;
  /** "YYYY-MM-DD" */
  date: string;
  color: string;
}

export interface RoadmapView {
  id: string;
  name: string;
  /** "YYYY-MM-DD" */
  startDate: string;
  endDate: string;
  lanes: LaneView[];
  blocks: BlockView[];
  items: RoadmapItemView[];
  labels: LabelView[];
  milestones: MilestoneView[];
}

/** Zielposition eines Eintrags (Drag&Drop, Drawer). */
export interface Placement {
  laneId: string;
  blockId: string | null;
  startDate: string;
  endDate: string;
}
