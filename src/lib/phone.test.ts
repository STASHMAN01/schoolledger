import { describe, expect, it } from "vitest";
import { normalizeGender, normalizePhone } from "./phone";
import { parseFlexibleDate } from "./date";

describe("normalizePhone", () => {
  it("converts SA local formats to +27", () => {
    expect(normalizePhone("082 123 4567")).toBe("+27821234567");
    expect(normalizePhone("27821234567")).toBe("+27821234567");
    expect(normalizePhone("+27 82-123-4567")).toBe("+27821234567");
    expect(normalizePhone("")).toBeUndefined();
  });
});

describe("normalizeGender", () => {
  it("maps common spellings", () => {
    expect(normalizeGender("Girl")).toBe("FEMALE");
    expect(normalizeGender("m")).toBe("MALE");
    expect(normalizeGender(" ")).toBeUndefined();
    expect(normalizeGender("x")).toBe("x");
  });
});

describe("parseFlexibleDate", () => {
  it("reads ISO and day-first dates as UTC midnight", () => {
    expect((parseFlexibleDate("2021-03-21") as Date).toISOString()).toBe("2021-03-21T00:00:00.000Z");
    expect((parseFlexibleDate("21/03/2021") as Date).toISOString()).toBe("2021-03-21T00:00:00.000Z");
    expect(parseFlexibleDate("31/02/2021")).toBe("31/02/2021");
    expect(parseFlexibleDate("")).toBeUndefined();
  });
});
