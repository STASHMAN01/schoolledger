import { describe, it, expect } from "vitest";
import { compactHeader, fixIdNumber, hasRequiredColumns, readImportRow } from "./childImport";
import { csvRowsToRecords } from "./csv";
import { normalizePhone } from "./phone";

// Rows as the upload screen produces them: header -> value.
function rows(table: string[][]) {
  return csvRowsToRecords(table);
}

describe("reading a school's own spreadsheet", () => {
  it("reads the layout schools already use (Dylan's example sheet)", () => {
    const [raw] = rows([
      ["childs name", "childs surname", "id no.", "parent 1 name", "parent 1 surname", "parent 1 id", "parent 1 occupation"],
      ["John", "Doe", "12345", "mary", "doe", "54321", "nurse"],
    ]);
    const r = readImportRow(raw);
    expect(r.firstName).toBe("John");
    expect(r.lastName).toBe("Doe");
    expect(r.idNumber).toBe("12345");
    expect(r.parents).toEqual([
      { firstName: "mary", lastName: "doe", idNumber: "54321", phone: "", email: "", occupation: "nurse", relationship: "" },
    ]);
  });

  it("reads the Excel template's headings, including a second parent", () => {
    const [raw] = rows([
      ["Child's Name", "Child's Surname", "Date of Birth", "Gender", "ID No.", "Class",
       "Parent 1 Name", "Parent 1 Surname", "Parent 1 Relationship", "Parent 1 Phone", "Parent 1 Email",
       "Parent 2 Name", "Parent 2 Surname", "Parent 2 Occupation"],
      ["Lerato", "Mokoena", "21/03/2022", "F", "", "Ducks",
       "Naledi", "Mokoena", "Mother", "082 000 0000", "n@example.com",
       "Sipho", "Mokoena", "Teacher"],
    ]);
    const r = readImportRow(raw);
    expect(r.className).toBe("Ducks");
    expect(r.dateOfBirth).toBe("21/03/2022");
    expect(r.parents).toHaveLength(2);
    expect(r.parents[0]).toMatchObject({ firstName: "Naledi", relationship: "Mother", phone: "082 000 0000" });
    expect(r.parents[1]).toMatchObject({ firstName: "Sipho", occupation: "Teacher" });
  });

  it("still reads the older template's headings", () => {
    const [raw] = rows([
      ["Child First Name", "Child Last Name", "Parent First Name", "Parent Last Name", "Parent Phone", "Parent Email", "Parent ID", "Child ID"],
      ["Anna", "Botha", "Marie", "Botha", "082 111 2222", "m@example.com", "7001010000000", "1901010000000"],
    ]);
    const r = readImportRow(raw);
    expect(r).toMatchObject({ firstName: "Anna", lastName: "Botha", idNumber: "1901010000000" });
    expect(r.parents[0]).toMatchObject({ firstName: "Marie", lastName: "Botha", phone: "082 111 2222", idNumber: "7001010000000" });
  });

  it("splits a single 'Parent Name' column into first name and surname", () => {
    const [raw] = rows([["Name", "Surname", "Parent Name"], ["Anna", "Botha", "Marie du Toit"]]);
    expect(readImportRow(raw).parents[0]).toMatchObject({ firstName: "Marie du", lastName: "Toit" });
  });

  it("leaves out parent 2 when those columns are empty", () => {
    const [raw] = rows([["Child's Name", "Child's Surname", "Parent 1 Name", "Parent 2 Name"], ["Anna", "Botha", "Marie", ""]]);
    expect(readImportRow(raw).parents).toHaveLength(1);
  });
});

describe("Excel's lost leading zeros", () => {
  it("puts the 0 back on a 13-digit ID number Excel shortened to 12", () => {
    expect(fixIdNumber("503215800084")).toBe("0503215800084");
    expect(fixIdNumber("8801015800084")).toBe("8801015800084");
    expect(fixIdNumber("12345")).toBe("12345");
  });

  it("reads a phone number Excel turned into 821234567", () => {
    expect(normalizePhone("821234567")).toBe("+27821234567");
    expect(normalizePhone("082 123 4567")).toBe("+27821234567");
  });
});

describe("headings", () => {
  it("compacts spelling variants to one key", () => {
    expect(compactHeader("Child's Name")).toBe("childname");
    expect(compactHeader("childs name")).toBe("childname");
    expect(compactHeader("ID No.")).toBe("idno");
    expect(compactHeader("Parent 1 Surname")).toBe("parent1surname");
  });

  it("requires the child's first name and surname columns", () => {
    expect(hasRequiredColumns(["childs name", "childs surname"])).toBe(true);
    expect(hasRequiredColumns(["Child First Name", "Child Last Name"])).toBe(true);
    expect(hasRequiredColumns(["Kid", "Family"])).toBe(false);
  });
});
