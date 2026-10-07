import { describe, expect, it } from "vitest";
import { childCreateSchema } from "@/lib/validation";

const base = {
  categoryId: "ckabcdefghijklmnopqrstuvw",
  firstName: "Test",
  lastName: "Child",
  enrollmentDate: "2026-10-07",
};

describe("quick add child", () => {
  it("accepts just a name, surname, class and start date", () => {
    const parsed = childCreateSchema.parse({ ...base, quickAdd: true });
    expect(parsed.quickAdd).toBe(true);
    expect(parsed.parentName).toBeUndefined();
    expect(parsed.dateOfBirth).toBeUndefined();
  });

  it("still requires the name and surname", () => {
    expect(() => childCreateSchema.parse({ ...base, firstName: "", quickAdd: true })).toThrow();
    expect(() => childCreateSchema.parse({ ...base, lastName: " ", quickAdd: true })).toThrow();
  });
});
