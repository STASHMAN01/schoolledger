import { describe, expect, it } from "vitest";
import {
  addDays,
  classworkSchema,
  lessonPlanPutSchema,
  mondayOf,
  weekDays,
  weekdayOf,
} from "./lessonPlan";

describe("week helpers", () => {
  it("finds the Monday of any day, weekends included", () => {
    expect(mondayOf("2026-10-05")).toBe("2026-10-05"); // Monday
    expect(mondayOf("2026-10-09")).toBe("2026-10-05"); // Friday
    expect(mondayOf("2026-10-11")).toBe("2026-10-05"); // Sunday
  });

  it("lists Monday to Friday, across month ends", () => {
    expect(weekDays("2026-09-28")).toEqual(["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]);
  });

  it("knows the weekday and can step by days", () => {
    expect(weekdayOf("2026-10-04")).toBe(7);
    expect(weekdayOf("2026-10-05")).toBe(1);
    expect(addDays("2026-10-05", -7)).toBe("2026-09-28");
  });
});

describe("schemas", () => {
  it("requires some classwork text and trims it", () => {
    expect(classworkSchema.safeParse({ description: "   " }).success).toBe(false);
    expect(classworkSchema.parse({ description: "  Painted leaves " }).description).toBe("Painted leaves");
  });

  it("accepts a week of days and rejects a bad date or an over-long topic", () => {
    const ok = { categoryId: "c1", weekStart: "2026-10-05", days: [{ date: "2026-10-05", topic: "Colours" }] };
    expect(lessonPlanPutSchema.safeParse(ok).success).toBe(true);
    expect(lessonPlanPutSchema.safeParse({ ...ok, days: [{ date: "5 Oct", topic: "x" }] }).success).toBe(false);
    expect(lessonPlanPutSchema.safeParse({ ...ok, days: [{ date: "2026-10-05", topic: "x".repeat(201) }] }).success).toBe(false);
  });
});
