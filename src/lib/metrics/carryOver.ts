/**
 * Übernommene ("carry-over") Story Points: Punkte der zum Commitment zählenden
 * Issues, die bereits im vorherigen Sprint enthalten waren.
 */
export function calcCarryOver(
  committedIssues: { jiraKey: string; storyPoints: number }[],
  previousSprintKeys: Set<string>,
): number {
  return committedIssues
    .filter((i) => previousSprintKeys.has(i.jiraKey))
    .reduce((sum, i) => sum + i.storyPoints, 0);
}
