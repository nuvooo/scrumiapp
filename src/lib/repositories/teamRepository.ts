import { prisma } from "@/lib/db";
import type { Team } from "@prisma/client";

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
