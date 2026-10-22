/**
 * The instant calendar. Everything is worked out in the calendar's own time zone, so a visitor in
 * another country sees the same hours the creator set; times are stored as exact moments.
 */
export interface BookingConfig {
  durationMin: number;
  /** 0 = Sunday … 6 = Saturday */
  days: number[];
  startHour: number;
  endHour: number;
  daysAhead: number;
  timezone: string;
}

export interface Slot {
  /** The moment, in UTC */
  at: Date;
  /** "10:30 am" in the calendar's zone */
  label: string;
}

/** Milliseconds `tz` is ahead of UTC at a given moment */
function offsetAt(ms: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }).formatToParts(new Date(ms));
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - Math.floor(ms / 1000) * 1000;
}

/** The UTC moment when it is y-m-d h:min on the clocks in `tz` */
export function zonedTime(y: number, m: number, d: number, h: number, min: number, tz: string): Date {
  const guess = Date.UTC(y, m - 1, d, h, min);
  let t = guess - offsetAt(guess, tz);
  // Near a clock change the first answer can be an hour out: settle it once more
  t = guess - offsetAt(t, tz);
  return new Date(t);
}

/** Today's date (y-m-d) on the clocks in `tz` */
function todayIn(now: Date, tz: string): { y: number; m: number; d: number } {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now).split("-").map(Number);
  return { y: p[0], m: p[1], d: p[2] };
}

const pad = (n: number) => String(n).padStart(2, "0");
export const dateKey = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** The days someone can book, from today: only the weekdays the creator allows */
export function bookableDays(cfg: BookingConfig, now: Date): { key: string; weekday: number; date: Date }[] {
  const t = todayIn(now, cfg.timezone);
  const out: { key: string; weekday: number; date: Date }[] = [];
  for (let i = 0; i <= cfg.daysAhead; i++) {
    const noon = new Date(Date.UTC(t.y, t.m - 1, t.d + i, 12));
    const weekday = noon.getUTCDay();
    if (!cfg.days.includes(weekday)) continue;
    out.push({ key: dateKey(noon.getUTCFullYear(), noon.getUTCMonth() + 1, noon.getUTCDate()), weekday, date: noon });
  }
  return out;
}

/** Free times on a day: inside the hours, in the future, not already taken */
export function slotsFor(dayKey: string, cfg: BookingConfig, taken: { at: Date; minutes: number }[], now: Date): Slot[] {
  const [y, m, d] = dayKey.split("-").map(Number);
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: cfg.timezone, hour: "numeric", minute: "2-digit" });
  const out: Slot[] = [];
  const end = cfg.endHour * 60;
  for (let min = cfg.startHour * 60; min + cfg.durationMin <= end; min += cfg.durationMin) {
    const at = zonedTime(y, m, d, Math.floor(min / 60), min % 60, cfg.timezone);
    if (at.getTime() <= now.getTime()) continue;
    const endAt = at.getTime() + cfg.durationMin * 60_000;
    // Taken if it overlaps a booking at all
    if (taken.some((t) => at.getTime() < t.at.getTime() + t.minutes * 60_000 && endAt > t.at.getTime())) continue;
    out.push({ at, label: fmt.format(at).toLowerCase() });
  }
  return out;
}

export const dayLabel = (date: Date) => new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(date);
