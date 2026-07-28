import { listTeams, getTeam, listTeamsWithMembers } from "@/lib/repositories/teamRepository";
import { listSprintsForTeam } from "@/lib/repositories/sprintRepository";
import { listBurndownForSprint } from "@/lib/repositories/burndownRepository";
import { listCapacityForSprint, listCapacityForSprints } from "@/lib/repositories/capacityRepository";
import { prisma } from "@/lib/db";
import { toDomainSprint, toDomainBurndownPoint, toDomainCapacityEntry } from "./mappers";
import { calcBurndown, calcBugBurndown, calcTicketBurndown } from "@/lib/metrics/burndown";
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
  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
    include: { team: true, issues: true },
  });
  if (!sprint) return null;
  const domain = toDomainSprint(sprint);
  const caps = (await listCapacityForSprint(sprintId)).map(toDomainCapacityEntry);
  const capacity = calcCapacityEfficiency(domain, caps);

  const days =
    sprint.startDate && sprint.endDate ? workingDaysBetween(sprint.startDate, sprint.endDate) : [];
  const today = Date.now();
  const dayIndex = days.filter((d) => d.getTime() <= today).length;

  const issues = sprint.issues;
  const openIssues = issues.filter((i) => i.statusCategory !== "DONE");
  const bugs = issues.filter((i) => /bug/i.test(i.issueType));

  return {
    sprintName: sprint.name,
    sprintState: sprint.state,
    teamName: sprint.team.name,
    startDate: sprint.startDate,
    endDate: sprint.endDate,
    workingDayCount: days.length,
    dayIndex: Math.min(Math.max(dayIndex, 0), days.length),
    velocity: sprint.completedPoints,
    committed: sprint.committedPoints,
    carriedOver: calcCarryOver(domain),
    totalPlanned: capacity.totalPlanned,
    totalActual: capacity.totalActual,
    efficiency: capacity.efficiency,
    tickets: {
      total: issues.length,
      done: issues.length - openIssues.length,
      openPoints: openIssues.reduce((sum, i) => sum + i.storyPoints, 0),
    },
    bugs: {
      total: bugs.length,
      closed: bugs.filter((i) => i.statusCategory === "DONE").length,
    },
  };
}

export async function loadBurndown(sprintId: string) {
  const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
  if (!sprint) return null;
  const domain = toDomainSprint(sprint);
  const points = (await listBurndownForSprint(sprintId)).map(toDomainBurndownPoint);
  const burndown = calcBurndown(domain, points);
  const bugBurndown = calcBugBurndown(domain, points);
  const ticketBurndown = calcTicketBurndown(domain, points);
  return { sprintName: sprint.name, ...burndown, bugBurndown, ticketBurndown };
}

export async function loadVelocity(teamId: string) {
  const sprints = (await listSprintsForTeam(teamId)).filter((s) => s.state !== "FUTURE");
  const caps = await listCapacityForSprints(sprints.map((s) => s.id));

  const plannedBySprint = new Map<string, number>();
  const actualBySprint = new Map<string, number>();
  for (const c of caps) {
    plannedBySprint.set(c.sprintId, (plannedBySprint.get(c.sprintId) ?? 0) + c.plannedPersonDays);
    actualBySprint.set(c.sprintId, (actualBySprint.get(c.sprintId) ?? 0) + c.actualPersonDays);
  }

  const inputs = sprints.map((s) => ({
    sprint: toDomainSprint(s),
    plannedPersonDays: plannedBySprint.get(s.id) ?? 0,
    actualPersonDays: actualBySprint.get(s.id) ?? 0,
  }));

  return calcVelocityTrend(inputs);
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
    // Vorbelegung: Standard-PT des Mitglieds, sonst Arbeitstage des Sprints
    const fallback = m.defaultPersonDays ?? defaultSoll;
    return {
      teamMemberId: m.id,
      name: m.name,
      plannedPersonDays: e ? e.plannedPersonDays : fallback,
      actualPersonDays: e ? e.actualPersonDays : fallback,
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
