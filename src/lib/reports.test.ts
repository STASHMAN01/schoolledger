import { describe, expect, it } from "vitest";
import { blankToNull, reportCreateSchema, resolveReportScope } from "./reports";

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
