import { describe, expect, it } from "vitest";
import { describeSchedule, effectiveSchedule, nextRunAt, scheduleSchema, slotKey } from "./schedule";
import { appliedLabel, classifyReply, decideReply, promisedDate } from "./replies";

// 26 Oct 2026 is a Monday; 10:00 India time is 04:30 UTC
const MON_10 = new Date("2026-10-26T04:30:00Z");

describe("agent schedule", () => {
  it("falls back to the manifest's interval, or none", () => {
    expect(effectiveSchedule(null, 60)).toEqual({ mode: "interval", everyMinutes: 60 });
    expect(effectiveSchedule({ mode: "bogus" }, null)).toBeNull();
    expect(effectiveSchedule({ mode: "times", times: ["17:00", "09:00"], days: [5, 1] }, 60)).toEqual({ mode: "times", times: ["09:00", "17:00"], days: [1, 5] });
  });

  it("runs an interval schedule N minutes later", () => {
    expect(nextRunAt({ mode: "interval", everyMinutes: 120 }, MON_10).toISOString()).toBe("2026-10-26T06:30:00.000Z");
  });

  it("runs at the next set time, skipping days that aren't picked", () => {
    const s = { mode: "times" as const, times: ["09:00", "17:00"], days: [1, 3] };
    // Monday 10:00 → Monday 17:00
    expect(nextRunAt(s, MON_10).toISOString()).toBe("2026-10-26T11:30:00.000Z");
    // Monday 17:30 → Wednesday 09:00
    expect(nextRunAt(s, new Date("2026-10-26T12:00:00Z")).toISOString()).toBe("2026-10-28T03:30:00.000Z");
  });

  it("gives one key per slot", () => {
    const s = { mode: "interval" as const, everyMinutes: 60 };
    expect(slotKey(s, new Date("2026-10-26T04:05:00Z"))).toBe(slotKey(s, new Date("2026-10-26T04:55:00Z")));
  });

  it("says the schedule in plain words", () => {
    expect(describeSchedule({ mode: "interval", everyMinutes: 60 })).toBe("Every hour");
    expect(describeSchedule({ mode: "times", times: ["09:00", "17:00"], days: [1, 2, 3, 4, 5] })).toBe("Mon–Fri at 09:00 and 17:00");
    expect(describeSchedule(null)).toBe("Runs when you start it");
  });

  it("refuses a times schedule with no days", () => {
    expect(scheduleSchema.safeParse({ mode: "times", times: ["09:00"], days: [] }).success).toBe(false);
  });
});

describe("customer replies", () => {
  const today = "2026-10-26";

  it("reads what a reply means", () => {
    expect(classifyReply("Paid yesterday via UPI, please check", today).intent).toBe("paid");
    expect(classifyReply("Payment kar diya hai", today).intent).toBe("paid");
    expect(classifyReply("This invoice is wrong, we never ordered this", today).intent).toBe("dispute");
    expect(classifyReply("Please stop messaging me", today).intent).toBe("stop");
    expect(classifyReply("Will pay by 5th", today)).toEqual({ intent: "promise", promisedOn: "2026-11-05" });
    expect(classifyReply("Who is this?", today).intent).toBe("other");
  });

  it("finds the pay date a reply names", () => {
    expect(promisedDate("I'll pay tomorrow", today)).toBe("2026-10-27");
    expect(promisedDate("kal tak kar dunga", today)).toBe("2026-10-27");
    expect(promisedDate("on 12 Nov", today)).toBe("2026-11-12");
    expect(promisedDate("by the 30th", today)).toBe("2026-10-30");
    expect(promisedDate("end of month", today)).toBe("2026-10-31");
    expect(promisedDate("soon", today)).toBeNull();
  });

  it("decides from the reply when the rule is auto", () => {
    const o = { promisedOn: null, pauseDays: 7, today };
    expect(decideReply("auto", "paid", o)).toMatchObject({ action: "stop", review: true });
    expect(decideReply("auto", "promise", { ...o, promisedOn: "2026-11-05" })).toMatchObject({ action: "snooze", until: "2026-11-06", review: false });
    expect(decideReply("auto", "other", o)).toMatchObject({ action: "snooze", until: "2026-11-02", review: true });
  });

  it("always stops when the customer asks, whatever the rule", () => {
    expect(decideReply("keep", "stop", { promisedOn: null, pauseDays: 7, today }).action).toBe("stop");
  });

  it("labels what happened", () => {
    expect(appliedLabel("snoozed_until:2026-11-02", (d) => d)).toBe("Waiting until 2026-11-02");
    expect(appliedLabel("stopped", (d) => d)).toBe("Stopped");
  });
});
