import { listTeams } from "@/lib/repositories/teamRepository";
import { syncTeam } from "./syncTeam";
import { JiraCloudClient, jiraConfigFromEnv, type JiraClient } from "@/lib/jira/jiraClient";

/** Synchronisiert alle Teams nacheinander. clientFactory ist für Tests injizierbar. */
export async function syncAllTeams(
  clientFactory: () => JiraClient = () => new JiraCloudClient(jiraConfigFromEnv()),
  opts: { full?: boolean } = {},
): Promise<void> {
  const teams = await listTeams();
  for (const team of teams) {
    await syncTeam(team.id, clientFactory(), undefined, opts);
  }
}
