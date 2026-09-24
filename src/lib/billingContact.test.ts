import { describe, expect, it } from "vitest";
import { billingFieldsFromGuardian, pickBillingGuardianId } from "./billingContact";

// Fictional test data only (POPIA rule: no real names or numbers).
const g = (id: string, firstName: string, lastName: string, phone: string | null, email: string | null) => ({
  id,
  firstName,
  lastName,
  phone,
  email,
});

describe("pickBillingGuardianId", () => {
  const guardians = [
    g("a", "Test", "Parentone", "082 000 0001", "family@example.test"),
    g("b", "Sample", "Parenttwo", "082 000 0002", "family@example.test"),
  ];

  it("matches on full name first, ignoring case and extra spaces", () => {
    expect(
      pickBillingGuardianId(guardians, { parentName: "  sample   PARENTTWO ", parentPhone: null, parentEmail: "family@example.test" })
    ).toBe("b");
  });

  it("falls back to email, then phone in any SA format", () => {
    expect(pickBillingGuardianId(guardians, { parentName: "Someone Else", parentPhone: null, parentEmail: "FAMILY@example.test" })).toBe("a");
    expect(pickBillingGuardianId(guardians, { parentName: "Someone Else", parentPhone: "+27820000002", parentEmail: null })).toBe("b");
  });

  it("returns null when nobody matches", () => {
    expect(pickBillingGuardianId(guardians, { parentName: "Nobody", parentPhone: "+27829999999", parentEmail: null })).toBeNull();
  });
});

describe("billingFieldsFromGuardian", () => {
  it("normalises a local phone number and trims the name", () => {
    const r = billingFieldsFromGuardian({ firstName: " Test ", lastName: "Parentone", phone: "082 000 0001", email: "a@example.test" });
    expect(r.phoneProblem).toBe(false);
    expect(r.fields).toEqual({ parentName: "Test Parentone", parentPhone: "+27820000001", parentEmail: "a@example.test" });
  });

  it("flags a phone that can't be used for reminders instead of copying it", () => {
    const r = billingFieldsFromGuardian({ firstName: "Test", lastName: "Parentone", phone: "ask at work", email: null });
    expect(r.phoneProblem).toBe(true);
    expect(r.fields.parentPhone).toBeNull();
  });

  it("allows a guardian with no phone", () => {
    const r = billingFieldsFromGuardian({ firstName: "Test", lastName: "Parentone", phone: null, email: null });
    expect(r.phoneProblem).toBe(false);
    expect(r.fields.parentPhone).toBeNull();
  });
});
