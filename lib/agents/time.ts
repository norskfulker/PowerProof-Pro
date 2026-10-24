/**
 * India time for agents. Asia/Kolkata is UTC+5:30 all year (no daylight saving), so plain
 * arithmetic is exact and works the same on Workers, Node and in the browser.
 */

const IST_OFFSET_MS = 330 * 60_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface IstParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  /** 0 = Sunday */
  weekday: number;
}

export function istParts(d: Date): IstParts {
  const s = new Date(d.getTime() + IST_OFFSET_MS);
  return { year: s.getUTCFullYear(), month: s.getUTCMonth() + 1, day: s.getUTCDate(), hour: s.getUTCHours(), minute: s.getUTCMinutes(), weekday: s.getUTCDay() };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** The India calendar date, "2026-10-24" */
export function istDay(d: Date): string {
  const p = istParts(d);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** The instant an India calendar date ("2026-10-24") starts, plus optional hours/minutes in India time */
export function istInstant(day: string, hour = 0, minute = 0): Date {
  const [y, m, dd] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, dd, hour, minute) - IST_OFFSET_MS);
}

/** Whole days from one India date to another ("2026-10-01" to "2026-10-08" is 7) */
export function daysBetween(fromDay: string, toDay: string): number {
  return Math.round((istInstant(toDay).getTime() - istInstant(fromDay).getTime()) / 86_400_000);
}

export function addDays(day: string, n: number): string {
  return istDay(new Date(istInstant(day).getTime() + n * 86_400_000));
}

/** "24 Oct 2026" (DD MMM YYYY) for a "YYYY-MM-DD" date or an ISO instant */
export function formatDayIN(dayOrIso: string): string {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(dayOrIso) ? dayOrIso : istDay(new Date(dayOrIso));
  const [y, m, d] = day.split("-").map(Number);
  return `${pad(d)} ${MONTHS[m - 1]} ${y}`;
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** Whether `d` falls inside a sending window like "09:00-20:00" (India time). A window may wrap midnight. */
export function inWindow(window: string, d: Date): boolean {
  const [a, b] = window.split("-").map(toMinutes);
  const p = istParts(d);
  const now = p.hour * 60 + p.minute;
  if (a === b) return true;
  return a < b ? now >= a && now < b : now >= a || now < b;
}

/** The next moment the window opens at or after `d` */
export function nextWindowOpen(window: string, d: Date): Date {
  if (inWindow(window, d)) return d;
  const [a] = window.split("-").map(toMinutes);
  const today = istDay(d);
  const open = istInstant(today, Math.floor(a / 60), a % 60);
  return open.getTime() > d.getTime() ? open : istInstant(addDays(today, 1), Math.floor(a / 60), a % 60);
}

/** The most recent Monday 09:00 India time at or before `d` (weekly reports) */
export function lastMondayNine(d: Date): Date {
  const p = istParts(d);
  const back = (p.weekday + 6) % 7;
  let at = istInstant(addDays(istDay(d), -back), 9, 0);
  if (at.getTime() > d.getTime()) at = istInstant(addDays(istDay(d), -back - 7), 9, 0);
  return at;
}

/** The first day of the India month containing `d` */
export function istMonthStart(d: Date): string {
  const p = istParts(d);
  return `${p.year}-${pad(p.month)}-01`;
}
