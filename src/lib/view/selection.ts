export interface HasId {
  id: string;
}
export interface SprintLike extends HasId {
  state: "ACTIVE" | "CLOSED" | "FUTURE";
}

export function resolveTeamId<T extends HasId>(teams: T[], queryTeam: string | undefined): string | undefined {
  if (queryTeam && teams.some((t) => t.id === queryTeam)) return queryTeam;
  return teams[0]?.id;
}

export function resolveSprintId<T extends SprintLike>(sprints: T[], querySprint: string | undefined): string | undefined {
  if (querySprint && sprints.some((s) => s.id === querySprint)) return querySprint;
  const active = sprints.find((s) => s.state === "ACTIVE");
  if (active) return active.id;
  return sprints[sprints.length - 1]?.id;
}
