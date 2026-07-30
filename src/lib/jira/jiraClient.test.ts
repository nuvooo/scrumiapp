import { describe, it, expect, vi } from "vitest";
import { JiraCloudClient } from "./jiraClient";
import type { JiraSprintRaw } from "./types";

const config = {
  baseUrl: "https://example.atlassian.net",
  email: "me@example.com",
  apiToken: "token123",
  storyPointsField: "customfield_10016",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("JiraCloudClient.fetchBoardSprints", () => {
  it("requests active+closed+future sprints with basic auth and returns mapped sprints", async () => {
    const sprints: JiraSprintRaw[] = [
      { id: 100, name: "Sprint 1", state: "closed", startDate: "2026-05-01T00:00:00.000Z", endDate: "2026-05-14T00:00:00.000Z", completeDate: "2026-05-14T10:00:00.000Z" },
    ];
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ values: sprints, isLast: true }));
    const client = new JiraCloudClient(config, fetchMock);

    const result = await client.fetchBoardSprints("42");

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ jiraSprintId: "100", name: "Sprint 1", state: "CLOSED" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/rest/agile/1.0/board/42/sprint");
    expect(url).toContain("state=active%2Cclosed%2Cfuture");
    const auth = (init.headers as Record<string, string>)["Authorization"];
    expect(auth).toBe("Basic " + Buffer.from("me@example.com:token123").toString("base64"));
  });

  it("follows pagination until isLast is true", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ values: [{ id: 1, name: "A", state: "closed" }], isLast: false }))
      .mockResolvedValueOnce(jsonResponse({ values: [{ id: 2, name: "B", state: "active" }], isLast: true }));
    const client = new JiraCloudClient(config, fetchMock);

    const result = await client.fetchBoardSprints("42");

    expect(result.map((s) => s.jiraSprintId)).toEqual(["1", "2"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws on non-OK responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ message: "unauthorized" }, 401));
    const client = new JiraCloudClient(config, fetchMock);

    await expect(client.fetchBoardSprints("42")).rejects.toThrow(/401/);
  });

  it("returns an empty array for an empty board (single page, isLast true)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ values: [], isLast: true }));
    const client = new JiraCloudClient(config, fetchMock);

    const result = await client.fetchBoardSprints("42");

    expect(result).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("JiraCloudClient.fetchBoardColumns", () => {
  it("maps column status ids to status names", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          columnConfig: {
            columns: [
              { name: "Offen", statuses: [{ id: "1" }, { id: "4" }] },
              { name: "In Arbeit", statuses: [{ id: "7" }] },
              { name: "Leer", statuses: [] },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse([
          { id: "1", name: "Open" },
          { id: "4", name: "Reopened" },
          { id: "7", name: "In Progress" },
        ]),
      );
    const client = new JiraCloudClient(config, fetchMock);

    const columns = await client.fetchBoardColumns("42");

    const urls = fetchMock.mock.calls.map(([u]) => u as string);
    expect(urls[0]).toContain("/rest/agile/1.0/board/42/configuration");
    expect(urls[1]).toContain("/rest/api/3/status");
    expect(columns).toEqual([
      { name: "Offen", statuses: ["Open", "Reopened"] },
      { name: "In Arbeit", statuses: ["In Progress"] },
      { name: "Leer", statuses: [] },
    ]);
  });
});

describe("JiraCloudClient.fetchSprintIssues", () => {
  const issue = (key: string, extra: Record<string, unknown> = {}) => ({
    key,
    fields: {
      summary: key,
      resolutiondate: null,
      status: { name: "To Do", statusCategory: { key: "new" } },
      customfield_10016: 3,
      ...extra,
    },
  });

  it("returns mapped domain issues across pages", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ issues: [issue("AB-1")], startAt: 0, maxResults: 1, total: 2 }))
      .mockResolvedValueOnce(jsonResponse({ issues: [issue("AB-2")], startAt: 1, maxResults: 1, total: 2 }))
      .mockResolvedValueOnce(jsonResponse({ issues: [], startAt: 0, maxResults: 50, total: 0 }));
    const client = new JiraCloudClient(config, fetchMock);

    const result = await client.fetchSprintIssues("42", "100");

    expect(result.map((i) => i.jiraKey)).toEqual(["AB-1", "AB-2"]);
    expect(result[0].storyPoints).toBe(3);
  });

  it("loads all sprint issues and flags board visibility via the board endpoint", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ issues: [issue("AB-1"), issue("AB-2")], startAt: 0, maxResults: 50, total: 2 }))
      .mockResolvedValueOnce(jsonResponse({ issues: [issue("AB-2")], startAt: 0, maxResults: 50, total: 1 }));
    const client = new JiraCloudClient(config, fetchMock);

    const result = await client.fetchSprintIssues("42", "100");

    const urls = fetchMock.mock.calls.map(([u]) => u as string);
    expect(urls[0]).toContain("/rest/agile/1.0/sprint/100/issue");
    expect(urls[1]).toContain("/rest/agile/1.0/board/42/sprint/100/issue");
    expect(result.map((i) => [i.jiraKey, i.onBoard])).toEqual([
      ["AB-1", false],
      ["AB-2", true],
    ]);
  });

  it("includes sub-tasks and derives their board visibility from the parent", async () => {
    const subtask = (key: string, parentKey: string) =>
      issue(key, { issuetype: { name: "Sub-task", subtask: true }, parent: { key: parentKey } });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          issues: [
            issue("AB-2"),
            subtask("SUB-1", "AB-2"), // Parent auf dem Board -> sichtbar
            subtask("SUB-2", "AB-9"), // Parent nicht auf dem Board -> unsichtbar
          ],
          startAt: 0, maxResults: 50, total: 3,
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ issues: [issue("AB-2")], startAt: 0, maxResults: 50, total: 1 }));
    const client = new JiraCloudClient(config, fetchMock);

    const result = await client.fetchSprintIssues("42", "100");

    expect(result.map((i) => [i.jiraKey, i.onBoard])).toEqual([
      ["AB-2", true],
      ["SUB-1", true],
      ["SUB-2", false],
    ]);
  });

  it("fordert das Changelog nur für den Sprint-Endpoint an und mappt statusSince", async () => {
    const withLog = issue("AB-1");
    (withLog as Record<string, unknown>).changelog = {
      startAt: 0, maxResults: 100, total: 1,
      histories: [{ created: "2026-07-10T09:00:00.000Z", items: [{ field: "status" }] }],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ issues: [withLog], startAt: 0, maxResults: 50, total: 1 }))
      .mockResolvedValueOnce(jsonResponse({ issues: [], startAt: 0, maxResults: 50, total: 0 }));
    const client = new JiraCloudClient(config, fetchMock);

    const result = await client.fetchSprintIssues("42", "100");

    const urls = fetchMock.mock.calls.map(([u]) => u as string);
    expect(urls[0]).toContain("expand=changelog");
    expect(urls[0]).toContain("created");
    expect(urls[1]).not.toContain("expand=changelog");
    expect(result[0].statusSince).toEqual(new Date("2026-07-10T09:00:00.000Z"));
  });

  it("lädt bei abgeschnittenem Changelog alle Seiten nach und nimmt den letzten Status-Wechsel", async () => {
    const truncated = issue("AB-1");
    (truncated as Record<string, unknown>).changelog = {
      startAt: 0, maxResults: 1, total: 2,
      histories: [{ created: "2026-07-01T09:00:00.000Z", items: [{ field: "status" }] }],
    };
    const fetchMock = vi.fn((url: string) => {
      if (url.includes("/rest/api/3/issue/AB-1/changelog")) {
        return Promise.resolve(jsonResponse({
          startAt: 0, maxResults: 100, total: 2,
          values: [
            { created: "2026-07-01T09:00:00.000Z", items: [{ field: "status" }] },
            { created: "2026-07-18T09:00:00.000Z", items: [{ field: "status" }] },
          ],
        }));
      }
      if (url.includes("/board/42/sprint/100/issue")) {
        return Promise.resolve(jsonResponse({ issues: [], startAt: 0, maxResults: 50, total: 0 }));
      }
      return Promise.resolve(jsonResponse({ issues: [truncated], startAt: 0, maxResults: 50, total: 1 }));
    });
    const client = new JiraCloudClient(config, fetchMock);

    const result = await client.fetchSprintIssues("42", "100");

    expect(result[0].statusSince).toEqual(new Date("2026-07-18T09:00:00.000Z"));
  });
});

describe("JiraCloudClient.setStoryPoints", () => {
  it("schreibt die Punkte per PUT ins konfigurierte Story-Points-Feld", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const client = new JiraCloudClient(config, fetchMock);

    await client.setStoryPoints("AB-1", 5);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://example.atlassian.net/rest/api/3/issue/AB-1");
    expect(init.method).toBe("PUT");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body as string)).toEqual({ fields: { customfield_10016: 5 } });
  });

  it("wirft bei einer abgelehnten Antwort (z. B. Token ohne Schreibrecht)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ errorMessages: ["forbidden"] }, 403));
    const client = new JiraCloudClient(config, fetchMock);

    await expect(client.setStoryPoints("AB-1", 5)).rejects.toThrow(/403/);
  });
});
