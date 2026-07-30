import { formatPoints, formatDelta } from "@/lib/format";

export interface ReportIssue {
  jiraKey: string;
  summary: string;
  storyPoints: number;
  status: string;
  /** Link zum Ticket in Jira (null, wenn keine Basis-URL konfiguriert ist). */
  url: string | null;
}

export interface ReportData {
  teamName: string;
  sprintName: string;
  /** ACTIVE ⇒ Zwischenstand, CLOSED ⇒ Abschlussbericht. */
  state: "ACTIVE" | "CLOSED";
  /** Vorformatierter Sprint-Zeitraum, z. B. "13.07.2026 – 24.07.2026" ("" = unbekannt). */
  period: string;
  /** Vorformatiertes Generierungsdatum. */
  generatedAt: string;
  committed: number;
  completed: number;
  carryOverPoints: number;
  ticketsDone: number;
  ticketsTotal: number;
  bugsClosed: number;
  bugsTotal: number;
  plannedPersonDays: number;
  actualPersonDays: number;
  capacity: { name: string; planned: number; actual: number }[];
  delivered: ReportIssue[];
  open: ReportIssue[];
}

export function reportBadge(state: ReportData["state"]): string {
  return state === "CLOSED" ? "Abschlussbericht" : "Zwischenstand";
}

function issueLine(i: ReportIssue, withStatus: boolean): string {
  const key = i.url ? `[${i.jiraKey}](${i.url})` : i.jiraKey;
  const meta = withStatus
    ? `${formatPoints(i.storyPoints)} SP, Status: ${i.status}`
    : `${formatPoints(i.storyPoints)} SP`;
  return `- ${key} · ${i.summary} (${meta})`;
}

function issueList(issues: ReportIssue[], withStatus: boolean): string {
  if (issues.length === 0) return "– keine –";
  return issues.map((i) => issueLine(i, withStatus)).join("\n");
}

/** Sprint-Report als Markdown — für Wiki/Confluence/Teams, ohne Charts. */
export function buildReportMarkdown(d: ReportData): string {
  const quote =
    d.committed > 0 ? `${Math.round((d.completed / d.committed) * 100)} %` : "–";
  const kpis: [string, string][] = [
    ["Commitment", `${formatPoints(d.committed)} SP`],
    ["Geliefert", `${formatPoints(d.completed)} SP`],
    ["Zielerreichung", quote],
    ["Differenz", `${formatDelta(d.completed - d.committed)} SP`],
    ["Carry-Over", `${formatPoints(d.carryOverPoints)} SP`],
    ["Tickets", `${d.ticketsDone} von ${d.ticketsTotal} erledigt`],
    ["Bugs", `${d.bugsClosed} von ${d.bugsTotal} geschlossen`],
    ["Kapazität", `${formatPoints(d.actualPersonDays)} von ${formatPoints(d.plannedPersonDays)} PT`],
  ];

  const capacityRows = d.capacity
    .map(
      (m) =>
        `| ${m.name} | ${formatPoints(m.planned)} | ${formatPoints(m.actual)} | ${formatDelta(m.actual - m.planned)} |`,
    )
    .join("\n");

  return [
    `# Sprint-Report: ${d.sprintName}`,
    "",
    [
      `**Team:** ${d.teamName}`,
      d.period ? `**Zeitraum:** ${d.period}` : null,
      `**Stand:** ${reportBadge(d.state)} (${d.generatedAt})`,
    ]
      .filter(Boolean)
      .join(" · "),
    "",
    "## Kennzahlen",
    "",
    "| Kennzahl | Wert |",
    "| --- | --- |",
    ...kpis.map(([k, v]) => `| ${k} | ${v} |`),
    "",
    "## Kapazität",
    "",
    "| Mitglied | PT Soll | PT Ist | Delta |",
    "| --- | ---: | ---: | ---: |",
    capacityRows || "| – | – | – | – |",
    "",
    `## Geliefert (${d.delivered.length})`,
    "",
    issueList(d.delivered, false),
    "",
    `## Nicht geschafft (${d.open.length})`,
    "",
    issueList(d.open, true),
    "",
  ].join("\n");
}
