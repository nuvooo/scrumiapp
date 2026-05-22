"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export interface TicketBurndownRow {
  label: string;
  actual: number | null;
  trend: number | null;
}

export function TicketBurndownChart({ data }: { data: TicketBurndownRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={360}>
      <ComposedChart data={data} margin={{ top: 16, right: 24, bottom: 8, left: 0 }}>
        <CartesianGrid stroke="#1e293b" />
        <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} />
        <YAxis stroke="#94a3b8" fontSize={12} allowDecimals={false} />
        <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
        <Legend />
        <Bar dataKey="actual" name="Offene Tickets" fill="#34d399" radius={[2, 2, 0, 0]} />
        <Line type="monotone" dataKey="trend" name="Trend" stroke="#f59e0b" strokeWidth={2} dot={false} connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
