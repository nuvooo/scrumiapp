import Link from "next/link";
import { prisma } from "@/lib/db";
import { getRoadmap } from "@/lib/repositories/roadmapRepository";
import { monthKey } from "@/lib/view/roadmapGrid";
import { RoadmapEditor, type RoadmapView } from "@/components/roadmap/RoadmapEditor";
import type { RoadmapItemView } from "@/components/roadmap/RoadmapItemDialog";
import type { SidePanelIssue } from "@/components/roadmap/RoadmapSidePanel";

export const dynamic = "force-dynamic";

/** DB-Statuskategorie (TODO/IN_PROGRESS/DONE) → Jira-Kategorie-Key der Roadmap. */
const DB_CATEGORY: Record<string, string> = {
  TODO: "new",
  IN_PROGRESS: "indeterminate",
  DONE: "done",
};

export default async function RoadmapEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const roadmap = await getRoadmap(id);
  if (!roadmap) {
    return (
      <div>
        <h1 className="text-[29px] font-semibold tracking-[-0.028em]">Roadmap</h1>
        <p className="mt-[7px] text-[13px] text-muted">
          Roadmap nicht gefunden —{" "}
          <Link href="/roadmap" className="text-link hover:text-linkhi">
            zurück zur Übersicht
          </Link>
          .
        </p>
      </div>
    );
  }

  const jiraBase = (process.env.JIRA_BASE_URL ?? "").replace(/\/$/, "");

  // Seitenleiste: Board-Tickets des aktiven und der geplanten Sprints, dedupliziert.
  const sprints = await prisma.sprint.findMany({
    where: { teamId: roadmap.teamId, state: { in: ["ACTIVE", "FUTURE"] } },
    include: { issues: { orderBy: { jiraKey: "asc" } } },
  });
  const seen = new Set<string>();
  const sprintIssues: SidePanelIssue[] = [];
  for (const sprint of sprints) {
    for (const issue of sprint.issues) {
      if (!issue.onBoard || seen.has(issue.jiraKey)) continue;
      seen.add(issue.jiraKey);
      sprintIssues.push({
        jiraKey: issue.jiraKey,
        summary: issue.summary,
        issueType: issue.issueType,
        statusLabel: issue.status,
        statusCategory: DB_CATEGORY[issue.statusCategory] ?? null,
      });
    }
  }

  const items: RoadmapItemView[] = roadmap.lanes.flatMap((lane) =>
    lane.items.map((item) => ({
      id: item.id,
      laneId: lane.id,
      jiraKey: item.jiraKey,
      issueType: item.issueType,
      title: item.title,
      description: item.description,
      startMonth: monthKey(item.startMonth),
      endMonth: monthKey(item.endMonth),
      statusCategory: item.statusCategory,
      statusLabel: item.statusLabel,
      position: item.position,
      url: item.jiraKey && jiraBase ? `${jiraBase}/browse/${item.jiraKey}` : null,
    })),
  );

  const view: RoadmapView = {
    id: roadmap.id,
    name: roadmap.name,
    startMonth: monthKey(roadmap.startMonth),
    endMonth: monthKey(roadmap.endMonth),
    lanes: roadmap.lanes.map((l) => ({ id: l.id, name: l.name })),
    items,
  };

  return (
    <div>
      <div className="mb-3 text-[12.5px]">
        <Link href={`/roadmap?team=${roadmap.teamId}`} className="text-link hover:text-linkhi">
          ← Alle Roadmaps
        </Link>
      </div>
      <RoadmapEditor roadmap={view} sprintIssues={sprintIssues} teamId={roadmap.teamId} />
    </div>
  );
}
