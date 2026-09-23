import { describe, expect, it } from "vitest";
import { missingCoreDetails } from "./childProfile";
import { ageGroupLabel } from "./ageGroup";

describe("missingCoreDetails", () => {
  it("lists what's missing", () => {
    expect(missingCoreDetails({ dateOfBirth: null, gender: null, parentPhone: null, guardians: [] })).toEqual([
      "date of birth",
      "gender",
      "a parent/guardian phone number",
    ]);
  });
  it("accepts a guardian phone instead of the billing phone", () => {
    expect(
      missingCoreDetails({ dateOfBirth: "2022-01-01", gender: "FEMALE", parentPhone: null, guardians: [{ phone: "0820000000" }] })
    ).toEqual([]);
  });
});

describe("ageGroupLabel", () => {
  it("formats months as years", () => {
    expect(ageGroupLabel(24, 36)).toBe("2–3 years");
    expect(ageGroupLabel(30, null)).toBe("2.5 years and older");
    expect(ageGroupLabel(null, 18)).toBe("Up to 1.5 years");
    expect(ageGroupLabel(null, null)).toBeNull();
  });
});
