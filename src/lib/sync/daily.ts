/**
 * Daily-Snapshot: 1 Minute vor dem Daily wird synchronisiert und der
 * Burndown-Stand festgehalten — als Ergebnis des Vortags. Syncs im Laufe des
 * Tages verändern den Burndown dann nicht mehr.
 */

/** Zeitzone, in der Daily-Uhrzeit und Wochentage gelten. */
export const DAILY_TIME_ZONE = process.env.DAILY_TIMEZONE || "Europe/Berlin";

export const WEEKDAYS = [
  { iso: 1, short: "Mo" },
  { iso: 2, short: "Di" },
  { iso: 3, short: "Mi" },
  { iso: 4, short: "Do" },
  { iso: 5, short: "Fr" },
  { iso: 6, short: "Sa" },
  { iso: 7, short: "So" },
] as const;

export interface DailyConfig {
  /** JSON: ISO-Wochentag → "HH:MM", z. B. {"1":"09:30","3":"10:00"}. */
  dailySchedule: string;
}

/** Uhrzeit je ISO-Wochentag (1 = Mo … 7 = So). */
export type DailySchedule = Partial<Record<number, string>>;

/** JSON-Zeitplan lesen; ungültige Tage/Uhrzeiten werden verworfen. */
export function parseDailySchedule(raw: string): DailySchedule {
  let data: unknown;
  try {
    data = JSON.parse(raw || "{}");
  } catch {
    return {};
  }
  if (!data || typeof data !== "object") return {};
  const schedule: DailySchedule = {};
  for (const [day, time] of Object.entries(data as Record<string, unknown>)) {
    const iso = Number(day);
    const normalized = typeof time === "string" ? normalizeDailyTime(time) : null;
    if (Number.isInteger(iso) && iso >= 1 && iso <= 7 && normalized) schedule[iso] = normalized;
  }
  return schedule;
}

/** Zeitplan als JSON speichern (Tage aufsteigend). */
export function serializeDailySchedule(schedule: DailySchedule): string {
  const sorted = Object.keys(schedule)
    .map(Number)
    .sort((a, b) => a - b)
    .map((d) => [String(d), schedule[d]]);
  return JSON.stringify(Object.fromEntries(sorted));
}

/** Serie = alle Daily-Tage haben dieselbe Uhrzeit; liefert sie, sonst null. */
export function seriesTime(schedule: DailySchedule): string | null {
  const times = new Set(Object.values(schedule));
  return times.size === 1 ? [...times][0] ?? null : null;
}

/** "9:05" / "09:05" → "09:05"; ungültig → null. */
export function normalizeDailyTime(raw: string): string | null {
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** Ist ein Daily konfiguriert (mindestens ein Tag mit Uhrzeit)? */
export function hasDaily(config: DailyConfig): boolean {
  return Object.keys(parseDailySchedule(config.dailySchedule)).length > 0;
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  /** ISO-Wochentag 1 = Mo … 7 = So */
  isoWeekday: number;
  /** "HH:MM" */
  time: string;
}

const WEEKDAY_BY_NAME: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

/** Kalenderdatum, Wochentag und Uhrzeit eines Zeitpunkts in der Zeitzone. */
export function zonedParts(date: Date, timeZone = DAILY_TIME_ZONE): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    isoWeekday: WEEKDAY_BY_NAME[get("weekday")] ?? 0,
    time: `${get("hour")}:${get("minute")}`,
  };
}

/**
 * Soll jetzt der Snapshot laufen? Genau in der Minute vor dem Daily des
 * jeweiligen Wochentags (maßgeblich ist der Tag des Dailys, auch bei 00:00).
 */
export function isSnapshotMinute(config: DailyConfig, now: Date, timeZone = DAILY_TIME_ZONE): boolean {
  const daily = zonedParts(new Date(now.getTime() + 60_000), timeZone);
  return parseDailySchedule(config.dailySchedule)[daily.isoWeekday] === daily.time;
}

/**
 * Tag, für den ein Snapshot zum Zeitpunkt `now` steht: der vorige Arbeitstag
 * (Mo–Fr) vor dem Daily — der Stand vor dem Daily ist das Ergebnis von gestern.
 * Liegt der vor dem Sprintstart, zählt der Starttag (Ausgangsstand).
 * Ergebnis als UTC-Mitternacht wie die übrigen Burndown-Tage.
 */
export function snapshotDay(now: Date, sprintStart: Date | null, timeZone = DAILY_TIME_ZONE): Date {
  const local = zonedParts(new Date(now.getTime() + 60_000), timeZone);
  const day = new Date(Date.UTC(local.year, local.month - 1, local.day));
  do {
    day.setUTCDate(day.getUTCDate() - 1);
  } while (day.getUTCDay() === 0 || day.getUTCDay() === 6);
  if (sprintStart) {
    const start = new Date(Date.UTC(sprintStart.getUTCFullYear(), sprintStart.getUTCMonth(), sprintStart.getUTCDate()));
    if (day < start) return start;
  }
  return day;
}
