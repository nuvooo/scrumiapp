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

describe("JiraCloudClient.fetchSprintIssues", () => {
  it("returns mapped domain issues across pages", async () => {
    const issue = (key: string) => ({
      key,
      fields: {
        summary: key,
        resolutiondate: null,
        status: { name: "To Do", statusCategory: { key: "new" } },
        customfield_10016: 3,
      },
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ issues: [issue("AB-1")], startAt: 0, maxResults: 1, total: 2 }))
      .mockResolvedValueOnce(jsonResponse({ issues: [issue("AB-2")], startAt: 1, maxResults: 1, total: 2 }));
    const client = new JiraCloudClient(config, fetchMock);

    const result = await client.fetchSprintIssues("100");

    expect(result.map((i) => i.jiraKey)).toEqual(["AB-1", "AB-2"]);
    expect(result[0].storyPoints).toBe(3);
  });
});
