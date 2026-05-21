import { prisma } from "@/lib/db";
import type { BurndownPoint } from "@prisma/client";

/** Normalisiert ein Datum auf Mitternacht UTC (ein Punkt pro Kalendertag). */
function atMidnightUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function recordBurndownPoint(
  sprintId: string,
  date: Date,
  remainingPoints: number,
  completedPoints: number,
  remainingBugs: number,
): Promise<BurndownPoint> {
  const day = atMidnightUtc(date);
  return prisma.burndownPoint.upsert({
    where: { sprintId_date: { sprintId, date: day } },
    create: { sprintId, date: day, remainingPoints, completedPoints, remainingBugs },
    update: { remainingPoints, completedPoints, remainingBugs },
  });
}

export function listBurndownForSprint(sprintId: string): Promise<BurndownPoint[]> {
  return prisma.burndownPoint.findMany({ where: { sprintId }, orderBy: { date: "asc" } });
}
