import { describe, expect, it } from "vitest";
import { serializeChild, serializeChildForTeacher } from "./childView";
import { redactMoneyMetadata } from "./auditLabel";

const base = {
  id: "c1",
  firstName: "Test",
  lastName: "Child",
  childIdNumber: "0000000000001",
  parentIdNumber: "9999999999999",
  feeOverrideCents: 150000,
  category: { id: "k1", name: "Class A", monthlyFeeCents: 200000 },
  planEntries: [{ amountDueCents: 100 }],
  creditBalance: { amountCents: 500 },
  guardians: [{ id: "g1", idNumber: "1234567890123" }],
};

describe("serializeChild", () => {
  it("always masks ID numbers, including guardians", () => {
    const out = serializeChild(base, true);
    expect(out.childIdNumber).toBe("•••••••••0001");
    expect(out.parentIdNumber).toBe("•••••••••9999");
    expect(out.guardians[0].idNumber).toBe("•••••••••0123");
    expect(out.feeOverrideCents).toBe(150000);
  });

  it("blanks money without VIEW_MONEY but keeps the shape", () => {
    const out = serializeChild(base, false);
    expect(out.feeOverrideCents).toBeNull();
    expect(out.category.monthlyFeeCents).toBeNull();
    expect(out.category.name).toBe("Class A");
    expect(out.planEntries).toEqual([]);
    expect(out.creditBalance).toBeNull();
  });

  it("does not add fields that were not there", () => {
    const out = serializeChild({ id: "c2", firstName: "A", childIdNumber: null }, false);
    expect(out).toEqual({ id: "c2", firstName: "A", childIdNumber: null });
  });
});

describe("serializeChildForTeacher", () => {
  const teacherSource = {
    id: "c1",
    categoryId: "k1",
    firstName: "Test",
    lastName: "Child",
    dateOfBirth: null,
    gender: null,
    allergies: null,
    emergencyContactName: null,
    emergencyContactRelationship: null,
    emergencyContactPhone: null,
    enrollmentDate: new Date("2026-01-05"),
    exitDate: null,
    archived: false,
    category: { id: "k1", name: "Aftercare" },
  };

  it("includes the grade label (class groups)", () => {
    const out = serializeChildForTeacher({
      ...teacherSource,
      subCategoryId: "g3",
      subCategory: { id: "g3", name: "Gr 3" },
    });
    expect(out.subCategoryId).toBe("g3");
    expect(out.subCategory).toEqual({ id: "g3", name: "Gr 3" });
    expect(out.categoryId).toBe("k1");
  });

  it("has no grade for a child without one", () => {
    const out = serializeChildForTeacher(teacherSource);
    expect(out.subCategoryId).toBeNull();
    expect(out.subCategory).toBeNull();
  });
});

describe("redactMoneyMetadata", () => {
  it("drops amounts and payment labels", () => {
    const out = redactMoneyMetadata({
      action: "payment.deletionRequested",
      metadata: { amountCents: 100, targetLabel: "R1.00 payment for X", reason: "dup" },
    });
    expect(out.metadata).toEqual({ reason: "dup" });
  });

  it("keeps non-payment labels", () => {
    const out = redactMoneyMetadata({ action: "child.deletionRequested", metadata: { targetLabel: "A B" } });
    expect(out.metadata).toEqual({ targetLabel: "A B" });
  });
});
