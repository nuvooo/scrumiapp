import { formatPoints } from "@/lib/format";

export interface CarriedItemView {
  jiraKey: string;
  summary: string;
  /** Schätzung am Ticket zum Zeitpunkt der Mitnahme. */
  storyPoints: number;
  /** Im Planning festgelegte Rest-SP. */
  remainingPoints: number;
  url: string | null;
}

/** Aus dem Vorsprint mitgenommene Tickets mit ihren im Planning gespeicherten Rest-SP. */
export function CarriedList({ items }: { items: CarriedItemView[] }) {
  const total = items.reduce((sum, i) => sum + i.remainingPoints, 0);
  return (
    <div className="card p-[18px]" style={{ breakInside: "avoid" }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-sm font-semibold">Mitgenommen aus dem Vorsprint ({items.length})</div>
        <div className="font-mono text-[11.5px] text-dim">{formatPoints(total)} SP Rest</div>
      </div>
      <div className="mt-3 flex flex-col">
        {items.map((i) => (
          <div
            key={i.jiraKey}
            className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-row py-[7px] text-[13px] last:border-b-0"
          >
            {i.url ? (
              <a href={i.url} target="_blank" rel="noopener noreferrer" className="w-[76px] flex-none font-mono text-[11.5px] text-link">
                {i.jiraKey}
              </a>
            ) : (
              <span className="w-[76px] flex-none font-mono text-[11.5px] text-link">{i.jiraKey}</span>
            )}
            <span className="min-w-0 flex-1">{i.summary || "–"}</span>
            <span className="flex-none font-mono text-[11px] text-dim" title="Rest-SP von ursprünglicher Schätzung">
              {formatPoints(i.remainingPoints)} / {formatPoints(i.storyPoints)} SP
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
