"use client";

import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export interface VelocityRow {
  sprintName: string;
  velocity: number;
  committed: number;
  carriedOver: number;
}

export function VelocityChart({ data, average }: { data: VelocityRow[]; average: number }) {
  const withAvg = data.map((d) => ({ ...d, average: round(average) }));
  return (
    <ResponsiveContainer width="100%" height={360}>
      <ComposedChart data={withAvg} margin={{ top: 16, right: 24, bottom: 8, left: 0 }}>
        <CartesianGrid stroke="#1e293b" />
        <XAxis dataKey="sprintName" stroke="#94a3b8" fontSize={12} />
        <YAxis stroke="#94a3b8" fontSize={12} />
        <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
        <Legend />
        <Bar dataKey="committed" name="Commitment" fill="#475569" />
        <Bar dataKey="velocity" name="Geliefert" fill="#34d399" />
        <Line type="monotone" dataKey="average" name="Ø Velocity" stroke="#fbbf24" strokeDasharray="4 4" dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
