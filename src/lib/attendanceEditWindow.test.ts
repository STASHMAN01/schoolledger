import { describe, expect, it } from "vitest";
import {
  canEditRegister,
  earliestEditableRegisterDate,
  editableRegisterDates,
  nextSchoolDay,
  previousSchoolDay,
} from "./attendanceEditWindow";

// 2026-11-04 is a Wednesday.
describe("register edit window", () => {
  it("is today plus the two school days before it", () => {
    expect(editableRegisterDates("2026-11-04")).toEqual(["2026-11-04", "2026-11-03", "2026-11-02"]);
  });

  it("skips the weekend on a Monday and Tuesday", () => {
    // Monday 9 Nov -> Fri 6, Thu 5
    expect(editableRegisterDates("2026-11-09")).toEqual(["2026-11-09", "2026-11-06", "2026-11-05"]);
    // Tuesday 10 Nov -> Mon 9, Fri 6
    expect(editableRegisterDates("2026-11-10")).toEqual(["2026-11-10", "2026-11-09", "2026-11-06"]);
  });

  it("on a weekend, only the last two school days are open", () => {
    // Saturday 7 Nov -> Fri 6, Thu 5
    expect(editableRegisterDates("2026-11-07")).toEqual(["2026-11-06", "2026-11-05"]);
  });

  it("locks older days and future days", () => {
    expect(canEditRegister("2026-11-02", "2026-11-04")).toBe(true);
    expect(canEditRegister("2026-10-30", "2026-11-04")).toBe(false); // 3 school days back
    expect(canEditRegister("2026-11-05", "2026-11-04")).toBe(false); // tomorrow
    expect(earliestEditableRegisterDate("2026-11-04")).toBe("2026-11-02");
  });

  it("steps between school days", () => {
    expect(previousSchoolDay("2026-11-09")).toBe("2026-11-06");
    expect(nextSchoolDay("2026-11-06")).toBe("2026-11-09");
    expect(nextSchoolDay("2026-11-04")).toBe("2026-11-05");
  });
});
