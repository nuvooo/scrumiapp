"use client";

import { useState } from "react";
import { BurndownChart, ChartLegend, type BurndownRow } from "./BurndownChart";

type Tab = "tickets" | "story";

const TABS: { id: Tab; label: string }[] = [
  { id: "tickets", label: "Tickets" },
  { id: "story", label: "Story Points" },
];

export function BurndownTabs({
  ticketRows,
  storyRows,
}: {
  ticketRows: BurndownRow[];
  storyRows: BurndownRow[];
}) {
  const [tab, setTab] = useState<Tab>("tickets");
  const rows = tab === "tickets" ? ticketRows : storyRows;
  const seriesName = tab === "tickets" ? "Offene Tickets" : "Offene Story Points";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4">
        <div role="tablist" className="flex gap-[3px] rounded-[10px] border border-edge bg-chip p-[3px]">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-md px-[13px] py-1.5 text-[12.5px] font-medium ${
                tab === t.id ? "bg-gradient-to-b from-[#2A3446] to-[#1E2634] text-fg" : "text-muted"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <ChartLegend
          items={[
            { type: "dash", color: "#6B7590", label: "Ideallinie" },
            { type: "line", color: "#7C9CFF", label: seriesName },
          ]}
        />
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-muted">
          {tab === "tickets"
            ? "Für diesen Sprint wurden noch keine Ticket-Daten erfasst."
            : "Dieser Sprint hat noch keine Burndown-Punkte."}
        </p>
      ) : (
        <BurndownChart data={rows} unit={tab === "tickets" ? "Tickets" : "SP"} color="accent" height={300} />
      )}
    </div>
  );
}
