import { describe, expect, it } from "vitest";
import { IMPORT_TEMPLATE, matchColumns, planImport, readDate, weekdayInRange } from "./lessonImport";
import { lessonThemeSchema, themeAppliesTo } from "./lessonPlan";

const classes = [
  { id: "c1", name: "Butterfly" },
  { id: "c2", name: "Mighty Ducks" },
  { id: "c3", name: "Bumble Bees" },
];
const H = ["Theme", "Start date", "End date", "Class", "Date", "Topic for the day", "Teaching guide"];

describe("readDate and weekdays", () => {
  it("reads ISO and South African day-first dates", () => {
    expect(readDate("2026-10-05")).toBe("2026-10-05");
    expect(readDate("05/10/2026")).toBe("2026-10-05");
    expect(readDate("31/02/2026")).toBeNull();
    expect(readDate("next week")).toBeNull();
  });
  it("turns a weekday into its date inside the theme", () => {
    expect(weekdayInRange("Monday", "2026-10-05", "2026-10-09")).toBe("2026-10-05");
    expect(weekdayInRange("fri", "2026-10-05", "2026-10-09")).toBe("2026-10-09");
    expect(weekdayInRange("Monday", "2026-10-06", "2026-10-09")).toBeNull();
  });
});

describe("matchColumns", () => {
  it("accepts other common headings", () => {
    const { missing, map } = matchColumns(["Topic of the week", "From", "To", "Age group", "Day", "Sub topic", "What to teach"]);
    expect(missing).toEqual([]);
    expect(map.topic).toBe(5);
    expect(map.guide).toBe(6);
  });
  it("names the missing ones", () => {
    expect(planImport([["Theme", "Date"], ["x", "y"]], classes).errors[0].error).toContain("Start date");
  });
});

describe("planImport", () => {
  it("builds a theme with a topic and guide per class per day", () => {
    const plan = planImport(
      [
        H,
        ["Numbers and shapes", "2026-10-05", "2026-10-09", "Butterfly", "Monday", "Counting 1 to 10", "Count fingers"],
        ["Numbers and shapes", "2026-10-05", "2026-10-09", "Mighty Ducks", "2026-10-05", "Counting 1 to 20", ""],
      ],
      classes
    );
    expect(plan.errors).toEqual([]);
    expect(plan.themes).toHaveLength(1);
    expect(plan.themes[0].categoryIds.sort()).toEqual(["c1", "c2"]);
    expect(plan.days).toEqual([
      expect.objectContaining({ categoryId: "c1", date: "2026-10-05", topic: "Counting 1 to 10", guide: "Count fingers" }),
      expect.objectContaining({ categoryId: "c2", date: "2026-10-05", topic: "Counting 1 to 20", guide: null }),
    ]);
  });

  it("'All' covers every class and makes the theme apply to all", () => {
    const plan = planImport([H, ["Shapes", "2026-10-05", "2026-10-09", "All", "Friday", "Shape hunt", ""]], classes);
    expect(plan.days.map((d) => d.categoryId).sort()).toEqual(["c1", "c2", "c3"]);
    expect(plan.themes[0].categoryIds).toEqual([]);
  });

  it("several classes separated by ;", () => {
    const plan = planImport([H, ["Shapes", "2026-10-05", "2026-10-09", "butterfly; Bumble Bees", "Tuesday", "Circles", ""]], classes);
    expect(plan.days.map((d) => d.categoryId).sort()).toEqual(["c1", "c3"]);
  });

  it("a row with only the theme creates the theme", () => {
    const plan = planImport([H, ["Animals", "2026-10-12", "2026-10-16", "All", "", "", ""]], classes);
    expect(plan.themes).toHaveLength(1);
    expect(plan.days).toHaveLength(0);
  });

  it("reports bad rows by spreadsheet row number and skips them", () => {
    const plan = planImport(
      [
        H,
        ["Shapes", "2026-10-05", "2026-10-09", "Lions", "Monday", "x", ""],
        ["Shapes", "2026-10-05", "2026-10-09", "Butterfly", "2026-10-10", "x", ""],
        ["Shapes", "2026-10-05", "2026-10-09", "Butterfly", "2026-10-20", "x", ""],
        ["Shapes", "2026-10-09", "2026-10-05", "Butterfly", "", "", ""],
        ["Shapes", "2026-10-05", "2026-10-09", "Butterfly", "Monday", "", ""],
        ["", "", "", "", "", "", ""],
        ["Shapes", "2026-10-05", "2026-10-09", "Butterfly", "Monday", "Fine", ""],
      ],
      classes
    );
    expect(plan.errors.map((e) => e.row)).toEqual([2, 3, 4, 5, 6]);
    expect(plan.errors[0].error).toContain("Lions");
    expect(plan.days).toHaveLength(1);
  });

  it("the template imports cleanly", () => {
    const plan = planImport(IMPORT_TEMPLATE, classes);
    expect(plan.errors).toEqual([]);
    expect(plan.days.length).toBeGreaterThan(0);
  });
});

describe("themes", () => {
  it("validates dates and length", () => {
    const ok = { title: "Numbers and shapes", startDate: "2026-10-05", endDate: "2026-10-09", categoryIds: [] };
    expect(lessonThemeSchema.safeParse(ok).success).toBe(true);
    expect(lessonThemeSchema.safeParse({ ...ok, endDate: "2026-10-01" }).success).toBe(false);
    expect(lessonThemeSchema.safeParse({ ...ok, endDate: "2027-01-30" }).success).toBe(false);
    expect(lessonThemeSchema.safeParse({ ...ok, title: "" }).success).toBe(false);
  });
  it("[] means every class", () => {
    expect(themeAppliesTo([], "c1")).toBe(true);
    expect(themeAppliesTo(["c2"], "c1")).toBe(false);
  });
});
