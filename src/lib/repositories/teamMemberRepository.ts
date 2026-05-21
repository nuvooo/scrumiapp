import { prisma } from "@/lib/db";
import type { TeamMember } from "@prisma/client";

export function listMembersForTeam(teamId: string): Promise<TeamMember[]> {
  return prisma.teamMember.findMany({ where: { teamId }, orderBy: { name: "asc" } });
}

export function addMember(teamId: string, name: string): Promise<TeamMember> {
  return prisma.teamMember.create({ data: { teamId, name } });
}

export function renameMember(id: string, name: string): Promise<TeamMember> {
  return prisma.teamMember.update({ where: { id }, data: { name } });
}

export function removeMember(id: string): Promise<TeamMember> {
  return prisma.teamMember.delete({ where: { id } });
}
