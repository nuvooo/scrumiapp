import { StandupBoard } from "@/components/StandupBoard";
import { loadTeams, loadStandup } from "@/lib/view/loaders";
import { resolveTeamId } from "@/lib/view/selection";

export const dynamic = "force-dynamic";

export default async function StandupPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string; sprint?: string }>;
}) {
  const { team } = await searchParams;
  const teams = await loadTeams();
  const teamId = resolveTeamId(teams, team);
  if (!teamId) return <p className="text-muted">Kein Team vorhanden.</p>;

  const data = await loadStandup(teamId);
  if (!data) {
    return (
      <div>
        <h1 className="text-[29px] font-semibold tracking-[-0.028em]">Standup</h1>
        <p className="mt-[7px] text-[13px] text-muted">
          Kein aktiver Sprint — das Standup gibt es nur für laufende Sprints.
        </p>
      </div>
    );
  }

  const people = data.groups.filter((g) => g.name !== null).length;
  return (
    <div>
      <h1 className="text-[29px] font-semibold tracking-[-0.028em]">Standup</h1>
      <div className="mt-[7px] text-[13px] text-muted">
        {data.sprintName} · {people} {people === 1 ? "Person" : "Personen"} mit Tickets
      </div>
      <StandupBoard groups={data.groups} />
    </div>
  );
}
