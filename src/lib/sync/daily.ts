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
  /** ISO-Wochentage kommagetrennt, z. B. "1,2,3,4,5". */
  dailyDays: string;
  /** "HH:MM" oder null (kein Daily). */
  dailyTime: string | null;
}

/** "1,2,5" → [1, 2, 5] (nur gültige ISO-Wochentage, sortiert, ohne Duplikate). */
export function parseDailyDays(raw: string): number[] {
  const days = raw
    .split(",")
    .map((d) => Number.parseInt(d.trim(), 10))
    .filter((d) => Number.isInteger(d) && d >= 1 && d <= 7);
  return [...new Set(days)].sort((a, b) => a - b);
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

/** Ist ein Daily konfiguriert (Uhrzeit und mindestens ein Tag)? */
export function hasDaily(config: DailyConfig): boolean {
  return config.dailyTime !== null && parseDailyDays(config.dailyDays).length > 0;
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
 * Soll jetzt der Snapshot laufen? Genau in der Minute vor dem Daily, an einem
 * der Daily-Tage (maßgeblich ist der Tag des Dailys, auch bei 00:00).
 */
export function isSnapshotMinute(config: DailyConfig, now: Date, timeZone = DAILY_TIME_ZONE): boolean {
  if (!hasDaily(config)) return false;
  const daily = zonedParts(new Date(now.getTime() + 60_000), timeZone);
  return daily.time === config.dailyTime && parseDailyDays(config.dailyDays).includes(daily.isoWeekday);
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
