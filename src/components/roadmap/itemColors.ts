/** Statusfarben und Typ-Badges der Roadmap-Balken (Editor + Gesamtübersicht). */

export function barClasses(statusCategory: string | null): string {
  if (statusCategory === "done") return "border-[#2a4a33] bg-[#0e1d13] text-ok";
  if (statusCategory === "indeterminate") return "border-[#24404a] bg-[#0a1418] text-link";
  return "border-edge bg-chip text-mid";
}

export function typeBadge(item: { jiraKey: string | null; issueType: string | null }): string {
  if (!item.jiraKey) return "Ziel";
  return item.issueType?.toLowerCase() === "epic" ? "Epic" : "Ticket";
}
