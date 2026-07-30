import { listTeams, getTeam, listTeamsWithMembers } from "@/lib/repositories/teamRepository";
import { listSprintsForTeam } from "@/lib/repositories/sprintRepository";
import { listBurndownForSprint } from "@/lib/repositories/burndownRepository";
import { listCapacityForSprint, listCapacityForSprints } from "@/lib/repositories/capacityRepository";
import { prisma } from "@/lib/db";
import { toDomainSprint, toDomainBurndownPoint } from "./mappers";
import { calcBurndown, calcBugBurndown, calcTicketBurndown } from "@/lib/metrics/burndown";
import { calcVelocityTrend } from "@/lib/metrics/velocity";
import { calcCapacityEfficiency, scaleToSprintLength, typicalSprintLength } from "@/lib/metrics/capacity";
import { calcForecast } from "@/lib/metrics/forecast";
import { calcCarryOver } from "@/lib/metrics/carryOver";
import { calcCelebration, type CelebrationEffect } from "@/lib/metrics/celebration";
import { buildStandupGroups, previousWorkingDay, workingDaysInStatus, STALE_AFTER_WORKING_DAYS } from "@/lib/metrics/standup";
import { workingDaysBetween } from "@/lib/metrics/workingDays";
import { getBugIssueTypes } from "@/lib/jira/jiraClient";
import type { ReportData, ReportIssue } from "@/lib/report/markdown";
import { calcPlanning } from "@/lib/metrics/planning";

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

/**
 * Prognose für einen Sprint: gepoolte Effizienz der abgeschlossenen Sprints des Teams
 * (ohne den betrachteten Sprint) × geplante Personentage. Respektiert metricsSince.
 */
async function loadForecast(teamId: string, excludeSprintId: string, plannedPersonDays: number) {
  const closed = (await listSprintsForTeam(teamId)).filter(
    (s) => s.state === "CLOSED" && s.id !== excludeSprintId,
  );
  const caps = await listCapacityForSprints(closed.map((s) => s.id));
  const actualBySprint = new Map<string, number>();
  for (const c of caps) {
    actualBySprint.set(c.sprintId, (actualBySprint.get(c.sprintId) ?? 0) + c.actualPersonDays);
  }
  return calcForecast(
    closed.map((s) => ({ velocity: s.completedPoints, actualPersonDays: actualBySprint.get(s.id) ?? 0 })),
    plannedPersonDays,
  );
}

/**
 * Effektive Kapazitätszeilen eines Sprints: gespeicherte Roster-Einträge, sonst
 * Vorbelegung aus Standard-PT (anteilig zur typischen Sprintlänge des Teams
 * skaliert) bzw. Sprint-Arbeitstagen.
 */
function effectiveCapacityRows(
  members: { id: string; name: string; defaultPersonDays: number | null }[],
  entries: { teamMemberId: string | null; plannedPersonDays: number; actualPersonDays: number }[],
  workingDayCount: number,
  referenceDayCount: number,
) {
  const byMember = new Map(entries.filter((e) => e.teamMemberId).map((e) => [e.teamMemberId as string, e]));
  return members.map((m) => {
    const e = byMember.get(m.id);
    const fallback =
      m.defaultPersonDays !== null
        ? scaleToSprintLength(m.defaultPersonDays, workingDayCount, referenceDayCount)
        : workingDayCount;
    return {
      teamMemberId: m.id,
      name: m.name,
      plannedPersonDays: e ? e.plannedPersonDays : fallback,
      actualPersonDays: e ? e.actualPersonDays : fallback,
    };
  });
}

interface SprintWindowSource {
  startDate: Date | null;
  endDate: Date | null;
  completeDate: Date | null;
}

interface ScopedIssue {
  jiraKey: string;
  storyPoints: number;
  statusCategory: string;
  onBoard: boolean;
  resolvedAt: Date | null;
}

/** Im Sprint-Zeitraum erledigt (resolvedAt zwischen Start und completeDate/endDate). */
function isDoneInSprint(i: ScopedIssue, s: SprintWindowSource): boolean {
  const end = s.completeDate ?? s.endDate;
  return (
    i.statusCategory === "DONE" &&
    i.resolvedAt !== null &&
    s.startDate !== null &&
    i.resolvedAt >= s.startDate &&
    (end === null || i.resolvedAt <= end)
  );
}

/** Issues, die zum Commitment zählen: offen auf dem Board oder im Zeitraum erledigt. */
function committedIssuesOf<T extends ScopedIssue>(issues: T[], s: SprintWindowSource): T[] {
  return issues.filter((i) => (i.statusCategory !== "DONE" && i.onBoard) || isDoneInSprint(i, s));
}

/** Der zeitlich vorangegangene abgeschlossene Sprint (für Carry-Over). */
function previousClosedSprint<T extends SprintWindowSource & { state: string }>(
  sprints: T[],
  current: SprintWindowSource,
): T | undefined {
  return sprints
    .filter((s) => s.state === "CLOSED" && s.startDate && current.startDate && s.startDate < current.startDate)
    .sort((a, b) => (b.startDate as Date).getTime() - (a.startDate as Date).getTime())[0];
}

/** Typische Sprintlänge (Median der Arbeitstage) der abgeschlossenen Sprints. */
function referenceDaysFromSprints(
  sprints: { state: string; startDate: Date | null; endDate: Date | null }[],
): number {
  return typicalSprintLength(
    sprints
      .filter((s) => s.state === "CLOSED" && s.startDate && s.endDate)
      .map((s) => workingDaysBetween(s.startDate as Date, s.endDate as Date).length),
  );
}

export async function loadDashboard(sprintId: string) {
  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
    include: { team: { include: { members: { orderBy: { name: "asc" } } } }, issues: true },
  });
  if (!sprint) return null;
  const domain = toDomainSprint(sprint);

  const days =
    sprint.startDate && sprint.endDate ? workingDaysBetween(sprint.startDate, sprint.endDate) : [];
  const entries = await listCapacityForSprint(sprintId);
  const teamSprints = await listSprintsForTeam(sprint.teamId);
  const capacityRows = effectiveCapacityRows(
    sprint.team.members,
    entries,
    days.length,
    referenceDaysFromSprints(teamSprints),
  );
  const capacity = calcCapacityEfficiency(domain, capacityRows);
  const forecast = await loadForecast(sprint.teamId, sprintId, capacity.totalPlanned);
  const today = Date.now();
  const dayIndex = days.filter((d) => d.getTime() <= today).length;

  // Offene Arbeit zählt nur, was die Jira-Board-Ansicht zeigt (onBoard);
  // Erledigtes nur, was im Sprint-Zeitraum erledigt wurde — dem Sprint zugeordnete
  // Altlasten zählen nirgends. Bugs laufen getrennt von den Ticket-Zahlen.
  const bugTypes = getBugIssueTypes();
  const isBug = (i: { issueType: string }) => bugTypes.has(i.issueType.toLowerCase());
  const issues = sprint.issues;
  const doneIssues = issues.filter((i) => isDoneInSprint(i, sprint) && !isBug(i));
  const openOnBoard = issues.filter((i) => i.statusCategory !== "DONE" && i.onBoard && !isBug(i));
  const doneBugs = issues.filter((i) => isDoneInSprint(i, sprint) && isBug(i));
  const openBugsOnBoard = issues.filter((i) => i.statusCategory !== "DONE" && i.onBoard && isBug(i));

  // Carry-Over: Punkte der Commitment-Issues, die schon im Vorsprint waren.
  const committedIssues = committedIssuesOf(issues, sprint);
  const previous = previousClosedSprint(teamSprints, sprint);
  const previousKeys = previous
    ? new Set(
        (
          await prisma.issue.findMany({ where: { sprintId: previous.id }, select: { jiraKey: true } })
        ).map((i) => i.jiraKey),
      )
    : new Set<string>();

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
    carriedOver: calcCarryOver(committedIssues, previousKeys),
    totalPlanned: capacity.totalPlanned,
    totalActual: capacity.totalActual,
    efficiency: capacity.efficiency,
    forecast,
    tickets: {
      total: doneIssues.length + openOnBoard.length,
      done: doneIssues.length,
      openPoints: openOnBoard.reduce((sum, i) => sum + i.storyPoints, 0),
    },
    bugs: {
      total: doneBugs.length + openBugsOnBoard.length,
      closed: doneBugs.length,
    },
  };
}

/**
 * Feier-Effekt für Dashboard und Burndown: Feuerwerk bei 0 offenen Tickets,
 * Feenstaub, wenn der Vortag auf/unter der Ideallinie des Ticket-Burndowns lag.
 */
export async function loadCelebration(sprintId: string): Promise<CelebrationEffect | null> {
  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
    include: { issues: true },
  });
  if (!sprint) return null;

  const points = (await listBurndownForSprint(sprintId)).map(toDomainBurndownPoint);
  const ticketBurndown = calcTicketBurndown(toDomainSprint(sprint), points);

  const bugTypes = getBugIssueTypes();
  const isBug = (i: { issueType: string }) => bugTypes.has(i.issueType.toLowerCase());
  const openTickets = sprint.issues.filter(
    (i) => i.statusCategory !== "DONE" && i.onBoard && !isBug(i),
  ).length;
  const doneTickets = sprint.issues.filter((i) => isDoneInSprint(i, sprint) && !isBug(i)).length;

  return calcCelebration({
    sprintState: sprint.state,
    ticketBurndown,
    openTickets,
    totalTickets: openTickets + doneTickets,
    today: new Date(),
  });
}

/**
 * Standup-Daten für den aktiven Sprint eines Teams: Gruppen je Bearbeiter mit
 * offenen Board-Tickets und seit dem letzten Arbeitstag erledigten Tickets.
 */
export async function loadStandup(teamId: string) {
  const sprint = await prisma.sprint.findFirst({
    where: { teamId, state: "ACTIVE" },
    include: { issues: true },
  });
  if (!sprint) return null;

  const jiraBase = (process.env.JIRA_BASE_URL ?? "").replace(/\/$/, "");
  const now = new Date();
  const toView = (i: {
    jiraKey: string;
    summary: string;
    issueType: string;
    status: string;
    statusCategory: string;
    statusSince: Date | null;
  }) => {
    const days =
      i.statusCategory !== "DONE" && i.statusSince !== null
        ? workingDaysInStatus(i.statusSince, now)
        : null;
    return {
      jiraKey: i.jiraKey,
      summary: i.summary,
      issueType: i.issueType,
      status: i.status,
      url: jiraBase ? `${jiraBase}/browse/${i.jiraKey}` : null,
      daysInStatus: days,
      stale: days !== null && days > STALE_AFTER_WORKING_DAYS,
    };
  };
  const team = await prisma.team.findUnique({ where: { id: teamId }, include: { members: true } });
  const memberNames = (team?.members ?? []).map((m) => m.name);
  const groups = buildStandupGroups(sprint.issues, previousWorkingDay(new Date()), memberNames);
  return {
    sprintName: sprint.name,
    groups: groups.map((g) => ({
      name: g.name,
      openIssues: g.openIssues.map(toView),
      doneIssues: g.doneIssues.map(toView),
    })),
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
  const all = await listSprintsForTeam(teamId);
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { members: { orderBy: { name: "asc" } } },
  });
  const members = team?.members ?? [];
  const caps = await listCapacityForSprints(all.map((s) => s.id));

  const plannedBySprint = new Map<string, number>();
  const actualBySprint = new Map<string, number>();
  const sprintsWithEntries = new Set<string>();
  for (const c of caps) {
    sprintsWithEntries.add(c.sprintId);
    plannedBySprint.set(c.sprintId, (plannedBySprint.get(c.sprintId) ?? 0) + c.plannedPersonDays);
    actualBySprint.set(c.sprintId, (actualBySprint.get(c.sprintId) ?? 0) + c.actualPersonDays);
  }

  // Carry-Over je Sprint: Commitment-Issues, die schon im Vorsprint enthalten waren.
  const issueRows = await prisma.issue.findMany({
    where: { sprintId: { in: all.map((s) => s.id) } },
    select: { sprintId: true, jiraKey: true, storyPoints: true, statusCategory: true, onBoard: true, resolvedAt: true },
  });
  const issuesBySprint = new Map<string, typeof issueRows>();
  for (const row of issueRows) {
    const list = issuesBySprint.get(row.sprintId) ?? [];
    list.push(row);
    issuesBySprint.set(row.sprintId, list);
  }
  const carryOverOf = (s: (typeof all)[number]) => {
    const previous = previousClosedSprint(all, s);
    if (!previous) return 0;
    const previousKeys = new Set((issuesBySprint.get(previous.id) ?? []).map((i) => i.jiraKey));
    return calcCarryOver(committedIssuesOf(issuesBySprint.get(s.id) ?? [], s), previousKeys);
  };

  const nonFuture = all.filter((s) => s.state !== "FUTURE");
  const inputs = nonFuture.map((s) => ({
    sprint: toDomainSprint(s),
    carriedOver: carryOverOf(s),
    plannedPersonDays: plannedBySprint.get(s.id) ?? 0,
    actualPersonDays: actualBySprint.get(s.id) ?? 0,
  }));
  const trend = calcVelocityTrend(inputs);

  // Prognose je Sprint: gepoolte Effizienz aller anderen abgeschlossenen Sprints ×
  // Soll-PT des Sprints (gespeichert oder aus der Roster-Vorbelegung).
  const closedHistory = all
    .filter((s) => s.state === "CLOSED")
    .map((s) => ({ id: s.id, velocity: s.completedPoints, actualPersonDays: actualBySprint.get(s.id) ?? 0 }));

  const referenceDayCount = referenceDaysFromSprints(all);
  const formatDay = (d: Date) =>
    d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });

  const rows = all.map((s) => {
    const workingDayCount =
      s.startDate && s.endDate ? workingDaysBetween(s.startDate, s.endDate).length : 0;
    const planned = sprintsWithEntries.has(s.id)
      ? plannedBySprint.get(s.id) ?? 0
      : effectiveCapacityRows(members, [], workingDayCount, referenceDayCount).reduce(
          (sum, r) => sum + r.plannedPersonDays,
          0,
        );
    const forecast = calcForecast(
      closedHistory.filter((h) => h.id !== s.id),
      planned,
    );
    return {
      sprintId: s.id,
      name: s.name,
      state: s.state,
      period: s.startDate && s.endDate ? `${formatDay(s.startDate)} – ${formatDay(s.endDate)}` : "–",
      committed: s.committedPoints,
      completed: s.completedPoints,
      plannedPersonDays: planned,
      forecast: forecast ? forecast.possiblePoints : null,
    };
  });

  return { ...trend, rows };
}

export async function loadCapacity(sprintId: string) {
  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
    include: { team: { include: { members: { orderBy: { name: "asc" } } } } },
  });
  if (!sprint) return null;

  const entries = await listCapacityForSprint(sprintId);
  const workingDayCount =
    sprint.startDate && sprint.endDate ? workingDaysBetween(sprint.startDate, sprint.endDate).length : 0;

  const teamSprints = await listSprintsForTeam(sprint.teamId);
  const rows = effectiveCapacityRows(
    sprint.team.members,
    entries,
    workingDayCount,
    referenceDaysFromSprints(teamSprints),
  );
  const result = calcCapacityEfficiency(toDomainSprint(sprint), rows);

  return { sprintName: sprint.name, completedPoints: sprint.completedPoints, rows, ...result };
}

/**
 * Planning-Daten: der nächste geplante Sprint des Teams (frühestes startDate,
 * sonst Name) mit seinen offenen Board-Tickets, dem Forecast aus Kapazität ×
 * gepoolter Effizienz und dem Planungs-Check. null ohne geplanten Sprint.
 */
export async function loadPlanning(teamId: string) {
  const future = await prisma.sprint.findMany({
    where: { teamId, state: "FUTURE" },
    include: { issues: { orderBy: { jiraKey: "asc" } } },
  });
  if (future.length === 0) return null;
  const sprint = [...future].sort((a, b) => {
    if (a.startDate && b.startDate) return a.startDate.getTime() - b.startDate.getTime();
    if (a.startDate) return -1;
    if (b.startDate) return 1;
    return a.name.localeCompare(b.name, "de");
  })[0];

  const cap = await loadCapacity(sprint.id);
  const totalPlanned = cap?.totalPlanned ?? 0;
  const forecast =
    totalPlanned > 0 ? (await loadForecast(teamId, sprint.id, totalPlanned))?.possiblePoints ?? null : null;
  const summary = calcPlanning(sprint.issues, forecast);

  const jiraBase = (process.env.JIRA_BASE_URL ?? "").replace(/\/$/, "");
  const issues = sprint.issues
    .filter((i) => i.statusCategory !== "DONE" && i.onBoard)
    .map((i) => ({
      id: i.id,
      jiraKey: i.jiraKey,
      summary: i.summary,
      issueType: i.issueType,
      status: i.status,
      storyPoints: i.storyPoints,
      url: jiraBase ? `${jiraBase}/browse/${i.jiraKey}` : null,
    }));

  return {
    sprintId: sprint.id,
    sprintName: sprint.name,
    startDate: sprint.startDate,
    forecast,
    totalPlanned,
    summary,
    issues,
  };
}

/**
 * Sprint-Report: KPIs und Carry-Over aus dem Dashboard, Kapazitätszeilen aus
 * loadCapacity, dazu die Ticket-Listen „Geliefert" (im Sprint-Zeitraum
 * erledigt) und „Nicht geschafft" (offen auf dem Board). Geplante Sprints
 * haben nichts zu berichten.
 */
export async function loadReport(
  sprintId: string,
): Promise<
  | null
  | { state: "FUTURE"; sprintName: string }
  | { state: "ACTIVE" | "CLOSED"; data: ReportData }
> {
  const dash = await loadDashboard(sprintId);
  if (!dash) return null;
  if (dash.sprintState === "FUTURE") return { state: "FUTURE", sprintName: dash.sprintName };

  const cap = await loadCapacity(sprintId);
  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
    include: { issues: { orderBy: { jiraKey: "asc" } } },
  });
  if (!cap || !sprint) return null;

  const jiraBase = (process.env.JIRA_BASE_URL ?? "").replace(/\/$/, "");
  const toReportIssue = (i: {
    jiraKey: string;
    summary: string;
    storyPoints: number;
    status: string;
  }): ReportIssue => ({
    jiraKey: i.jiraKey,
    summary: i.summary,
    storyPoints: i.storyPoints,
    status: i.status,
    url: jiraBase ? `${jiraBase}/browse/${i.jiraKey}` : null,
  });
  const delivered = sprint.issues.filter((i) => isDoneInSprint(i, sprint)).map(toReportIssue);
  const open = sprint.issues
    .filter((i) => i.statusCategory !== "DONE" && i.onBoard)
    .map(toReportIssue);

  const fmt = (d: Date) => d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  const period = dash.startDate && dash.endDate ? `${fmt(dash.startDate)} – ${fmt(dash.endDate)}` : "";
  const state = dash.sprintState as "ACTIVE" | "CLOSED";

  return {
    state,
    data: {
      teamName: dash.teamName,
      sprintName: dash.sprintName,
      state,
      period,
      generatedAt: fmt(new Date()),
      committed: dash.committed,
      completed: dash.velocity,
      carryOverPoints: dash.carriedOver,
      ticketsDone: dash.tickets.done,
      ticketsTotal: dash.tickets.total,
      bugsClosed: dash.bugs.closed,
      bugsTotal: dash.bugs.total,
      plannedPersonDays: dash.totalPlanned,
      actualPersonDays: dash.totalActual,
      capacity: cap.rows.map((r) => ({
        name: r.name,
        planned: r.plannedPersonDays,
        actual: r.actualPersonDays,
      })),
      delivered,
      open,
    },
  };
}

/**
 * Prognose für die Velocity-Seite: Ziel ist der aktive, sonst der nächste geplante
 * Sprint. Geplante PT kommen aus dem (ggf. vorbelegten) Kapazitäts-Roster.
 */
export async function loadVelocityForecast(teamId: string) {
  const sprints = await listSprintsForTeam(teamId);
  const target = sprints.find((s) => s.state === "ACTIVE") ?? sprints.find((s) => s.state === "FUTURE");
  if (!target) return null;

  const sprint = await prisma.sprint.findUnique({
    where: { id: target.id },
    include: { team: { include: { members: { orderBy: { name: "asc" } } } } },
  });
  if (!sprint) return null;

  const workingDayCount =
    sprint.startDate && sprint.endDate ? workingDaysBetween(sprint.startDate, sprint.endDate).length : 0;
  const entries = await listCapacityForSprint(sprint.id);
  const rows = effectiveCapacityRows(
    sprint.team.members,
    entries,
    workingDayCount,
    referenceDaysFromSprints(sprints),
  );
  const plannedPersonDays = rows.reduce((sum, r) => sum + r.plannedPersonDays, 0);

  const forecast = await loadForecast(teamId, sprint.id, plannedPersonDays);
  if (!forecast) return null;
  return { sprintName: sprint.name, plannedPersonDays, ...forecast };
}
