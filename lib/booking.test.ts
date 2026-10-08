import { describe, expect, it } from "vitest";
import { bookableDays, slotsFor, zonedTime, type BookingConfig } from "./booking";

const cfg: BookingConfig = { durationMin: 30, days: [1, 2, 3, 4, 5], startHour: 10, endHour: 12, daysAhead: 14, timezone: "Asia/Kolkata" };

describe("booking calendar", () => {
  it("turns a time on the calendar's clocks into the exact moment", () => {
    // 10:00 in India (UTC+5:30) is 04:30 UTC
    expect(zonedTime(2026, 10, 12, 10, 0, "Asia/Kolkata").toISOString()).toBe("2026-10-12T04:30:00.000Z");
    // New York is on summer time until 1 Nov 2026 (UTC-4), then winter time (UTC-5)
    expect(zonedTime(2026, 10, 12, 10, 0, "America/New_York").toISOString()).toBe("2026-10-12T14:00:00.000Z");
    expect(zonedTime(2026, 11, 12, 10, 0, "America/New_York").toISOString()).toBe("2026-11-12T15:00:00.000Z");
  });

  it("offers only the weekdays that are switched on, from today", () => {
    const now = new Date("2026-10-10T00:00:00Z"); // a Saturday
    const days = bookableDays(cfg, now);
    expect(days[0].key).toBe("2026-10-12"); // Monday
    expect(days.every((d) => cfg.days.includes(d.weekday))).toBe(true);
    expect(days.at(-1)!.key <= "2026-10-24").toBe(true);
  });

  it("cuts the day into slots inside the hours", () => {
    const now = new Date("2026-10-10T00:00:00Z");
    const s = slotsFor("2026-10-12", cfg, [], now);
    expect(s.map((x) => x.label)).toEqual(["10:00 am", "10:30 am", "11:00 am", "11:30 am"]);
  });

  it("drops times already booked, and times that have passed", () => {
    const taken = [{ at: zonedTime(2026, 10, 12, 10, 30, "Asia/Kolkata"), minutes: 30 }];
    const early = slotsFor("2026-10-12", cfg, taken, new Date("2026-10-10T00:00:00Z"));
    expect(early.map((x) => x.label)).toEqual(["10:00 am", "11:00 am", "11:30 am"]);
    // At 10:45 India time on the day, only 11:00 and 11:30 are left
    const late = slotsFor("2026-10-12", cfg, [], zonedTime(2026, 10, 12, 10, 45, "Asia/Kolkata"));
    expect(late.map((x) => x.label)).toEqual(["11:00 am", "11:30 am"]);
  });

  it("a longer call blocks the shorter slots it overlaps", () => {
    const taken = [{ at: zonedTime(2026, 10, 12, 10, 0, "Asia/Kolkata"), minutes: 60 }];
    expect(slotsFor("2026-10-12", cfg, taken, new Date("2026-10-10T00:00:00Z")).map((x) => x.label)).toEqual(["11:00 am", "11:30 am"]);
  });
});
