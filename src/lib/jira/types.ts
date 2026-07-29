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

export interface JiraIssueRaw {
  key: string;
  fields: {
    summary: string;
    resolutiondate: string | null;
    status: { name: string; statusCategory: JiraStatusCategory };
    issuetype?: { name: string; subtask?: boolean };
    parent?: { key: string };
    assignee?: { displayName?: string } | null;
    [storyPointsField: string]: unknown;
  };
}

export interface JiraIssuePage {
  issues: JiraIssueRaw[];
  startAt: number;
  maxResults: number;
  total: number;
}
