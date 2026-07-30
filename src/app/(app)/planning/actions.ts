"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { JiraCloudClient, jiraConfigFromEnv } from "@/lib/jira/jiraClient";

export interface EstimateResult {
  ok: boolean;
  error?: string;
}

/**
 * Poker-Ergebnis übernehmen: erst nach Jira schreiben (führende Quelle),
 * dann die lokalen Zeilen nachziehen. Schlägt Jira fehl, bleibt lokal alles
 * unverändert.
 */
export async function estimateIssue(jiraKey: string, points: number): Promise<EstimateResult> {
  if (!jiraKey || !Number.isFinite(points) || points < 0) {
    return { ok: false, error: "Ungültige Schätzung." };
  }

  const config = jiraConfigFromEnv();
  if (!config.baseUrl || !config.email || !config.apiToken) {
    return { ok: false, error: "Jira ist nicht konfiguriert." };
  }

  try {
    await new JiraCloudClient(config).setStoryPoints(jiraKey, points);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Jira-Update fehlgeschlagen." };
  }

  // Ein Ticket kann mehreren Sprints zugeordnet sein — alle Zeilen nachziehen.
  await prisma.issue.updateMany({ where: { jiraKey }, data: { storyPoints: points } });
  revalidatePath("/planning");
  return { ok: true };
}
