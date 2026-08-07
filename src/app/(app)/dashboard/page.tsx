import Link from "next/link";
import { KpiCard } from "@/components/KpiCard";
import { Celebration } from "@/components/Celebration";
import { loadTeams, loadSprints, loadDashboard, loadCelebration } from "@/lib/view/loaders";
import { resolveTeamId, resolveSprintId, sprintOptions } from "@/lib/view/selection";
import { SprintSelect } from "@/components/TeamSprintSelector";
import { formatPoints, formatDateShort } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATE_BADGE = {
  ACTIVE: { label: "aktiv", className: "border-[#1F3D2B] bg-[#0F1A14] text-ok" },
  CLOSED: { label: "abgeschlossen", className: "border-edge bg-field text-mid" },
  FUTURE: { label: "geplant", className: "border-edge bg-field text-dim" },
} as const;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string; sprint?: string }>;
}) {
  const { team, sprint } = await searchParams;
  const teams = await loadTeams();
  const teamId = resolveTeamId(teams, team);
  if (!teamId) return <Empty />;

  const sprints = await loadSprints(teamId);
  const sprintId = resolveSprintId(sprints, sprint);
  if (!sprintId) return <Empty />;

  const data = await loadDashboard(sprintId);
  if (!data) return <Empty />;

  const celebration = await loadCelebration(sprintId);
  const badge = STATE_BADGE[data.sprintState];
  const subtitle = [
    data.startDate && data.endDate
      ? `${formatDateShort(data.startDate)} – ${data.endDate.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}`
      : null,
    data.workingDayCount > 0 ? `${data.workingDayCount} Arbeitstage` : null,
    data.workingDayCount > 0 && data.sprintState === "ACTIVE" ? `Tag ${data.dayIndex} von ${data.workingDayCount}` : null,
    data.teamName,
  ]
    .filter(Boolean)
    .join(" · ");

  const ticketPct = data.tickets.total > 0 ? Math.round((data.tickets.done / data.tickets.total) * 100) : 0;
  const bugPct = data.bugs.total > 0 ? Math.round((data.bugs.closed / data.bugs.total) * 100) : 0;
  const openBugs = data.bugs.total - data.bugs.closed;

  return (
    <div>
      <Celebration effect={celebration} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="text-[29px] font-semibold tracking-[-0.028em]">{data.sprintName}</h1>
            <span className={`rounded-full border px-2 py-[3px] font-mono text-[11.5px] ${badge.className}`}>
              {badge.label}
            </span>
          </div>
          <div className="mt-[7px] text-[13px] text-muted">{subtitle}</div>
        </div>
        <SprintSelect sprints={sprintOptions(sprints)} value={sprintId} />
      </div>

      <div className="mt-[26px] grid grid-cols-[repeat(auto-fit,minmax(228px,1fr))] gap-3.5">
        <KpiCard label="Velocity" value={formatPoints(data.velocity)} unit="SP" hint="abgeschlossene Story Points" />
        <KpiCard
          label="Commitment"
          value={formatPoints(data.committed)}
          unit="SP"
          hint={`davon ${formatPoints(data.carriedOver)} SP übernommen`}
        />
        <KpiCard
          label="Kapazität"
          value={formatPoints(data.totalActual)}
          unit="PT"
          hint={`Ist · Soll — ${formatPoints(data.totalActual)} · ${formatPoints(data.totalPlanned)}`}
          monoHint
        />
        <KpiCard label="Effizienz" value={formatPoints(data.efficiency)} unit="SP/PT" hint="Story Points pro Personentag" />
        <KpiCard
          label="Prognose"
          value={data.forecast ? formatPoints(data.forecast.possiblePoints) : "–"}
          unit={data.forecast ? "SP" : undefined}
          hint={
            data.forecast
              ? `möglich bei ${formatPoints(data.totalPlanned)} PT Soll · Ø ${formatPoints(data.forecast.efficiency)} SP/PT`
              : "noch keine abgeschlossenen Sprints als Basis"
          }
        />
      </div>

      <div className="mt-3.5 grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-3.5">
        <ProgressCard
          title="Restaufwand"
          meta={`${data.tickets.total - data.tickets.done} Tickets · ${formatPoints(data.tickets.openPoints)} SP offen`}
          metaClass="text-dim"
          pct={ticketPct}
          barClass="bg-accent"
          footerLeft={`${data.tickets.done} von ${data.tickets.total} Tickets erledigt`}
        />
        <ProgressCard
          title="Offene Bugs"
          meta={openBugs === 1 ? "1 offen" : `${openBugs} offen`}
          metaClass="text-warn"
          pct={bugPct}
          barClass="bg-warn"
          footerLeft={`${data.bugs.closed} von ${data.bugs.total} Bugs geschlossen`}
        />
      </div>
    </div>
  );
}

function ProgressCard({
  title,
  meta,
  metaClass,
  pct,
  barClass,
  footerLeft,
}: {
  title: string;
  meta: string;
  metaClass: string;
  pct: number;
  barClass: string;
  footerLeft: string;
}) {
  return (
    <div className="card p-[18px]">
      <div className="flex items-baseline justify-between">
        <div className="text-sm font-semibold">{title}</div>
        <div className={`font-mono text-[11.5px] ${metaClass}`}>{meta}</div>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-cell">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2 flex justify-between font-mono text-[11px] text-faint">
        <span>{footerLeft}</span>
        <span>{pct} %</span>
      </div>
    </div>
  );
}

function Empty() {
  return (
    <div className="card mx-auto mt-10 max-w-[560px] px-10 py-14 text-center">
      <div className="mx-auto mb-[18px] h-[34px] w-[34px] rounded-[10px] bg-cell" />
      <div className="text-[17px] font-semibold">Noch keine Sprint-Daten</div>
      <div className="mt-2 text-[13.5px] leading-relaxed text-muted">
        Lege unter <strong className="font-medium text-link">Teams / Jira</strong> ein Team mit Board-ID an und starte
        einen Sync. Danach erscheinen hier Velocity, Commitment und Kapazität.
      </div>
      <Link href="/settings/teams" className="btn-primary mt-[22px] inline-block px-4 py-[9px]">
        Team anlegen
      </Link>
    </div>
  );
}
