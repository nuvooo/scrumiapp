"use client";

import { useState } from "react";
import { WEEKDAYS, parseDailySchedule, serializeDailySchedule, seriesTime, type DailySchedule } from "@/lib/sync/daily";

/**
 * Daily-Zeitplan fürs Team-Formular: jeder Wochentag hat seine eigene Uhrzeit;
 * mit „Serie" gilt eine Uhrzeit für alle gewählten Tage. Übermittelt wird der
 * Zeitplan als JSON im versteckten Feld `dailySchedule`.
 */
export function DailyScheduleField({ initial }: { initial: string }) {
  const parsed = parseDailySchedule(initial);
  const initialSeries = seriesTime(parsed);
  const [series, setSeries] = useState(Object.keys(parsed).length === 0 || initialSeries !== null);
  const [days, setDays] = useState<Set<number>>(() => new Set(Object.keys(parsed).map(Number)));
  const [times, setTimes] = useState<Record<number, string>>(() => {
    const t: Record<number, string> = {};
    for (const d of WEEKDAYS) t[d.iso] = parsed[d.iso] ?? initialSeries ?? "";
    return t;
  });
  const [commonTime, setCommonTime] = useState(initialSeries ?? Object.values(parsed)[0] ?? "");

  const schedule: DailySchedule = {};
  for (const d of days) {
    const time = series ? commonTime : times[d];
    if (time) schedule[d] = time;
  }

  function toggleDay(iso: number) {
    setDays((prev) => {
      const next = new Set(prev);
      if (next.has(iso)) next.delete(iso);
      else next.add(iso);
      return next;
    });
  }

  function toggleSeries(on: boolean) {
    // Beim Wechsel die Uhrzeiten mitnehmen: Serie → alle Tage erhalten die gemeinsame Uhrzeit
    if (on) {
      const first = [...days].map((d) => times[d]).find(Boolean);
      if (first && !commonTime) setCommonTime(first);
    } else if (commonTime) {
      setTimes((prev) => {
        const next = { ...prev };
        for (const d of days) next[d] = commonTime;
        return next;
      });
    }
    setSeries(on);
  }

  const chipClass =
    "flex cursor-pointer items-center gap-1.5 rounded-full border border-edge bg-field px-2.5 py-1 text-[12.5px] text-mid has-[:checked]:border-accent has-[:checked]:text-fg";

  return (
    <fieldset aria-label="Daily" className="md:col-span-4">
      <input type="hidden" name="dailySchedule" value={serializeDailySchedule(schedule)} />
      <div className="mb-[7px] flex flex-wrap items-center gap-3">
        <span className="mono-label">Daily</span>
        <label className="flex cursor-pointer items-center gap-1.5 text-[12.5px] text-mid">
          <input
            type="checkbox"
            checked={series}
            onChange={(e) => toggleSeries(e.target.checked)}
            className="h-3.5 w-3.5 accent-[#6e8ff6]"
          />
          Serie — gleiche Uhrzeit für alle Tage
        </label>
      </div>

      {series ? (
        <div className="flex flex-wrap items-center gap-2">
          {WEEKDAYS.map((d) => (
            <label key={d.iso} className={chipClass}>
              <input
                type="checkbox"
                aria-label={`Daily am ${d.short}`}
                checked={days.has(d.iso)}
                onChange={() => toggleDay(d.iso)}
                className="h-3.5 w-3.5 accent-[#6e8ff6]"
              />
              {d.short}
            </label>
          ))}
          <input
            aria-label="Daily-Uhrzeit"
            type="time"
            value={commonTime}
            onChange={(e) => setCommonTime(e.target.value)}
            className="input-field w-[120px] font-mono [color-scheme:dark]"
          />
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
          {WEEKDAYS.map((d) => (
            <div key={d.iso} className="flex items-center gap-2">
              <label className={`${chipClass} w-[62px] flex-none`}>
                <input
                  type="checkbox"
                  aria-label={`Daily am ${d.short}`}
                  checked={days.has(d.iso)}
                  onChange={() => toggleDay(d.iso)}
                  className="h-3.5 w-3.5 accent-[#6e8ff6]"
                />
                {d.short}
              </label>
              <input
                aria-label={`Daily-Uhrzeit ${d.short}`}
                type="time"
                value={times[d.iso]}
                disabled={!days.has(d.iso)}
                onChange={(e) => setTimes((prev) => ({ ...prev, [d.iso]: e.target.value }))}
                className="input-field w-full min-w-0 font-mono [color-scheme:dark] disabled:opacity-40"
              />
            </div>
          ))}
        </div>
      )}

      <p className="mt-1.5 text-[12px] text-dim">
        1 Minute vor dem Daily wird synchronisiert und der Burndown-Stand als Ergebnis des Vortags
        gespeichert — spätere Syncs verändern ihn nicht mehr. Ohne Daily schreibt jeder Sync den
        aktuellen Tag.
      </p>
    </fieldset>
  );
}
