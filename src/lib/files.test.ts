import { describe, expect, it } from "vitest";
import {
  canSeeFolder,
  isFolderKey,
  isMonthKey,
  monthKeyOf,
  monthKeyOfDateOnly,
  monthLabel,
  monthRange,
  sortMonthsDesc,
  statementDisplayName,
  visibleFolders,
} from "./files";

describe("folders per mode", () => {
  it("accounting shows only Statements, and only with VIEW_MONEY", () => {
    expect(visibleFolders("accounting", ["VIEW_MONEY", "MANAGE_REPORTS", "MANAGE_ATTENDANCE"])).toEqual([
      "statements",
    ]);
    expect(visibleFolders("accounting", ["VIEW_ACCOUNTING"])).toEqual([]);
  });

  it("centre shows every folder to someone with all the permissions", () => {
    expect(
      visibleFolders("centre", ["VIEW_MONEY", "MANAGE_CHILDREN", "MANAGE_REPORTS", "MANAGE_ATTENDANCE"])
    ).toEqual([
      "statements",
      "enrolment",
      "re-registration",
      "academic",
      "incident",
      "disciplinary",
      "attendance",
    ]);
  });

  it("hides folders the person has no permission for", () => {
    expect(visibleFolders("centre", ["MANAGE_ATTENDANCE"])).toEqual(["attendance"]);
    expect(canSeeFolder("incident", "centre", ["MANAGE_CHILDREN"])).toBe(false);
    expect(canSeeFolder("enrolment", "accounting", ["MANAGE_CHILDREN"])).toBe(false);
  });

  it("recognises folder keys", () => {
    expect(isFolderKey("statements")).toBe(true);
    expect(isFolderKey("../etc")).toBe(false);
    expect(isFolderKey(null)).toBe(false);
  });
});

describe("months", () => {
  it("validates and labels month keys", () => {
    expect(isMonthKey("2026-09")).toBe(true);
    expect(isMonthKey("2026-13")).toBe(false);
    expect(isMonthKey("2026-9")).toBe(false);
    expect(monthLabel("2026-09")).toBe("September 2026");
  });

  it("names a statement like 'James Sep Statement'", () => {
    expect(statementDisplayName("James", "2026-09")).toBe("James Sep Statement");
  });

  it("puts a late-evening 30 September in September for a Johannesburg school", () => {
    // 21:30 UTC on 30 Sep is 23:30 in Johannesburg: still September.
    expect(monthKeyOf(new Date("2026-09-30T21:30:00Z"), "Africa/Johannesburg")).toBe("2026-09");
    // 22:30 UTC on 30 Sep is 00:30 on 1 Oct in Johannesburg: October.
    expect(monthKeyOf(new Date("2026-09-30T22:30:00Z"), "Africa/Johannesburg")).toBe("2026-10");
  });

  it("reads date-only values by their UTC month", () => {
    expect(monthKeyOfDateOnly(new Date("2026-09-01T00:00:00Z"))).toBe("2026-09");
  });

  it("builds month ranges on the school's wall clock", () => {
    const { start, end } = monthRange("2026-09", "Africa/Johannesburg");
    expect(start.toISOString()).toBe("2026-08-31T22:00:00.000Z");
    expect(end.toISOString()).toBe("2026-09-30T22:00:00.000Z");
  });

  it("rolls December into the next year", () => {
    const { start, end } = monthRange("2026-12", "Africa/Johannesburg");
    expect(start.toISOString()).toBe("2026-11-30T22:00:00.000Z");
    expect(end.toISOString()).toBe("2026-12-31T22:00:00.000Z");
  });

  it("sorts newest first with no duplicates", () => {
    expect(sortMonthsDesc(["2026-08", "2026-10", "2026-08", "2025-12"])).toEqual([
      "2026-10",
      "2026-08",
      "2025-12",
    ]);
  });
});
