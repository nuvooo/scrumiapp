import { prisma } from "@/lib/db";
import type { Team, TeamMember } from "@prisma/client";

export interface CreateTeamInput {
  name: string;
  jiraBoardId: string;
  syncIntervalMinutes?: number;
}

export function createTeam(input: CreateTeamInput): Promise<Team> {
  return prisma.team.create({
    data: {
      name: input.name,
      jiraBoardId: input.jiraBoardId,
      syncIntervalMinutes: input.syncIntervalMinutes ?? 60,
    },
  });
}

export function listTeams(): Promise<Team[]> {
  return prisma.team.findMany({ orderBy: { name: "asc" } });
}

export function getTeam(id: string): Promise<Team | null> {
  return prisma.team.findUnique({ where: { id } });
}

export interface SyncStatusUpdate {
  lastSyncedAt?: Date;
  lastSyncError: string | null;
}

/** Aktualisiert den Sync-Status eines Teams (nur übergebene Felder). */
export function updateTeamSyncStatus(teamId: string, status: SyncStatusUpdate): Promise<Team> {
  return prisma.team.update({ where: { id: teamId }, data: status });
}

/** Speichert die Jira-Board-Spalten eines Teams als JSON. */
export function saveTeamBoardColumns(
  teamId: string,
  columns: { name: string; statuses: string[] }[],
): Promise<Team> {
  return prisma.team.update({
    where: { id: teamId },
    data: { boardColumns: JSON.stringify(columns) },
  });
}

export interface UpdateTeamInput {
  name: string;
  jiraBoardId: string;
  syncIntervalMinutes: number;
  /** Stichtag, ab dem Sprints in Auswertungen einfließen (null = alle). */
  metricsSince: Date | null;
}

/** Aktualisiert die Stammdaten eines Teams. */
export function updateTeam(id: string, input: UpdateTeamInput): Promise<Team> {
  return prisma.team.update({ where: { id }, data: input });
}

/** Löscht ein Team samt aller abhängigen Daten (Cascade). */
export function deleteTeam(id: string): Promise<Team> {
  return prisma.team.delete({ where: { id } });
}

/** Teams inklusive ihrer Mitglieder, alphabetisch sortiert. */
export function listTeamsWithMembers(): Promise<(Team & { members: TeamMember[] })[]> {
  return prisma.team.findMany({
    orderBy: { name: "asc" },
    include: { members: { orderBy: { name: "asc" } } },
  });
}
