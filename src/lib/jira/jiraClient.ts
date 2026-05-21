import type { DomainIssue } from "@/lib/domain/types";
import type { JiraSprintPage, JiraIssuePage } from "./types";
import { mapIssue, mapSprintState } from "./mapper";

export interface JiraConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
  storyPointsField: string;
}

export interface MappedSprint {
  jiraSprintId: string;
  name: string;
  state: "ACTIVE" | "CLOSED" | "FUTURE";
  startDate: Date | null;
  endDate: Date | null;
  completeDate: Date | null;
}

export interface JiraClient {
  fetchBoardSprints(boardId: string): Promise<MappedSprint[]>;
  fetchSprintIssues(sprintId: string): Promise<DomainIssue[]>;
}

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

export class JiraCloudClient implements JiraClient {
  constructor(
    private readonly config: JiraConfig,
    private readonly fetchFn: FetchFn = fetch,
  ) {}

  private authHeader(): string {
    const token = Buffer.from(`${this.config.email}:${this.config.apiToken}`).toString("base64");
    return `Basic ${token}`;
  }

  private async getJson<T>(path: string): Promise<T> {
    const res = await this.fetchFn(`${this.config.baseUrl}${path}`, {
      headers: { Authorization: this.authHeader(), Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`Jira request failed: ${res.status} ${res.statusText} (${path})`);
    }
    return (await res.json()) as T;
  }

  async fetchBoardSprints(boardId: string): Promise<MappedSprint[]> {
    const sprints: MappedSprint[] = [];
    let startAt = 0;
    for (;;) {
      const page = await this.getJson<JiraSprintPage>(
        `/rest/agile/1.0/board/${boardId}/sprint?state=active%2Cclosed&startAt=${startAt}&maxResults=50`,
      );
      for (const s of page.values) {
        sprints.push({
          jiraSprintId: String(s.id),
          name: s.name,
          state: mapSprintState(s.state),
          startDate: s.startDate ? new Date(s.startDate) : null,
          endDate: s.endDate ? new Date(s.endDate) : null,
          completeDate: s.completeDate ? new Date(s.completeDate) : null,
        });
      }
      if (page.isLast || page.values.length === 0) break;
      startAt += page.values.length;
    }
    return sprints;
  }

  async fetchSprintIssues(sprintId: string): Promise<DomainIssue[]> {
    const issues: DomainIssue[] = [];
    let startAt = 0;
    for (;;) {
      const fields = ["summary", "resolutiondate", "status", this.config.storyPointsField].join(",");
      const page = await this.getJson<JiraIssuePage>(
        `/rest/agile/1.0/sprint/${sprintId}/issue?startAt=${startAt}&maxResults=50&fields=${fields}`,
      );
      for (const raw of page.issues) {
        issues.push(mapIssue(raw, this.config.storyPointsField));
      }
      startAt += page.issues.length;
      if (startAt >= page.total || page.issues.length === 0) break;
    }
    return issues;
  }
}

/** Liest die Jira-Konfiguration aus Env-Variablen. */
export function jiraConfigFromEnv(): JiraConfig {
  return {
    baseUrl: process.env.JIRA_BASE_URL ?? "",
    email: process.env.JIRA_EMAIL ?? "",
    apiToken: process.env.JIRA_API_TOKEN ?? "",
    storyPointsField: process.env.JIRA_STORY_POINTS_FIELD ?? "customfield_10016",
  };
}
