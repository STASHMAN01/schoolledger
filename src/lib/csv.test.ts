import { describe, it, expect } from "vitest";
import { parseCsv, detectDelimiter, csvRowsToRecords } from "./csv";
import { hasRequiredColumns } from "./childImport";

describe("CSV import separators", () => {
  it("reads comma-separated files", () => {
    expect(parseCsv("Child First Name,Child Last Name\nThabo,Mokoena\n")).toEqual([
      ["Child First Name", "Child Last Name"],
      ["Thabo", "Mokoena"],
    ]);
  });

  it("reads semicolon files (Excel on South African regional settings)", () => {
    const text = "Child First Name;Child Last Name;Parent Phone\r\nAnna;van der Merwe;082 000 0000\r\n";
    expect(detectDelimiter(text)).toBe(";");
    expect(parseCsv(text)[1]).toEqual(["Anna", "van der Merwe", "082 000 0000"]);
  });

  it("keeps commas inside values in a semicolon file", () => {
    expect(parseCsv('Child First Name;Notes\nLiam;"allergic to nuts, eggs"\n')[1]).toEqual([
      "Liam",
      "allergic to nuts, eggs",
    ]);
  });

  it("reads tab-separated files (copied or saved as Text from Excel)", () => {
    expect(parseCsv("Child First Name\tChild Last Name\nZoe\tNaidoo\n")[1]).toEqual(["Zoe", "Naidoo"]);
  });

  it("ignores the byte-order mark Excel adds to CSV UTF-8 files", () => {
    const records = csvRowsToRecords(parseCsv("﻿Child First Name;Child Last Name\nAnna;Botha\n"));
    expect(records[0]["child first name"]).toBe("Anna");
  });

  it("defaults to comma for a single-column file", () => {
    expect(detectDelimiter("Name\nAnna\n")).toBe(",");
  });
});

describe("hasRequiredColumns", () => {
  it("accepts the template's headings and common alternatives", () => {
    expect(hasRequiredColumns(["Child First Name", "Child Last Name"])).toBe(true);
    expect(hasRequiredColumns([" first name ", "Surname"])).toBe(true);
  });

  it("rejects a file whose columns weren't split (wrong separator) or don't match", () => {
    expect(hasRequiredColumns(["Child First Name|Child Last Name"])).toBe(false);
    expect(hasRequiredColumns(["Kid", "Family"])).toBe(false);
  });
});
