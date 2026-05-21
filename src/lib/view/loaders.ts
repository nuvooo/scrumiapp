import { listTeams, getTeam, listTeamsWithMembers } from "@/lib/repositories/teamRepository";
import { listSprintsForTeam } from "@/lib/repositories/sprintRepository";
import { listBurndownForSprint } from "@/lib/repositories/burndownRepository";
import { listCapacityForSprint, listCapacityForSprints } from "@/lib/repositories/capacityRepository";
import { prisma } from "@/lib/db";
import { toDomainSprint, toDomainBurndownPoint, toDomainCapacityEntry } from "./mappers";
import { calcBurndown, calcBugBurndown } from "@/lib/metrics/burndown";
import { calcVelocityTrend } from "@/lib/metrics/velocity";
import { calcCapacityEfficiency } from "@/lib/metrics/capacity";
import { calcCarryOver } from "@/lib/metrics/carryOver";
import { workingDaysBetween } from "@/lib/metrics/workingDays";

export async function loadTeams() {
  return listTeams();
}

export async function loadSprints(teamId: string) {
  return listSprintsForTeam(teamId);
}

export async function loadTeamWithSyncStatus(teamId: string) {
  return getTeam(teamId);
}

export async function loadTeamsWithMembers() {
  return listTeamsWithMembers();
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
    totalPlanned: capacity.totalPlanned,
    totalActual: capacity.totalActual,
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
  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
    include: { team: { include: { members: { orderBy: { name: "asc" } } } } },
  });
  if (!sprint) return null;

  const entries = await listCapacityForSprint(sprintId);
  const byMember = new Map(entries.filter((e) => e.teamMemberId).map((e) => [e.teamMemberId as string, e]));
  const defaultSoll =
    sprint.startDate && sprint.endDate ? workingDaysBetween(sprint.startDate, sprint.endDate).length : 0;

  const rows = sprint.team.members.map((m) => {
    const e = byMember.get(m.id);
    return {
      teamMemberId: m.id,
      name: m.name,
      plannedPersonDays: e ? e.plannedPersonDays : defaultSoll,
      actualPersonDays: e ? e.actualPersonDays : defaultSoll,
    };
  });

  const domainEntries = rows.map((r) => ({
    teamMemberId: r.teamMemberId,
    name: r.name,
    plannedPersonDays: r.plannedPersonDays,
    actualPersonDays: r.actualPersonDays,
  }));
  const result = calcCapacityEfficiency(toDomainSprint(sprint), domainEntries);

  return { sprintName: sprint.name, completedPoints: sprint.completedPoints, rows, ...result };
}
