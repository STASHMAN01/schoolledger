import { describe, expect, it } from "vitest";
import { alertsForDay, aroundNow, dueAlert, markProgress, soundFor, type RoutineItem } from "./routineAlerts";

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

describe("soundFor", () => {
  it("gives meals, naps, washing and the rest their own sounds", () => {
    expect(soundFor("Lunch")).toBe("meal");
    expect(soundFor("Light refreshments")).toBe("meal");
    expect(soundFor("Nap")).toBe("nap");
    expect(soundFor("Washing hands and toilet routine")).toBe("wash");
    expect(soundFor("Outdoor play")).toBe("outdoor");
    expect(soundFor("Story time")).toBe("story");
    expect(soundFor("Music and movement activity")).toBe("music");
    expect(soundFor("Life skills - Art")).toBe("art");
    expect(soundFor("Indoor activities and departure")).toBe("departure");
    expect(soundFor("Circle time")).toBe("chime");
  });
  it("is carried onto the alerts, and the day's end has its own", () => {
    const a = alertsForDay(monday, 1);
    expect(a.find((x) => x.label === "Lunch")?.sound).toBe("meal");
    expect(a[a.length - 1].sound).toBe("end");
  });
});

describe("markProgress and aroundNow", () => {
  const day = [
    item(1, "08:00", "09:00", "A"),
    item(1, "09:00", "09:15", "B"),
    item(1, "09:15", "10:00", "C"),
    item(1, "10:00", "10:15", "D"),
    item(1, "10:15", "10:45", "E"),
    item(1, "10:45", null, "F"),
    item(1, "11:00", "11:30", "G"),
    item(1, "11:30", "12:00", "H"),
  ];

  it("marks items past, current and upcoming", () => {
    const rows = markProgress(day, 1, 10 * 60 + 20); // 10:20
    expect(rows.map((r) => r.status)).toEqual(["past", "past", "past", "past", "current", "upcoming", "upcoming", "upcoming"]);
  });

  it("lets an item with no end time run until the next one starts", () => {
    expect(markProgress(day, 1, 10 * 60 + 59)[5].status).toBe("current");
    expect(markProgress(day, 1, 11 * 60)[5].status).toBe("past");
  });

  it("shows the last 3 finished, what is on now, and the next 3", () => {
    const { earlier, now, later } = aroundNow(markProgress(day, 1, 10 * 60 + 20));
    expect(earlier.map((r) => r.activity)).toEqual(["B", "C", "D"]);
    expect(now.map((r) => r.activity)).toEqual(["E"]);
    expect(later.map((r) => r.activity)).toEqual(["F", "G", "H"]);
  });

  it("copes with before the day starts and after it ends", () => {
    expect(aroundNow(markProgress(day, 1, 6 * 60)).later).toHaveLength(3);
    expect(aroundNow(markProgress(day, 1, 18 * 60)).earlier).toHaveLength(3);
    expect(aroundNow(markProgress(day, 1, 18 * 60)).later).toHaveLength(0);
  });
});
