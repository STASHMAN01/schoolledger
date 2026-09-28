import { describe, it, expect } from "vitest";
import { emergencyContactProblem, storedEmergencyPhone } from "./emergencyContact";

const parents = [
  { firstName: "Naledi", lastName: "Mokoena", phone: "082 000 0000" },
  { firstName: "Sipho", lastName: "Mokoena", phone: "+27830000000" },
];

describe("emergency contact rule", () => {
  it("is fine when no emergency contact is given", () => {
    expect(emergencyContactProblem({}, parents)).toBeNull();
    expect(emergencyContactProblem({ name: "", phone: " " }, parents)).toBeNull();
  });

  it("accepts a different person with a different number", () => {
    expect(emergencyContactProblem({ name: "Gogo Dlamini", relationship: "Grandmother", phone: "084 000 0000" }, parents)).toBeNull();
  });

  it("needs both a name and a phone once one is filled in", () => {
    expect(emergencyContactProblem({ name: "Gogo Dlamini" }, parents)).toMatch(/phone number/);
    expect(emergencyContactProblem({ phone: "084 000 0000" }, parents)).toMatch(/name/);
  });

  it("rejects a parent's phone number, whatever way it's written", () => {
    expect(emergencyContactProblem({ name: "Gogo", phone: "0820000000" }, parents)).toMatch(/same as a parent/);
    expect(emergencyContactProblem({ name: "Gogo", phone: "083 000 0000" }, parents)).toMatch(/same as a parent/);
  });

  it("rejects one of the parents by name", () => {
    expect(emergencyContactProblem({ name: " naledi  MOKOENA ", phone: "084 000 0000" }, parents)).toMatch(/someone other than/);
  });

  it("checks against a parent given as one full name too", () => {
    expect(
      emergencyContactProblem({ name: "Marie Botha", phone: "084 000 0000" }, [{ name: "Marie Botha", phone: null }])
    ).toMatch(/someone other than/);
  });

  it("stores SA numbers in international format and keeps anything else as typed", () => {
    expect(storedEmergencyPhone("084 000 0000")).toBe("+27840000000");
    expect(storedEmergencyPhone("")).toBeNull();
    expect(storedEmergencyPhone("ext 204")).toBe("ext 204");
  });
});

describe("emergency contact vs a parent's extra numbers", () => {
  it("rejects a number that matches a parent's second or third phone", () => {
    expect(
      emergencyContactProblem({ name: "Aunt Mary", phone: "0831112222" }, [
        { firstName: "Thandi", lastName: "Mokoena", phone: "0821234567", extraPhones: ["+27831112222"] },
      ])
    ).toMatch(/same as a parent/);
  });
  it("accepts a number that matches none of them", () => {
    expect(
      emergencyContactProblem({ name: "Aunt Mary", phone: "0849998888" }, [
        { firstName: "Thandi", lastName: "Mokoena", phone: "0821234567", extraPhones: ["0831112222"] },
      ])
    ).toBeNull();
  });
});
