import { describe, it, expect } from "vitest";
import { buildReportMarkdown, type ReportData } from "./markdown";

const base: ReportData = {
  teamName: "Growth Web",
  sprintName: "Sprint 12",
  state: "CLOSED",
  period: "13.07.2026 – 24.07.2026",
  generatedAt: "30.07.2026",
  committed: 24,
  completed: 20,
  carryOverPoints: 5,
  ticketsDone: 8,
  ticketsTotal: 10,
  bugsClosed: 2,
  bugsTotal: 3,
  plannedPersonDays: 20,
  actualPersonDays: 18,
  capacity: [
    { name: "Ben Maier", planned: 10, actual: 9 },
    { name: "Zoe Klein", planned: 10, actual: 9 },
  ],
  delivered: [
    { jiraKey: "AB-1", summary: "Login bauen", storyPoints: 5, status: "Fertig", url: "https://x.atlassian.net/browse/AB-1" },
  ],
  open: [
    { jiraKey: "AB-2", summary: "Bug fixen", storyPoints: 3, status: "Review", url: null },
  ],
};

describe("buildReportMarkdown", () => {
  it("baut Kopf, Kennzahlen- und Kapazitätstabelle", () => {
    const md = buildReportMarkdown(base);
    expect(md).toContain("# Sprint-Report: Sprint 12");
    expect(md).toContain("**Team:** Growth Web");
    expect(md).toContain("**Zeitraum:** 13.07.2026 – 24.07.2026");
    expect(md).toContain("Abschlussbericht");
    expect(md).toContain("| Commitment | 24 SP |");
    expect(md).toContain("| Geliefert | 20 SP |");
    expect(md).toContain("| Zielerreichung | 83 % |");
    expect(md).toContain("| Differenz | −4 SP |");
    expect(md).toContain("| Carry-Over | 5 SP |");
    expect(md).toContain("| Tickets | 8 von 10 erledigt |");
    expect(md).toContain("| Bugs | 2 von 3 geschlossen |");
    expect(md).toContain("| Kapazität | 18 von 20 PT |");
    expect(md).toContain("| Ben Maier | 10 | 9 | −1 |");
  });

  it("listet Tickets mit Link, Punkten und Status", () => {
    const md = buildReportMarkdown(base);
    expect(md).toContain("## Geliefert (1)");
    expect(md).toContain("- [AB-1](https://x.atlassian.net/browse/AB-1) · Login bauen (5 SP)");
    expect(md).toContain("## Nicht geschafft (1)");
    expect(md).toContain("- AB-2 · Bug fixen (3 SP, Status: Review)");
  });

  it("kennzeichnet den aktiven Sprint als Zwischenstand", () => {
    const md = buildReportMarkdown({ ...base, state: "ACTIVE" });
    expect(md).toContain("Zwischenstand");
    expect(md).not.toContain("Abschlussbericht");
  });

  it("zeigt leere Listen als „– keine –“ und Zielerreichung ohne Commitment als –", () => {
    const md = buildReportMarkdown({ ...base, committed: 0, delivered: [], open: [] });
    expect(md).toContain("| Zielerreichung | – |");
    expect(md).toContain("## Geliefert (0)\n\n– keine –");
    expect(md).toContain("## Nicht geschafft (0)\n\n– keine –");
  });
});
