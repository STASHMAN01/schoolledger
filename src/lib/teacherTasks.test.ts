import { describe, expect, it } from "vitest";
import { isOverdue, taskCreateSchema, taskState } from "./teacherTasks";

describe("taskCreateSchema", () => {
  it("needs a class and a title", () => {
    expect(taskCreateSchema.safeParse({ categoryId: "", title: "x" }).success).toBe(false);
    expect(taskCreateSchema.safeParse({ categoryId: "c1", title: "  " }).success).toBe(false);
    expect(taskCreateSchema.parse({ categoryId: "c1", title: " Tidy the book corner " }).title).toBe("Tidy the book corner");
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
