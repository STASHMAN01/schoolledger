import { describe, expect, it } from "vitest";
import {
  ALL_CLASSES,
  batchProgress,
  bucketTasks,
  classStatus,
  dayLabel,
  groupTaskItems,
  isOverdue,
  normaliseTaskDate,
  schoolDateOf,
  shiftTaskDate,
  taskCreateSchema,
  taskState,
} from "./teacherTasks";

describe("taskCreateSchema", () => {
  it("needs a class and a title", () => {
    expect(taskCreateSchema.safeParse({ categoryId: "", title: "x" }).success).toBe(false);
    expect(taskCreateSchema.safeParse({ categoryId: "c1", title: "  " }).success).toBe(false);
    expect(taskCreateSchema.parse({ categoryId: "c1", title: " Tidy the book corner " }).title).toBe("Tidy the book corner");
  });
  it("accepts the all-classes choice", () => {
    expect(taskCreateSchema.parse({ categoryId: ALL_CLASSES, title: "Fire drill at 10" }).categoryId).toBe(ALL_CLASSES);
  });
  it("accepts an optional due date and rejects a bad one", () => {
    expect(taskCreateSchema.safeParse({ categoryId: "c1", title: "x", dueDate: "2026-10-09" }).success).toBe(true);
    expect(taskCreateSchema.safeParse({ categoryId: "c1", title: "x", dueDate: "Friday" }).success).toBe(false);
  });
});

describe("taskState and isOverdue", () => {
  it("moves new -> open -> done", () => {
    expect(taskState({ acknowledgedAt: null, completedAt: null })).toBe("new");
    expect(taskState({ acknowledgedAt: new Date(), completedAt: null })).toBe("open");
    expect(taskState({ acknowledgedAt: new Date(), completedAt: new Date() })).toBe("done");
  });
  it("is overdue only when unfinished and past its due day", () => {
    expect(isOverdue({ dueDate: "2026-10-04", completedAt: null }, "2026-10-05")).toBe(true);
    expect(isOverdue({ dueDate: "2026-10-05", completedAt: null }, "2026-10-05")).toBe(false);
    expect(isOverdue({ dueDate: "2026-10-04", completedAt: new Date() }, "2026-10-05")).toBe(false);
    expect(isOverdue({ dueDate: null, completedAt: null }, "2026-10-05")).toBe(false);
  });
});

const TZ = "Africa/Johannesburg";
const TODAY = "2026-10-15";

function task(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    batchId: null as string | null,
    dueDate: null as string | null,
    acknowledgedAt: null as string | null,
    completedAt: null as string | null,
    category: { name: "Class " + id },
    ...over,
  };
}

describe("normaliseTaskDate", () => {
  it("keeps a real date and falls back otherwise", () => {
    expect(normaliseTaskDate("2026-10-16", TODAY)).toBe("2026-10-16");
    expect(normaliseTaskDate("2026-02-30", TODAY)).toBe(TODAY);
    expect(normaliseTaskDate("Friday", TODAY)).toBe(TODAY);
    expect(normaliseTaskDate(null, TODAY)).toBe(TODAY);
    expect(normaliseTaskDate("", TODAY)).toBe(TODAY);
  });
});

describe("schoolDateOf", () => {
  it("uses the school's timezone, not UTC", () => {
    // 22:30 UTC on the 14th is 00:30 on the 15th in Johannesburg.
    expect(schoolDateOf("2026-10-14T22:30:00.000Z", TZ)).toBe("2026-10-15");
    expect(schoolDateOf(new Date("2026-10-15T21:30:00.000Z"), TZ)).toBe("2026-10-15");
    expect(schoolDateOf(new Date("2026-10-15T22:30:00.000Z"), TZ)).toBe("2026-10-16");
  });
});

describe("bucketTasks", () => {
  const rows = [
    task("due-today", { dueDate: TODAY }),
    task("due-tomorrow", { dueDate: "2026-10-16" }),
    task("overdue", { dueDate: "2026-10-10" }),
    task("no-date", {}),
    task("done-today", { dueDate: TODAY, completedAt: "2026-10-15T08:00:00.000Z" }),
    task("done-undated-today", { completedAt: "2026-10-15T07:00:00.000Z" }),
    task("done-undated-late", { completedAt: "2026-10-14T22:30:00.000Z" }), // 15th, school time
    task("done-undated-earlier", { completedAt: "2026-10-12T08:00:00.000Z" }),
    task("done-overdue-one", { dueDate: "2026-10-10", completedAt: "2026-10-15T08:00:00.000Z" }),
    task("done-early", { dueDate: "2026-10-20", completedAt: "2026-10-15T09:00:00.000Z" }),
  ];
  const ids = (list: { id: string }[]) => list.map((t) => t.id);

  it("on today: due today, overdue, no date, and done", () => {
    const b = bucketTasks(rows, TODAY, TODAY, TZ);
    expect(ids(b.todo)).toEqual(["due-today"]);
    expect(ids(b.overdue)).toEqual(["overdue"]);
    expect(ids(b.noDate)).toEqual(["no-date"]);
    // Done is what was ticked off today: due today, undated, or overdue.
    expect(ids(b.done)).toEqual([
      "done-today",
      "done-undated-today",
      "done-undated-late",
      "done-overdue-one",
      "done-early",
    ]);
  });
  it("counts a task finished early on the day it was ticked, not its due day", () => {
    expect(ids(bucketTasks(rows, "2026-10-20", TODAY, TZ).done)).toEqual([]);
    expect(ids(bucketTasks(rows, "2026-10-10", TODAY, TZ).done)).toEqual([]);
  });
  it("on another day: only that day's tasks, no overdue or no-date", () => {
    const b = bucketTasks(rows, "2026-10-16", TODAY, TZ);
    expect(ids(b.todo)).toEqual(["due-tomorrow"]);
    expect(b.overdue).toEqual([]);
    expect(b.noDate).toEqual([]);
    expect(b.done).toEqual([]);
  });
  it("a past day shows what was finished then, and nothing open", () => {
    const b = bucketTasks(rows, "2026-10-12", TODAY, TZ);
    expect(b.todo).toEqual([]);
    expect(ids(b.done)).toEqual(["done-undated-earlier"]);
  });
});

describe("dates for the bar", () => {
  it("shifts by whole days across a month end", () => {
    expect(shiftTaskDate("2026-10-31", 1)).toBe("2026-11-01");
    expect(shiftTaskDate("2026-10-01", -1)).toBe("2026-09-30");
  });
  it("labels today, tomorrow, yesterday and other days", () => {
    expect(dayLabel(TODAY, TODAY)).toBe("Today");
    expect(dayLabel("2026-10-16", TODAY)).toBe("Tomorrow");
    expect(dayLabel("2026-10-14", TODAY)).toBe("Yesterday");
    expect(dayLabel("2026-10-22", TODAY)).toBe("Thu 22 Oct");
    expect(dayLabel("2026-12-01", TODAY)).toBe("Tue 1 Dec");
  });
});

describe("classStatus", () => {
  it("is done, overdue, opened or not opened yet", () => {
    expect(classStatus({ dueDate: TODAY, acknowledgedAt: null, completedAt: "2026-10-15T08:00:00Z" }, TODAY)).toBe("done");
    expect(classStatus({ dueDate: "2026-10-10", acknowledgedAt: "2026-10-11T08:00:00Z", completedAt: null }, TODAY)).toBe("overdue");
    expect(classStatus({ dueDate: TODAY, acknowledgedAt: "2026-10-15T08:00:00Z", completedAt: null }, TODAY)).toBe("open");
    expect(classStatus({ dueDate: null, acknowledgedAt: null, completedAt: null }, TODAY)).toBe("new");
  });
});

describe("groupTaskItems", () => {
  const copy = (id: string, className: string, over: Record<string, unknown> = {}) =>
    task(id, { batchId: "b1", dueDate: TODAY, category: { name: className }, ...over });
  const DONE = "2026-10-15T08:00:00.000Z";

  it("merges the copies of one batch into a single row with progress", () => {
    const a = copy("1", "Bumblebees");
    const b = copy("2", "Ladybirds", { completedAt: DONE });
    const c = copy("3", "Caterpillars", { completedAt: DONE });
    const items = groupTaskItems([a], [a, b, c], "todo", true);
    expect(items).toHaveLength(1);
    const item = items[0];
    expect(item.kind).toBe("batch");
    if (item.kind !== "batch") return;
    expect(item.batch.total).toBe(3);
    expect(item.batch.doneCount).toBe(2);
    expect(item.batch.tasks.map((t) => t.category.name)).toEqual(["Bumblebees", "Caterpillars", "Ladybirds"]);
    expect(batchProgress(item.batch)).toBe("2 of 3 classes done");
  });
  it("one row even when several copies are in the list", () => {
    const rows = [copy("1", "A"), copy("2", "B"), copy("3", "C")];
    expect(groupTaskItems(rows, rows, "todo", true)).toHaveLength(1);
  });
  it("keeps the batch off Done until every copy is finished", () => {
    const a = copy("1", "A");
    const b = copy("2", "B", { completedAt: DONE });
    expect(groupTaskItems([b], [a, b], "done", true)).toEqual([]);
    expect(groupTaskItems([a], [a, b], "todo", true)).toHaveLength(1);
  });
  it("moves a batch to Done and out of To do once all copies are finished", () => {
    const a = copy("1", "A", { completedAt: DONE });
    const b = copy("2", "B", { completedAt: DONE });
    expect(groupTaskItems([a, b], [a, b], "done", true)).toHaveLength(1);
    expect(groupTaskItems([a, b], [a, b], "todo", true)).toEqual([]);
  });
  it("puts a finished batch in Done only on the day its last copy was ticked off", () => {
    const early = copy("1", "A", { completedAt: "2026-10-14T08:00:00.000Z" });
    const last = copy("2", "B", { completedAt: DONE });
    const all = [early, last];
    // On the 15th the last copy was ticked off: the batch is there.
    expect(groupTaskItems([last], all, "done", true, { date: TODAY, timeZone: TZ })).toHaveLength(1);
    // On the 14th only the first copy was: the batch is not done by then.
    expect(groupTaskItems([early], all, "done", true, { date: "2026-10-14", timeZone: TZ })).toEqual([]);
  });
  it("shows individual rows when not grouping (a class is picked, or a teacher)", () => {
    const rows = [copy("1", "A"), copy("2", "B")];
    const items = groupTaskItems(rows, rows, "todo", false);
    expect(items.map((i) => i.kind)).toEqual(["single", "single"]);
  });
  it("leaves ungrouped tasks and lone copies as single rows, in order", () => {
    const plain = task("p");
    const lone = copy("1", "A");
    const items = groupTaskItems([plain, lone], [lone], "todo", true);
    expect(items.map((i) => i.kind)).toEqual(["single", "single"]);
  });
  it("counts progress from siblings on other days", () => {
    const open = copy("1", "A", { dueDate: null });
    const finishedEarlier = copy("2", "B", { dueDate: null, completedAt: "2026-10-12T08:00:00.000Z" });
    const items = groupTaskItems([open], [open, finishedEarlier], "todo", true);
    expect(items[0].kind === "batch" && batchProgress(items[0].batch)).toBe("1 of 2 classes done");
  });
});
