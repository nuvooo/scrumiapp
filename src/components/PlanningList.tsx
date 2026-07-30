import { formatPoints } from "@/lib/format";

export interface PlanningIssueView {
  id: string;
  jiraKey: string;
  summary: string;
  issueType: string;
  status: string;
  storyPoints: number;
  url: string | null;
}

/** Unbewertete zuerst, innerhalb der Gruppen bleibt die Eingangsreihenfolge. */
function sorted(issues: PlanningIssueView[]): PlanningIssueView[] {
  return [...issues].sort((a, b) => Number(a.storyPoints > 0) - Number(b.storyPoints > 0));
}

export function PlanningList({ issues }: { issues: PlanningIssueView[] }) {
  const ordered = sorted(issues);
  return (
    <div className="mt-3.5 flex flex-col gap-2">
      {ordered.map((i) => {
        const unestimated = i.storyPoints <= 0;
        return (
          <div
            key={i.jiraKey}
            data-testid={`planning-card-${i.jiraKey}`}
            className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[10px] border px-3.5 py-2.5 ${
              unestimated ? "border-[#4a3a1e] bg-[#171207]" : "border-edge bg-field"
            }`}
          >
            <span className="w-[76px] flex-none font-mono text-[11.5px] text-link">{i.jiraKey}</span>
            <span className="min-w-0 flex-1 truncate text-[13px] text-fg">{i.summary}</span>
            <div className="flex w-full items-center gap-3 md:w-auto md:flex-none">
              <span className="flex-none font-mono text-[10.5px] uppercase tracking-[0.08em] text-faint">
                {i.issueType}
              </span>
              <span className="flex-none rounded-full border border-edge px-2 py-[2px] font-mono text-[10.5px] text-mid">
                {i.status}
              </span>
              {unestimated ? (
                <span className="flex-none rounded-full border border-[#5a4a24] bg-[#241b09] px-2 py-[2px] font-mono text-[10.5px] text-warn">
                  ohne Schätzung
                </span>
              ) : (
                <span className="flex-none rounded-full border border-edge bg-chip px-2 py-[2px] font-mono text-[10.5px] text-fg">
                  {formatPoints(i.storyPoints)} SP
                </span>
              )}
              {i.url && (
                <a
                  href={i.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${i.jiraKey} in Jira öffnen`}
                  title="In Jira öffnen"
                  className="ml-auto flex-none rounded-md p-1 text-faint hover:bg-chip hover:text-link md:ml-0"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>
              )}
            </div>
          </div>
        );
      })}
      {ordered.length === 0 && (
        <div className="rounded-[10px] border border-dashed border-edge py-8 text-center text-[13px] text-muted">
          Keine offenen Tickets im geplanten Sprint.
        </div>
      )}
    </div>
  );
}
