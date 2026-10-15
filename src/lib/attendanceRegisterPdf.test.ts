import { describe, expect, it } from "vitest";
import {
  buildRegisterFilename,
  generateAttendanceRegisterPdf,
  registerChildLabel,
  weekdaysOfMonth,
} from "./attendanceRegisterPdf";

describe("attendance register PDF", () => {
  it("lists only weekdays", () => {
    // September 2026 starts on a Tuesday and has 22 weekdays.
    const days = weekdaysOfMonth("2026-09");
    expect(days).toHaveLength(22);
    expect(days[0]).toBe(1);
    expect(days).not.toContain(5); // Saturday
    expect(days).not.toContain(6); // Sunday
  });

  it("produces a PDF, including for an empty class and many children", async () => {
    const org = { name: "Test School", addressLine1: null, addressLine2: null, province: null };
    const empty = await generateAttendanceRegisterPdf(org, "Butterflies", "2026-09", []);
    expect(Buffer.from(empty).subarray(0, 5).toString()).toBe("%PDF-");

    const many = Array.from({ length: 60 }, (_, i) => ({
      firstName: `Child${i}`,
      lastName: "Example",
      marks: new Map<number, "PRESENT" | "ABSENT">([
        [1, "PRESENT"],
        [2, i % 2 ? "ABSENT" : "PRESENT"],
      ]),
    }));
    const full = await generateAttendanceRegisterPdf(org, "Butterflies", "2026-09", many);
    expect(Buffer.from(full).subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("puts the grade after the child's name (class groups)", async () => {
    expect(registerChildLabel({ firstName: "Thabo", lastName: "Mokoena", gradeName: "Gr 3" })).toBe("Thabo Mokoena (Gr 3)");
    expect(registerChildLabel({ firstName: "Thabo", lastName: "Mokoena", gradeName: null })).toBe("Thabo Mokoena");
    expect(registerChildLabel({ firstName: "Thabo", lastName: "Mokoena" })).toBe("Thabo Mokoena");

    const org = { name: "Test School", addressLine1: null, addressLine2: null, province: null };
    const kids = [
      { firstName: "Thabo", lastName: "Mokoena", gradeName: "Gr 3", marks: new Map<number, "PRESENT" | "ABSENT">([[1, "PRESENT"]]) },
      { firstName: "A very long first name indeed", lastName: "With an even longer surname", gradeName: "Gr 12", marks: new Map() },
      { firstName: "Ungraded", lastName: "Child", gradeName: null, marks: new Map() },
    ];
    const pdf = await generateAttendanceRegisterPdf(org, "Aftercare", "2026-09", kids);
    expect(Buffer.from(pdf).subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("builds a safe filename", () => {
    expect(buildRegisterFilename("Butter flies!", "2026-09")).toBe("attendance-register-butter-flies-2026-09.pdf");
  });
});
