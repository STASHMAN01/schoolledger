import { describe, it, expect } from "vitest";
import { safeDisplayName, schoolFromAddress, schoolSlug } from "./schoolMail";
import { saDateParts } from "./autoReminders";

describe("school sender address", () => {
  it("makes a clean slug from the school name", () => {
    expect(schoolSlug("Sunny Smiles Pre-School (Pty) Ltd")).toBe("sunny-smiles-pre-school-pty-ltd");
    expect(schoolSlug("Kleuterskool Blommeland!")).toBe("kleuterskool-blommeland");
    expect(schoolSlug("Crèche Élan")).toBe("creche-elan");
    expect(schoolSlug("***")).toBe("school");
  });
  it("keeps quotes and angle brackets out of the From header", () => {
    expect(safeDisplayName('Tiny "Tots" <Academy>')).toBe("Tiny Tots Academy");
    expect(schoolFromAddress("Tango's Tots")).toBe("Tango's Tots <tango-s-tots@mail.crechely.co.za>");
  });
});

describe("South African date for the reminders cron", () => {
  it("rolls over at midnight SAST, not UTC", () => {
    expect(saDateParts(new Date("2026-09-30T21:59:00Z"))).toEqual({ isoDate: "2026-09-30", day: 30 });
    expect(saDateParts(new Date("2026-09-30T22:01:00Z"))).toEqual({ isoDate: "2026-10-01", day: 1 });
  });
});
