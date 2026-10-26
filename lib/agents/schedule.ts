import { z } from "zod";
import { addDays, istDay, istInstant, istParts } from "./time";

/**
 * When an agent runs, all on its own (the Worker's cron checks every 5 minutes): every N minutes,
 * or at set times of day on chosen weekdays (India time). Shared by the browser (Schedule tab) and
 * the server (scheduler). Pure and unit-tested.
 */

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM, like 09:00.");

export const scheduleSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("interval"), everyMinutes: z.number().int().min(10).max(7 * 1440) }),
  z.object({
    mode: z.literal("times"),
    times: z.array(hhmm).min(1, "Pick at least one time.").max(6).transform((t) => [...new Set(t)].sort()),
    /** 1 = Monday … 7 = Sunday */
    days: z.array(z.number().int().min(1).max(7)).min(1, "Pick at least one day.").transform((d) => [...new Set(d)].sort((a, b) => a - b)),
  }),
]);
export type Schedule = z.infer<typeof scheduleSchema>;

export const replyRules = ["auto", "stop", "pause", "keep"] as const;
export type ReplyRule = (typeof replyRules)[number];
export const reportFrequencies = ["daily", "weekly", "off"] as const;
export type ReportFrequency = (typeof reportFrequencies)[number];

export const WEEKDAYS = [
  [1, "Mon"],
  [2, "Tue"],
  [3, "Wed"],
  [4, "Thu"],
  [5, "Fri"],
  [6, "Sat"],
  [7, "Sun"],
] as const;

/** The schedule in force: the owner's, else the manifest's interval, else none (manual only) */
export function effectiveSchedule(saved: unknown, manifestEvery: number | null): Schedule | null {
  const p = scheduleSchema.safeParse(saved);
  if (p.success) return p.data;
  return manifestEvery ? { mode: "interval", everyMinutes: manifestEvery } : null;
}

/** 1 = Monday … 7 = Sunday, in India time */
const isoWeekday = (d: Date) => ((istParts(d).weekday + 6) % 7) + 1;

/** The next run strictly after `now` */
export function nextRunAt(s: Schedule, now: Date): Date {
  if (s.mode === "interval") return new Date(now.getTime() + s.everyMinutes * 60_000);
  const today = istDay(now);
  for (let i = 0; i < 8; i++) {
    const day = addDays(today, i);
    const at = istInstant(day, 12);
    if (!s.days.includes(isoWeekday(at))) continue;
    for (const t of s.times) {
      const [h, m] = t.split(":").map(Number);
      const when = istInstant(day, h, m);
      if (when.getTime() > now.getTime()) return when;
    }
  }
  // Unreachable with at least one day and one time; a week out keeps the scheduler safe anyway
  return new Date(now.getTime() + 7 * 86_400_000);
}

/** A key that is the same for every tick inside one scheduled slot (so a slot runs once) */
export function slotKey(s: Schedule, now: Date): string {
  if (s.mode === "interval") return new Date(Math.floor(now.getTime() / (s.everyMinutes * 60_000)) * s.everyMinutes * 60_000).toISOString();
  return now.toISOString().slice(0, 16);
}

function every(min: number): string {
  if (min % 1440 === 0) return min === 1440 ? "every day" : `every ${min / 1440} days`;
  if (min % 60 === 0) return min === 60 ? "every hour" : `every ${min / 60} hours`;
  return `every ${min} minutes`;
}

/** "Every hour" / "Mon–Fri at 09:00 and 17:00" / "Runs when you start it" */
export function describeSchedule(s: Schedule | null): string {
  if (!s) return "Runs when you start it";
  if (s.mode === "interval") {
    const e = every(s.everyMinutes);
    return e[0].toUpperCase() + e.slice(1);
  }
  const names = WEEKDAYS.filter(([n]) => s.days.includes(n)).map(([, l]) => l);
  const days = s.days.length === 7 ? "Every day" : s.days.join(",") === "1,2,3,4,5" ? "Mon–Fri" : names.join(", ");
  const times = s.times.length === 1 ? s.times[0] : `${s.times.slice(0, -1).join(", ")} and ${s.times.at(-1)}`;
  return `${days} at ${times}`;
}

export const REPLY_RULES: Record<ReplyRule, { label: string; short: string }> = {
  auto: { label: "Decide from the reply", short: "Paid or a dispute: stops and asks you. A pay date: waits until then. Anything else: waits, then carries on." },
  stop: { label: "Stop on any reply", short: "That customer gets nothing more until you switch them back on." },
  pause: { label: "Wait, then carry on", short: "Waits the days you set, then reminders carry on." },
  keep: { label: "Keep going", short: "Replies are logged; reminders carry on as planned." },
};

export const REPORT_FREQUENCY: Record<ReportFrequency, string> = {
  daily: "Every day at 9:00",
  weekly: "Mondays at 9:00",
  off: "No report emails",
};
