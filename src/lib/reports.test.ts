import { describe, expect, it } from "vitest";
import { ageAt, blankToNull, reportCreateSchema, resolveReportScope } from "./reports";

describe("resolveReportScope", () => {
  it("TEACHER is always pinned to their own assigned class", () => {
    expect(resolveReportScope("TEACHER", "cat-1", "cat-2")).toEqual({ mode: "single", categoryId: "cat-1" });
  });

  it("TEACHER with no assigned class yet gets none", () => {
    expect(resolveReportScope("TEACHER", null, "cat-2")).toEqual({ mode: "none" });
  });

  it("other roles use the requested class when given one", () => {
    expect(resolveReportScope("ADMIN", null, "cat-2")).toEqual({ mode: "single", categoryId: "cat-2" });
  });

  it("other roles with no requested class see every class", () => {
    expect(resolveReportScope("ADMIN", null, null)).toEqual({ mode: "all" });
  });
});

describe("blankToNull", () => {
  it("turns an empty/whitespace string into null", () => {
    expect(blankToNull("")).toBeNull();
    expect(blankToNull("   ")).toBeNull();
    expect(blankToNull(undefined)).toBeNull();
    expect(blankToNull(null)).toBeNull();
  });

  it("trims and keeps real text", () => {
    expect(blankToNull("  hello  ")).toBe("hello");
  });
});

describe("reportCreateSchema", () => {
  const base = {
    childId: "clh1234567890123456789012",
    type: "INCIDENT" as const,
    occurredAt: "2026-10-01",
    summary: "Fell off the jungle gym.",
    incidentTime: "10:15",
    incidentTypes: ["MINOR_INJURY" as const],
    caregiver: "Ms Naledi",
  };

  it("accepts a minimal valid incident report", () => {
    const parsed = reportCreateSchema.parse(base);
    expect(parsed.summary).toBe("Fell off the jungle gym.");
    expect(parsed.parentNotified).toBe(false);
  });

  it("rejects an empty summary", () => {
    expect(() => reportCreateSchema.parse({ ...base, summary: "   " })).toThrow();
  });

  it("rejects an invalid type", () => {
    expect(() => reportCreateSchema.parse({ ...base, type: "OTHER" })).toThrow();
  });
});

describe("incident template fields", () => {
  const incident = {
    childId: "clh1234567890123456789012",
    type: "INCIDENT" as const,
    occurredAt: "2026-10-01",
    summary: "Fell off the jungle gym.",
    incidentTime: "10:15",
    incidentTypes: ["MINOR_INJURY" as const],
    caregiver: "Ms Naledi",
  };

  it("accepts a complete new incident report", () => {
    expect(reportCreateSchema.parse(incident).incidentTypes).toEqual(["MINOR_INJURY"]);
  });

  it("requires time, a type and the caregiver on a new incident", () => {
    expect(() => reportCreateSchema.parse({ ...incident, incidentTime: "" })).toThrow();
    expect(() => reportCreateSchema.parse({ ...incident, incidentTypes: [] })).toThrow();
    expect(() => reportCreateSchema.parse({ ...incident, caregiver: " " })).toThrow();
  });

  it("needs a description when 'Other' is ticked", () => {
    expect(() => reportCreateSchema.parse({ ...incident, incidentTypes: ["OTHER"] })).toThrow();
    expect(
      reportCreateSchema.parse({ ...incident, incidentTypes: ["OTHER"], incidentTypeOther: "Bee sting" }).incidentTypeOther
    ).toBe("Bee sting");
  });

  it("rejects bad times and unknown types", () => {
    expect(() => reportCreateSchema.parse({ ...incident, incidentTime: "25:00" })).toThrow();
    expect(() => reportCreateSchema.parse({ ...incident, incidentTypes: ["NOPE"] })).toThrow();
  });

  it("does not demand the template fields of other report types", () => {
    expect(() =>
      reportCreateSchema.parse({ childId: incident.childId, type: "ACADEMIC", occurredAt: "2026-10-01", summary: "Good progress." })
    ).not.toThrow();
  });
});

describe("ageAt", () => {
  it("works out years and months as at a date", () => {
    expect(ageAt("2023-07-10", new Date("2026-10-04T00:00:00Z"))).toBe("3 years, 2 months");
    expect(ageAt("2026-08-01", new Date("2026-10-04T00:00:00Z"))).toBe("2 months");
  });
  it("is null without a usable date of birth", () => {
    expect(ageAt(null)).toBeNull();
    expect(ageAt("2030-01-01", new Date("2026-10-04T00:00:00Z"))).toBeNull();
  });
});
