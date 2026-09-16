import Link from "next/link";
import { prisma } from "@/lib/db";
import { getRoadmap } from "@/lib/repositories/roadmapRepository";
import { dayKey } from "@/lib/view/roadmapDays";
import { RoadmapEditor } from "@/components/roadmap/RoadmapEditor";
import type { RoadmapItemView, RoadmapView } from "@/components/roadmap/types";
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

  // Offcanvas: Board-Tickets des aktiven und der geplanten Sprints, dedupliziert.
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
        storyPoints: issue.storyPoints,
        assignee: issue.assignee,
      });
    }
  }

  const items: RoadmapItemView[] = roadmap.items.map((item) => ({
    id: item.id,
    laneId: item.laneId,
    blockId: item.blockId,
    jiraKey: item.jiraKey,
    issueType: item.issueType,
    title: item.title,
    description: item.description,
    startDate: dayKey(item.startDate),
    endDate: dayKey(item.endDate),
    statusCategory: item.statusCategory,
    statusLabel: item.statusLabel,
    position: item.position,
    url: item.jiraKey && jiraBase ? `${jiraBase}/browse/${item.jiraKey}` : null,
    storyPoints: item.storyPoints,
    assignee: item.assignee,
    blockedBy: item.blockedBy,
    labelIds: item.labels.map((l) => l.id),
  }));

  const view: RoadmapView = {
    id: roadmap.id,
    name: roadmap.name,
    startDate: dayKey(roadmap.startDate),
    endDate: dayKey(roadmap.endDate),
    lanes: roadmap.lanes.map((l) => ({ id: l.id, name: l.name })),
    blocks: roadmap.blocks.map((b) => ({ id: b.id, parentId: b.parentId, name: b.name, hue: b.hue, position: b.position })),
    items,
    labels: roadmap.labels.map((l) => ({ id: l.id, name: l.name, color: l.color })),
    milestones: roadmap.milestones.map((m) => ({ id: m.id, title: m.title, date: dayKey(m.date), color: m.color })),
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
