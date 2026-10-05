import { describe, expect, it } from "vitest";
import {
  canGiveDose,
  consentStatements,
  coversDate,
  dosesDue,
  isSignatureImage,
  medicineCreateSchema,
  parentSignSchema,
} from "./medicine";

const sig = "data:image/png;base64," + "A".repeat(900);

const base = {
  childId: "c1",
  medicineName: "Amoxicillin",
  reason: "Ear infection",
  isPrescribed: true,
  dose: "5 ml",
  route: "ORAL",
  frequency: "Twice a day",
  scheduledTimes: ["10:00", "14:00"],
  startDate: "2026-10-05",
  endDate: "2026-10-09",
  storage: "FRIDGE",
  originalContainer: true,
  labelMatches: true,
  notExpired: true,
};

describe("medicineCreateSchema", () => {
  it("accepts a complete form", () => {
    expect(medicineCreateSchema.safeParse(base).success).toBe(true);
  });

  it("refuses medicine that is not in its original container, mislabelled or expired", () => {
    for (const key of ["originalContainer", "labelMatches", "notExpired"] as const) {
      expect(medicineCreateSchema.safeParse({ ...base, [key]: false }).success).toBe(false);
    }
  });

  it("refuses a last day before the first, and a course over 60 days", () => {
    expect(medicineCreateSchema.safeParse({ ...base, endDate: "2026-10-01" }).success).toBe(false);
    expect(medicineCreateSchema.safeParse({ ...base, endDate: "2027-01-01" }).success).toBe(false);
  });

  it("refuses medicine that expires before the course ends", () => {
    expect(medicineCreateSchema.safeParse({ ...base, expiryDate: "2026-10-07" }).success).toBe(false);
    expect(medicineCreateSchema.safeParse({ ...base, expiryDate: "2026-12-01" }).success).toBe(true);
  });

  it("checks the times", () => {
    expect(medicineCreateSchema.safeParse({ ...base, scheduledTimes: ["25:00"] }).success).toBe(false);
  });
});

describe("parent signature", () => {
  const parent = {
    parentName: "Thandi Dlamini",
    parentRelationship: "Mother",
    parentPhone: "0821234567",
    signature: sig,
    agreed: true,
  };

  it("needs a real signature image, a name, a phone and the tick", () => {
    expect(parentSignSchema.safeParse(parent).success).toBe(true);
    expect(parentSignSchema.safeParse({ ...parent, signature: "data:image/png;base64,AAAA" }).success).toBe(false);
    expect(parentSignSchema.safeParse({ ...parent, signature: "data:image/jpeg;base64," + "A".repeat(900) }).success).toBe(false);
    expect(parentSignSchema.safeParse({ ...parent, agreed: false }).success).toBe(false);
    expect(parentSignSchema.safeParse({ ...parent, parentName: "" }).success).toBe(false);
    expect(parentSignSchema.safeParse({ ...parent, parentPhone: "" }).success).toBe(false);
  });

  it("rejects an oversized signature", () => {
    expect(isSignatureImage("data:image/png;base64," + "A".repeat(300_000))).toBe(false);
  });

  it("an unsigned form can be saved to sign later", () => {
    expect(medicineCreateSchema.safeParse({ ...base, sign: undefined }).success).toBe(true);
    expect(medicineCreateSchema.safeParse({ ...base, sign: { parentName: "A" } }).success).toBe(false);
  });
});

describe("canGiveDose", () => {
  const ok = {
    signedAt: new Date(),
    returnedAt: null,
    startDate: "2026-10-05",
    endDate: "2026-10-09",
    expiryDate: "2026-12-01",
  };

  it("allows a signed, in-date dose inside the course", () => {
    expect(canGiveDose(ok, "2026-10-06")).toEqual({ ok: true });
  });

  it("never allows an unsigned form", () => {
    expect(canGiveDose({ ...ok, signedAt: null }, "2026-10-06").ok).toBe(false);
  });

  it("stops outside the course, after hand-back and after expiry", () => {
    expect(canGiveDose(ok, "2026-10-04").ok).toBe(false);
    expect(canGiveDose(ok, "2026-10-10").ok).toBe(false);
    expect(canGiveDose({ ...ok, returnedAt: new Date() }, "2026-10-06").ok).toBe(false);
    expect(canGiveDose({ ...ok, expiryDate: "2026-10-05" }, "2026-10-06").ok).toBe(false);
  });
});

describe("helpers", () => {
  it("covers the course dates inclusively", () => {
    const r = { startDate: "2026-10-05", endDate: "2026-10-07" };
    expect(coversDate(r, "2026-10-05")).toBe(true);
    expect(coversDate(r, "2026-10-07")).toBe(true);
    expect(coversDate(r, "2026-10-08")).toBe(false);
  });

  it("tracks doses due today", () => {
    expect(dosesDue(["10:00", "14:00"], 1)).toEqual({ due: 2, given: 1, allDone: false });
    expect(dosesDue(["10:00"], 1).allDone).toBe(true);
    expect(dosesDue([], 0).allDone).toBe(false);
  });

  it("names the school in the wording the parent agrees to", () => {
    expect(consentStatements("DEES DUCKLING CENTRE")[0]).toContain("DEES DUCKLING CENTRE");
  });
});
