import { describe, expect, it } from "vitest";
import { isValidTime, isoWeekday, scheduleItemProblem, sortScheduleItems } from "./schedule";

describe("schedule helpers", () => {
  it("validates HH:MM times", () => {
    expect(isValidTime("08:30")).toBe(true);
    expect(isValidTime("23:59")).toBe(true);
    expect(isValidTime("8:30")).toBe(false);
    expect(isValidTime("24:00")).toBe(false);
    expect(isValidTime("12:60")).toBe(false);
  });

  it("maps dates to ISO weekdays", () => {
    expect(isoWeekday(new Date(2026, 8, 21))).toBe(1); // Monday
    expect(isoWeekday(new Date(2026, 8, 27))).toBe(7); // Sunday
  });

  it("sorts by day then start time", () => {
    const sorted = sortScheduleItems([
      { dayOfWeek: 2, startTime: "08:00" },
      { dayOfWeek: 1, startTime: "10:00" },
      { dayOfWeek: 1, startTime: "07:30" },
    ]);
    expect(sorted.map((i) => `${i.dayOfWeek}-${i.startTime}`)).toEqual(["1-07:30", "1-10:00", "2-08:00"]);
  });

  it("flags bad rows", () => {
    const ok = { dayOfWeek: 1, startTime: "08:00", endTime: "08:30", activity: "Breakfast" };
    expect(scheduleItemProblem(ok)).toBeNull();
    expect(scheduleItemProblem({ ...ok, dayOfWeek: 6 })).toMatch(/Monday to Friday/);
    expect(scheduleItemProblem({ ...ok, endTime: "07:00" })).toMatch(/after/);
    expect(scheduleItemProblem({ ...ok, activity: "  " })).toMatch(/activity/);
    expect(scheduleItemProblem({ ...ok, startTime: "8am" })).toMatch(/Start time/);
  });
});
