import { describe, expect, it } from "vitest";
import { alertsForDay, dueAlert, type RoutineItem } from "./routineAlerts";

const item = (dayOfWeek: number, startTime: string, endTime: string | null, activity: string): RoutineItem => ({
  dayOfWeek,
  startTime,
  endTime,
  activity,
});

const monday = [
  item(1, "08:00", "08:30", "Arrival"),
  item(1, "08:30", "09:00", "Circle time"),
  item(1, "12:00", "13:00", "Lunch"),
  item(2, "08:00", "09:00", "Tuesday only"),
];

describe("alertsForDay", () => {
  it("chimes at each start and once more when the day ends", () => {
    expect(alertsForDay(monday, 1).map((a) => [a.minutes, a.kind, a.label])).toEqual([
      [480, "start", "Arrival"],
      [510, "start", "Circle time"],
      [720, "start", "Lunch"],
      [780, "end", "Routine finished"],
    ]);
  });

  it("only uses the given weekday and is empty on days without a routine", () => {
    expect(alertsForDay(monday, 3)).toEqual([]);
    expect(alertsForDay(monday, 2)).toHaveLength(2);
  });

  it("merges activities that start at the same minute", () => {
    const a = alertsForDay([item(1, "09:00", "10:00", "Art"), item(1, "09:00", "10:00", "Music")], 1);
    expect(a[0].label).toBe("Art / Music");
    expect(a).toHaveLength(2);
  });

  it("does not add a closing chime when the last end is another start", () => {
    const a = alertsForDay([item(1, "08:00", "09:00", "A"), item(1, "09:00", null, "B")], 1);
    expect(a.map((x) => x.kind)).toEqual(["start", "start"]);
  });
});

describe("dueAlert", () => {
  const alerts = alertsForDay(monday, 1);

  it("fires when the clock passes an alert", () => {
    expect(dueAlert(alerts, 509, 510)?.label).toBe("Circle time");
  });

  it("does not fire twice for the same alert", () => {
    expect(dueAlert(alerts, 510, 511)).toBeNull();
  });

  it("catches up on a recent alert after a late timer but not an old one", () => {
    expect(dueAlert(alerts, 500, 512)?.label).toBe("Circle time");
    expect(dueAlert(alerts, 480, 700)).toBeNull();
  });
});
