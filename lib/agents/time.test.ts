import { describe, expect, it } from "vitest";
import { addDays, daysBetween, formatDayIN, inWindow, istDay, istInstant, lastMondayNine, nextWindowOpen } from "./time";

describe("India time", () => {
  it("reads the India date across UTC midnight", () => {
    expect(istDay(new Date("2026-10-23T19:00:00Z"))).toBe("2026-10-24"); // 00:30 IST
    expect(istDay(new Date("2026-10-23T18:00:00Z"))).toBe("2026-10-23"); // 23:30 IST
  });

  it("formats DD MMM YYYY", () => {
    expect(formatDayIN("2026-03-05")).toBe("05 Mar 2026");
    expect(formatDayIN("2026-10-23T19:00:00Z")).toBe("24 Oct 2026");
  });

  it("counts days and adds them over month ends", () => {
    expect(daysBetween("2026-01-31", "2026-03-01")).toBe(29);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("keeps sends inside the window, India time", () => {
    expect(inWindow("09:00-20:00", istInstant("2026-10-24", 8, 59))).toBe(false);
    expect(inWindow("09:00-20:00", istInstant("2026-10-24", 9, 0))).toBe(true);
    expect(inWindow("09:00-20:00", istInstant("2026-10-24", 20, 0))).toBe(false);
    expect(inWindow("21:00-06:00", istInstant("2026-10-24", 23, 0))).toBe(true);
  });

  it("finds the next opening", () => {
    expect(nextWindowOpen("09:00-20:00", istInstant("2026-10-24", 21, 0)).toISOString()).toBe(istInstant("2026-10-25", 9, 0).toISOString());
    expect(nextWindowOpen("09:00-20:00", istInstant("2026-10-24", 7, 0)).toISOString()).toBe(istInstant("2026-10-24", 9, 0).toISOString());
  });

  it("finds Monday 9:00 for the weekly report", () => {
    // 2026-10-24 is a Saturday; the Monday before is 19 Oct
    expect(lastMondayNine(istInstant("2026-10-24", 12)).toISOString()).toBe(istInstant("2026-10-19", 9).toISOString());
    // Monday 08:00 belongs to the week before
    expect(lastMondayNine(istInstant("2026-10-26", 8)).toISOString()).toBe(istInstant("2026-10-19", 9).toISOString());
  });
});
