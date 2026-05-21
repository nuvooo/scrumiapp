import type { TrendDirection } from "@/lib/domain/types";

export function formatPoints(value: number): string {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(value);
}

export function formatDateShort(date: Date): string {
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.`;
}

export function trendSymbol(trend: TrendDirection): string {
  return trend === "UP" ? "▲" : trend === "DOWN" ? "▼" : "▬";
}
