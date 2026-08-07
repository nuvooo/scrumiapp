import Image from "next/image";
import { BurndownChart, ChartLegend, type BurndownRow } from "@/components/charts/BurndownChart";
import { KpiCard } from "@/components/KpiCard";
import { ReportActions } from "@/components/ReportActions";
import { loadTeams, loadSprints, loadReport, loadBurndown } from "@/lib/view/loaders";
import { resolveTeamId, resolveSprintId, sprintOptions } from "@/lib/view/selection";
import { SprintSelect } from "@/components/TeamSprintSelector";
import { formatPoints, formatDelta, formatDateShort, roundTo1 } from "@/lib/format";
import { reportBadge, type ReportIssue } from "@/lib/report/markdown";

export const dynamic = "force-dynamic";

function IssueList({ title, issues, withStatus }: { title: string; issues: ReportIssue[]; withStatus: boolean }) {
  return (
    <div className="card p-[18px]" style={{ breakInside: "avoid" }}>
      <div className="text-sm font-semibold">
        {title} ({issues.length})
      </div>
      {issues.length === 0 ? (
        <p className="mt-3 text-[13px] text-muted">– keine –</p>
      ) : (
        <div className="mt-3 flex flex-col">
          {issues.map((i) => (
            <div key={i.jiraKey} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-row py-[7px] text-[13px] last:border-b-0">
              {i.url ? (
                <a href={i.url} target="_blank" rel="noopener noreferrer" className="w-[76px] flex-none font-mono text-[11.5px] text-link">
                  {i.jiraKey}
                </a>
              ) : (
                <span className="w-[76px] flex-none font-mono text-[11.5px] text-link">{i.jiraKey}</span>
              )}
              <span className="min-w-0 flex-1">{i.summary}</span>
              {withStatus && <span className="flex-none font-mono text-[11px] text-mid">{i.status}</span>}
              <span className="flex-none font-mono text-[11px] text-dim">{formatPoints(i.storyPoints)} SP</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string; sprint?: string }>;
}) {
  const { team, sprint } = await searchParams;
  const teams = await loadTeams();
  const teamId = resolveTeamId(teams, team);
  if (!teamId) return <p className="text-muted">Kein Team vorhanden.</p>;

  const sprints = await loadSprints(teamId);
  const sprintId = resolveSprintId(sprints, sprint);
  if (!sprintId) return <p className="text-muted">Kein Sprint vorhanden.</p>;

  const report = await loadReport(sprintId);
  if (!report) return <p className="text-muted">Keine Report-Daten.</p>;
  if (report.state === "FUTURE") {
    return (
      <div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[29px] font-semibold tracking-[-0.028em]">Report</h1>
            <p className="mt-[7px] text-[13px] text-muted">
              {report.sprintName} ist noch geplant — einen Report gibt es erst, wenn der Sprint läuft.
            </p>
          </div>
          <SprintSelect sprints={sprintOptions(sprints)} value={sprintId} />
        </div>
      </div>
    );
  }

  const d = report.data;
  const quote = d.committed > 0 ? `${Math.round((d.completed / d.committed) * 100)} %` : "–";
  const diff = d.completed - d.committed;

  const burndown = await loadBurndown(sprintId);
  const byLabel = new Map<string, BurndownRow>();
  for (const p of burndown?.ideal ?? []) {
    const label = formatDateShort(p.date);
    byLabel.set(label, { label, ideal: roundTo1(p.remainingPoints), actual: null });
  }
  for (const p of burndown?.actual ?? []) {
    const label = formatDateShort(p.date);
    const row = byLabel.get(label) ?? { label, ideal: null, actual: null };
    row.actual = roundTo1(p.remainingPoints);
    byLabel.set(label, row);
  }
  const burndownRows = [...byLabel.values()];

  return (
    <div>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <Image src="/scrumi-logo.png" alt="Scrumi-Logo" width={26} height={26} />
            <h1 className="text-[29px] font-semibold tracking-[-0.028em]">Sprint-Report</h1>
            <span className="rounded-full border border-edge bg-field px-2.5 py-[3px] font-mono text-[11px] text-mid">
              {reportBadge(d.state)}
            </span>
          </div>
          <div className="mt-[7px] text-[13px] text-muted">
            {d.teamName} · {d.sprintName}
            {d.period && <> · {d.period}</>} · erstellt am {d.generatedAt}
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-3 print:hidden">
          <SprintSelect sprints={sprintOptions(sprints)} value={sprintId} />
          <ReportActions markdownUrl={`/api/report/${sprintId}/markdown`} />
        </div>
      </div>

      <div className="mt-[26px] grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5">
        <KpiCard label="Commitment" value={formatPoints(d.committed)} unit="SP" size="md" />
        <KpiCard label="Geliefert" value={formatPoints(d.completed)} unit="SP" size="md" />
        <KpiCard label="Zielerreichung" value={quote} size="md" hint={`Differenz ${formatDelta(diff)} SP`} monoHint />
        <KpiCard label="Carry-Over" value={formatPoints(d.carryOverPoints)} unit="SP" size="md" />
        <KpiCard
          label="Tickets / Bugs"
          value={`${d.ticketsDone}/${d.ticketsTotal}`}
          size="md"
          hint={`Bugs: ${d.bugsClosed} von ${d.bugsTotal} geschlossen`}
          monoHint
        />
      </div>

      {burndownRows.length > 0 && (
        <div className="card mt-3.5 p-[18px]" style={{ breakInside: "avoid" }}>
          <div className="flex flex-wrap items-center gap-4">
            <div className="text-sm font-semibold">Burndown · Story Points</div>
            <ChartLegend
              items={[
                { type: "dash", color: "#6B7590", label: "Ideallinie" },
                { type: "line", color: "#7C9CFF", label: "Restaufwand" },
              ]}
            />
          </div>
          <BurndownChart data={burndownRows} unit="SP" height={240} />
        </div>
      )}

      <div className="card mt-3.5 overflow-hidden" style={{ breakInside: "avoid" }}>
        <div className="border-b border-line px-[18px] py-[15px] text-sm font-semibold">
          Kapazität · {formatPoints(d.actualPersonDays)} von {formatPoints(d.plannedPersonDays)} PT
        </div>
        <div className="grid grid-cols-[2fr,1fr,1fr,1fr] gap-3 border-b border-line px-[18px] py-[11px] font-mono text-[10.5px] uppercase tracking-[0.1em] text-dim">
          <div>Mitglied</div>
          <div className="text-right">PT Soll</div>
          <div className="text-right">PT Ist</div>
          <div className="text-right">Delta</div>
        </div>
        {d.capacity.map((m) => (
          <div key={m.name} className="grid grid-cols-[2fr,1fr,1fr,1fr] gap-3 border-b border-row px-[18px] py-[9px] text-[13px] last:border-b-0">
            <div>{m.name}</div>
            <div className="text-right font-mono">{formatPoints(m.planned)}</div>
            <div className="text-right font-mono">{formatPoints(m.actual)}</div>
            <div className="text-right font-mono">{formatDelta(m.actual - m.planned)}</div>
          </div>
        ))}
        {d.capacity.length === 0 && (
          <div className="px-[18px] py-6 text-center text-[13px] text-muted">Keine Mitglieder gepflegt.</div>
        )}
      </div>

      <div className="mt-3.5 flex flex-col gap-3.5">
        <IssueList title="Geliefert" issues={d.delivered} withStatus={false} />
        <IssueList title="Nicht geschafft" issues={d.open} withStatus />
      </div>
    </div>
  );
}
