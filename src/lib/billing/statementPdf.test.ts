import { describe, it, expect } from "vitest";
import { buildStatementFilename } from "./statementPdf";

describe("buildStatementFilename", () => {
  it("includes the child's first and last name, 'Statement', the month, and the year", () => {
    const name = buildStatementFilename("Alice", "Smith", new Date(2026, 8, 16)); // September
    expect(name).toBe("Alice-Smith-Statement-September-2026.pdf");
  });

  it("strips characters that aren't safe across filesystems/attachments", () => {
    const name = buildStatementFilename("O'Brien-Jones", "Müller", new Date(2026, 0, 1));
    // Accents are stripped, apostrophes/hyphens collapse to single hyphens.
    expect(name).toBe("O-Brien-Jones-Muller-Statement-January-2026.pdf");
  });

  it("defaults to the current date when none is passed", () => {
    const name = buildStatementFilename("Alice", "Smith");
    expect(name).toMatch(/^Alice-Smith-Statement-[A-Za-z]+-\d{4}\.pdf$/);
  });
});
