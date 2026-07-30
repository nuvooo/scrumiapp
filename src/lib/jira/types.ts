export interface JiraSprintRaw {
  id: number;
  name: string;
  state: "active" | "closed" | "future";
  startDate?: string;
  endDate?: string;
  completeDate?: string;
}

export interface JiraSprintPage {
  values: JiraSprintRaw[];
  isLast?: boolean;
}

export interface JiraStatusCategory {
  key: "new" | "indeterminate" | "done";
}

export interface JiraChangelogHistory {
  created: string;
  items: { field: string }[];
}

export interface JiraChangelog {
  startAt: number;
  maxResults: number;
  total: number;
  histories: JiraChangelogHistory[];
}

export interface JiraIssueRaw {
  key: string;
  changelog?: JiraChangelog;
  fields: {
    summary: string;
    resolutiondate: string | null;
    status: { name: string; statusCategory: JiraStatusCategory };
    issuetype?: { name: string; subtask?: boolean };
    parent?: { key: string };
    assignee?: { displayName?: string } | null;
    created?: string;
    [storyPointsField: string]: unknown;
  };
}

export interface JiraIssuePage {
  issues: JiraIssueRaw[];
  startAt: number;
  maxResults: number;
  total: number;
}
