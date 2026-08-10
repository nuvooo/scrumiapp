"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { JiraCloudClient, jiraConfigFromEnv } from "@/lib/jira/jiraClient";
import { upsertCarryOverMark } from "@/lib/repositories/carryOverRepository";

export interface ActionResult<T = undefined> {
  ok: boolean;
  error?: string;
  data?: T;
}

function fail<T>(error: string): ActionResult<T> {
  return { ok: false, error };
}

function jiraClient(): JiraCloudClient | null {
  const config = jiraConfigFromEnv();
  if (!config.baseUrl || !config.email || !config.apiToken) return null;
  return new JiraCloudClient(config);
}

/** Beschreibung eines Tickets live aus Jira holen (gekürzter Klartext) — für den Durchgeh-Modus. */
export async function fetchIssueDescription(jiraKey: string): Promise<ActionResult<string>> {
  const client = jiraClient();
  if (!client) return fail("Jira ist nicht konfiguriert.");
  try {
    const results = await client.searchIssues(jiraKey);
    const match = results.find((r) => r.jiraKey === jiraKey.toUpperCase());
    if (!match) return fail("Ticket in Jira nicht gefunden.");
    return { ok: true, data: match.description };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Jira-Abfrage fehlgeschlagen.");
  }
}

/** Mitnehmen-Flag und Rest-SP eines offenen Tickets speichern — nur lokal, Jira bleibt unangetastet. */
export async function saveCarryOverMark(
  sprintId: string,
  jiraKey: string,
  takeAlong: boolean,
  remainingPoints: number,
): Promise<ActionResult> {
  if (!Number.isFinite(remainingPoints) || remainingPoints < 0) {
    return fail("Ungültige Rest-Story-Points.");
  }
  const issue = await prisma.issue.findUnique({
    where: { sprintId_jiraKey: { sprintId, jiraKey } },
  });
  if (!issue) return fail("Ticket nicht im Sprint gefunden.");

  await upsertCarryOverMark(sprintId, jiraKey, takeAlong, remainingPoints);
  revalidatePath("/planning");
  return { ok: true };
}

/** Ticket in einen geplanten Sprint verschieben: erst Jira (führende Quelle), dann lokale Sicht nachziehen. */
export async function moveIssueToPlannedSprint(
  sourceSprintId: string,
  jiraKey: string,
  targetSprintId: string,
): Promise<ActionResult> {
  const [source, target] = await Promise.all([
    prisma.sprint.findUnique({ where: { id: sourceSprintId } }),
    prisma.sprint.findUnique({ where: { id: targetSprintId } }),
  ]);
  if (!source || !target) return fail("Sprint nicht gefunden.");
  if (target.state !== "FUTURE") return fail("Zielsprint ist nicht geplant.");
  if (source.teamId !== target.teamId) return fail("Sprints gehören zu verschiedenen Teams.");
  const issue = await prisma.issue.findUnique({
    where: { sprintId_jiraKey: { sprintId: sourceSprintId, jiraKey } },
  });
  if (!issue) return fail("Ticket nicht im Sprint gefunden.");

  const client = jiraClient();
  if (!client) return fail("Jira ist nicht konfiguriert.");
  try {
    await client.moveIssuesToSprint(target.jiraSprintId, [jiraKey]);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Jira-Update fehlgeschlagen.");
  }

  // Der nächste Sync bestätigt den Stand — bis dahin die lokale Sicht nachziehen.
  await prisma.$transaction([
    prisma.issue.deleteMany({ where: { sprintId: targetSprintId, jiraKey } }),
    prisma.issue.update({ where: { id: issue.id }, data: { sprintId: targetSprintId } }),
    prisma.carryOverPlan.deleteMany({ where: { sprintId: sourceSprintId, jiraKey } }),
  ]);
  revalidatePath("/planning");
  revalidatePath("/dashboard");
  revalidatePath("/standup");
  return { ok: true };
}
