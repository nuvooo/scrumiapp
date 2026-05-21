import type { Sprint, BurndownPoint, CapacityEntry } from "@prisma/client";
import type { DomainSprint, DomainBurndownPoint, DomainCapacityEntry } from "@/lib/domain/types";

export function toDomainSprint(s: Sprint): DomainSprint {
  return {
    id: s.id,
    name: s.name,
    state: s.state,
    startDate: s.startDate,
    endDate: s.endDate,
    completeDate: s.completeDate,
    committedPoints: s.committedPoints,
    completedPoints: s.completedPoints,
  };
}

export function toDomainBurndownPoint(p: BurndownPoint): DomainBurndownPoint {
  return {
    date: p.date,
    remainingPoints: p.remainingPoints,
    completedPoints: p.completedPoints,
    remainingBugs: p.remainingBugs,
    remainingTickets: p.remainingTickets,
  };
}

export function toDomainCapacityEntry(c: CapacityEntry): DomainCapacityEntry {
  return {
    teamMemberId: c.teamMemberId,
    name: c.name,
    plannedPersonDays: c.plannedPersonDays,
    actualPersonDays: c.actualPersonDays,
  };
}
