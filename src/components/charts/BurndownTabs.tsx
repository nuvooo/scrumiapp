"use client";

import { useState } from "react";
import { BurndownChart, type BurndownRow } from "./BurndownChart";

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

  return (
    <div>
      <div role="tablist" className="mb-4 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`rounded px-3 py-1.5 text-sm ${
              tab === t.id ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "tickets" ? (
        ticketRows.length === 0 ? (
          <p className="text-slate-400">Für diesen Sprint wurden noch keine Ticket-Daten erfasst.</p>
        ) : (
          <BurndownChart data={ticketRows} actualName="Offene Tickets" />
        )
      ) : storyRows.length === 0 ? (
        <p className="text-slate-400">Dieser Sprint hat noch keine Burndown-Punkte.</p>
      ) : (
        <BurndownChart data={storyRows} actualName="Ist" />
      )}
    </div>
  );
}
