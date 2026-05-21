import { formatPoints, formatDelta, trendSymbol } from "@/lib/format";
import type { VelocityPoint } from "@/lib/metrics/velocity";

function trendClass(trend: VelocityPoint["velocityTrend"]): string {
  return trend === "UP" ? "text-emerald-400" : trend === "DOWN" ? "text-red-400" : "text-slate-400";
}

export function VelocityTable({ points }: { points: VelocityPoint[] }) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-400">
          <th className="py-2 pr-4">Sprint</th>
          <th className="py-2 pr-4 text-right">Commitment (SP)</th>
          <th className="py-2 pr-4 text-right">PT Soll</th>
          <th className="py-2 pr-4 text-right">PT Ist</th>
          <th className="py-2 pr-4 text-right">Velocity (SP)</th>
          <th className="py-2 pr-4 text-right">Δ Vorsprint</th>
        </tr>
      </thead>
      <tbody>
        {points.map((p) => (
          <tr key={p.sprintName} className="border-b border-slate-800/60">
            <td className="py-2 pr-4">{p.sprintName}</td>
            <td className="py-2 pr-4 text-right">{formatPoints(p.committed)}</td>
            <td className="py-2 pr-4 text-right">{formatPoints(p.plannedPersonDays)}</td>
            <td className="py-2 pr-4 text-right">{formatPoints(p.actualPersonDays)}</td>
            <td className="py-2 pr-4 text-right font-medium">{formatPoints(p.velocity)}</td>
            <td className={`py-2 pr-4 text-right ${trendClass(p.velocityTrend)}`}>
              {trendSymbol(p.velocityTrend)} <span>{formatDelta(p.velocityDelta)}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
