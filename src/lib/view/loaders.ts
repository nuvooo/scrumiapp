import { listTeams, getTeam } from "@/lib/repositories/teamRepository";
import { listSprintsForTeam } from "@/lib/repositories/sprintRepository";
import { listBurndownForSprint } from "@/lib/repositories/burndownRepository";
import { listCapacityForSprint } from "@/lib/repositories/capacityRepository";
import { prisma } from "@/lib/db";
import { toDomainSprint, toDomainBurndownPoint, toDomainCapacityEntry } from "./mappers";
import { calcBurndown, calcBugBurndown } from "@/lib/metrics/burndown";
import { calcVelocityTrend } from "@/lib/metrics/velocity";
import { calcCapacityEfficiency } from "@/lib/metrics/capacity";
import { calcCarryOver } from "@/lib/metrics/carryOver";

export async function loadTeams() {
  return listTeams();
}

export async function loadSprints(teamId: string) {
  return listSprintsForTeam(teamId);
}

export async function loadTeamWithSyncStatus(teamId: string) {
  return getTeam(teamId);
}

export async function loadDashboard(sprintId: string) {
  const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
  if (!sprint) return null;
  const domain = toDomainSprint(sprint);
  const caps = (await listCapacityForSprint(sprintId)).map(toDomainCapacityEntry);
  const capacity = calcCapacityEfficiency(domain, caps);
  return {
    sprintName: sprint.name,
    velocity: sprint.completedPoints,
    committed: sprint.committedPoints,
    carriedOver: calcCarryOver(domain),
    totalPersonDays: capacity.totalPersonDays,
    efficiency: capacity.efficiency,
  };
}

export async function loadBurndown(sprintId: string) {
  const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
  if (!sprint) return null;
  const domain = toDomainSprint(sprint);
  const points = (await listBurndownForSprint(sprintId)).map(toDomainBurndownPoint);
  const burndown = calcBurndown(domain, points);
  const bugBurndown = calcBugBurndown(domain, points);
  return { sprintName: sprint.name, ...burndown, bugBurndown };
}

export async function loadVelocity(teamId: string) {
  const sprints = (await listSprintsForTeam(teamId))
    .filter((s) => s.state !== "FUTURE")
    .map(toDomainSprint);
  return calcVelocityTrend(sprints);
}

export async function loadCapacity(sprintId: string) {
  const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
  if (!sprint) return null;
  const entries = await listCapacityForSprint(sprintId);
  const domainEntries = entries.map(toDomainCapacityEntry);
  const result = calcCapacityEfficiency(toDomainSprint(sprint), domainEntries);
  return {
    sprintName: sprint.name,
    completedPoints: sprint.completedPoints,
    entries: entries.map((e) => ({ id: e.id, name: e.name, personDays: e.personDays })),
    ...result,
  };
}
