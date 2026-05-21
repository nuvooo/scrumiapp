"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

export interface BurndownRow {
  label: string;
  ideal: number | null;
  actual: number | null;
}

export function BurndownChart({ data }: { data: BurndownRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={360}>
      <LineChart data={data} margin={{ top: 16, right: 24, bottom: 8, left: 0 }}>
        <CartesianGrid stroke="#1e293b" />
        <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} />
        <YAxis stroke="#94a3b8" fontSize={12} />
        <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
        <Legend />
        <Line type="monotone" dataKey="ideal" name="Ideal" stroke="#64748b" strokeDasharray="5 5" dot={false} connectNulls />
        <Line type="monotone" dataKey="actual" name="Ist" stroke="#34d399" strokeWidth={2} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}
