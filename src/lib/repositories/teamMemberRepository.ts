import { prisma } from "@/lib/db";
import type { TeamMember } from "@prisma/client";

export function listMembersForTeam(teamId: string): Promise<TeamMember[]> {
  return prisma.teamMember.findMany({ where: { teamId }, orderBy: { name: "asc" } });
}

export function addMember(teamId: string, name: string, defaultPersonDays: number | null = null): Promise<TeamMember> {
  return prisma.teamMember.create({ data: { teamId, name, defaultPersonDays } });
}

export function renameMember(id: string, name: string): Promise<TeamMember> {
  return prisma.teamMember.update({ where: { id }, data: { name } });
}

/** Standard-Personentage eines Mitglieds setzen (null = Vorbelegung aus Sprint-Arbeitstagen). */
export function setMemberDefaultDays(id: string, defaultPersonDays: number | null): Promise<TeamMember> {
  return prisma.teamMember.update({ where: { id }, data: { defaultPersonDays } });
}

export function removeMember(id: string): Promise<TeamMember> {
  return prisma.teamMember.delete({ where: { id } });
}
