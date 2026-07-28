import { formatPoints, formatDelta } from "@/lib/format";
import type { VelocityPoint } from "@/lib/metrics/velocity";

const GRID = "grid grid-cols-[1.6fr,1fr,1fr,1fr,1fr] gap-3";

export function VelocityTable({ points }: { points: VelocityPoint[] }) {
  const rows = [...points].reverse();

  return (
    <div className="card overflow-hidden">
      <div className={`${GRID} border-b border-line px-[18px] py-3 font-mono text-[10.5px] uppercase tracking-[0.1em] text-dim`}>
        <div>Sprint</div>
        <div className="text-right">Commitment</div>
        <div className="text-right">Abgeschlossen</div>
        <div className="text-right">Differenz</div>
        <div className="text-right">Quote</div>
      </div>
      {rows.map((p) => {
        const diff = p.velocity - p.committed;
        return (
          <div key={p.sprintName} className={`${GRID} border-b border-row px-[18px] py-[13px] text-[13px] hover:bg-raise`}>
            <div className="text-fg">{p.sprintName}</div>
            <div className="text-right font-mono text-mid">{formatPoints(p.committed)} SP</div>
            <div className="text-right font-mono text-fg">{formatPoints(p.velocity)} SP</div>
            <div className={`text-right font-mono ${diff >= 0 ? "text-ok" : "text-warn"}`}>{formatDelta(diff)} SP</div>
            <div className="text-right font-mono text-mid">
              {p.committed > 0 ? `${Math.round((p.velocity / p.committed) * 100)} %` : "–"}
            </div>
          </div>
        );
      })}
    </div>
  );
}
