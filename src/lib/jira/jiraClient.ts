import type { DomainIssue } from "@/lib/domain/types";
import type { JiraSprintPage, JiraIssuePage, JiraIssueRaw, JiraChangelogHistory } from "./types";
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

export interface BoardColumn {
  name: string;
  /** Status-Namen, die dieser Spalte zugeordnet sind. */
  statuses: string[];
}

export interface JiraClient {
  fetchBoardSprints(boardId: string): Promise<MappedSprint[]>;
  fetchSprintIssues(boardId: string, sprintId: string): Promise<DomainIssue[]>;
  fetchBoardColumns(boardId: string): Promise<BoardColumn[]>;
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
        `/rest/agile/1.0/board/${boardId}/sprint?state=active%2Cclosed%2Cfuture&startAt=${startAt}&maxResults=50`,
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

  // Spalten der Board-Ansicht: die Konfiguration liefert Status-IDs, die über
  // die globale Status-Liste in Namen aufgelöst werden (Issues tragen nur Namen).
  async fetchBoardColumns(boardId: string): Promise<BoardColumn[]> {
    const config = await this.getJson<{
      columnConfig?: { columns?: { name: string; statuses?: { id: string }[] }[] };
    }>(`/rest/agile/1.0/board/${boardId}/configuration`);
    const statuses = await this.getJson<{ id: string; name: string }[]>(`/rest/api/3/status`);
    const nameById = new Map(statuses.map((s) => [s.id, s.name]));
    return (config.columnConfig?.columns ?? []).map((c) => ({
      name: c.name,
      statuses: (c.statuses ?? [])
        .map((s) => nameById.get(s.id))
        .filter((n): n is string => n !== undefined),
    }));
  }

  private async paginateIssues(path: string, fields: string, extraQuery = ""): Promise<JiraIssueRaw[]> {
    const issues: JiraIssueRaw[] = [];
    let startAt = 0;
    for (;;) {
      const page = await this.getJson<JiraIssuePage>(
        `${path}?startAt=${startAt}&maxResults=50&fields=${fields}${extraQuery}`,
      );
      issues.push(...page.issues);
      if (page.issues.length === 0) break;
      startAt += page.issues.length;
      if (startAt >= page.total) break;
    }
    return issues;
  }

  // Jira liefert im Inline-Changelog höchstens 100 Einträge (die ältesten).
  // Für Issues mit mehr Einträgen alle Seiten holen und den jüngsten
  // Status-Wechsel per Datumsvergleich bestimmen.
  private async latestStatusChange(issueKey: string): Promise<Date | null> {
    let latest: Date | null = null;
    let startAt = 0;
    for (;;) {
      const page = await this.getJson<{ values: JiraChangelogHistory[]; total: number }>(
        `/rest/api/3/issue/${issueKey}/changelog?startAt=${startAt}&maxResults=100`,
      );
      for (const h of page.values) {
        if (!h.items.some((it) => it.field === "status")) continue;
        const d = new Date(h.created);
        if (latest === null || d > latest) latest = d;
      }
      if (page.values.length === 0) break;
      startAt += page.values.length;
      if (startAt >= page.total) break;
    }
    return latest;
  }

  // Zwei Sichten pro Sprint: der globale /sprint/{id}/issue-Endpoint liefert alle
  // Vorgänge (nötig für Velocity — Erledigtes verschwindet oft vom Board), der
  // Board-Endpoint bestimmt, was die Board-Ansicht zeigt (onBoard-Flag für
  // Ticket-/Bug-Zähler). Sub-Tasks stehen selbst nie auf dem Board; sie gelten
  // als sichtbar, wenn ihr Hauptticket auf dem Board steht.
  async fetchSprintIssues(boardId: string, sprintId: string): Promise<DomainIssue[]> {
    const fields = ["summary", "resolutiondate", "status", "issuetype", "parent", "assignee", "created", this.config.storyPointsField].join(",");
    const all = await this.paginateIssues(`/rest/agile/1.0/sprint/${sprintId}/issue`, fields, "&expand=changelog");
    const onBoard = await this.paginateIssues(
      `/rest/agile/1.0/board/${boardId}/sprint/${sprintId}/issue`,
      "issuetype",
    );
    const boardKeys = new Set(onBoard.map((raw) => raw.key));
    return Promise.all(
      all.map(async (raw) => {
        const visibleKey = raw.fields.issuetype?.subtask ? raw.fields.parent?.key : raw.key;
        const issue = mapIssue(raw, this.config.storyPointsField, visibleKey ? boardKeys.has(visibleKey) : false);
        const log = raw.changelog;
        if (log && log.total > log.histories.length) {
          issue.statusSince = (await this.latestStatusChange(raw.key)) ?? issue.statusSince;
        }
        return issue;
      }),
    );
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

/**
 * Liest die als Bug geltenden Vorgangstypen aus JIRA_BUG_ISSUE_TYPES
 * (kommagetrennt, case-insensitive). Default: "Bug", "Fehler".
 */
export function getBugIssueTypes(): Set<string> {
  const raw = process.env.JIRA_BUG_ISSUE_TYPES;
  const source = raw && raw.trim() ? raw.split(",") : ["Bug", "Fehler"];
  const list = source.map((s) => s.trim().toLowerCase()).filter(Boolean);
  return new Set(list.length ? list : ["bug", "fehler"]);
}
