"use client";

import { useRef, useState } from "react";
import { Button, Card, Input, Label, Select } from "@/components/ui";
import { parseCsv, csvRowsToRecords } from "@/lib/csv";
import { todayLocal } from "@/lib/date";
import { hasRequiredColumns } from "@/lib/childImport";

// Excel support (Dylan 23 Sept). The reader is loaded only when someone
// actually picks an .xlsx file. Cells become plain text in the same shape
// the CSV parser produces; real Excel date cells become yyyy-mm-dd.
async function readExcel(file: File): Promise<string[][]> {
  const { readSheet } = await import("read-excel-file/browser");
  const data = await readSheet(file);
  return data.map((row) =>
    row.map((cell) => {
      if (cell === null || cell === undefined) return "";
      if (cell instanceof Date) return cell.toISOString().slice(0, 10);
      return String(cell);
    })
  );
}

type Category = { id: string; name: string };

type ImportResult = { created: number; errors: { row: number; error: string }[] };

// Excel template in the layout schools already use (Child's Name, ID No.,
// Parent 1 / Parent 2 columns), with ID and phone columns formatted as text
// so Excel keeps their leading zeros, plus a "How to fill in" sheet.
// Generated once and served as a static file from /public/templates.
const TEMPLATE_URL = "/templates/crechely-children-template.xlsx";

/**
 * Bulk-add children from the Excel/CSV list a school
 * already had. Class and Enrollment Date columns are optional per row
 * — most schools' existing lists won't have them in this app's shape, so
 * this picks a default for the whole file and only falls back to a row's
 * own value when it has one. See the /children/import route for the full
 * column-matching rules (case-insensitive, several common header names
 * accepted per field).
 */
export function ImportChildrenCsv({
  organizationId,
  categories,
  onImported,
}: {
  organizationId: string;
  categories: Category[];
  onImported: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Record<string, string>[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [defaultCategoryId, setDefaultCategoryId] = useState(categories[0]?.id ?? "");
  const [defaultEnrollmentDate, setDefaultEnrollmentDate] = useState(
    todayLocal
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setResult(null);
    setFileName(file.name);
    let table: string[][];
    try {
      table = /\.xlsx$/i.test(file.name) ? await readExcel(file) : parseCsv(await file.text());
    } catch {
      setError(
        /\.xls$/i.test(file.name)
          ? "That's an older Excel file (.xls). In Excel choose File → Save As → Excel Workbook (.xlsx), then upload that."
          : "That file couldn't be read. Save it as .xlsx or .csv and try again."
      );
      setRows(null);
      return;
    }
    if (table.length > 0 && !hasRequiredColumns(table[0])) {
      setError(
        "We couldn't find the child's first name and last name columns. Check the first row has headings like \"Child's Name\" and \"Child's Surname\" (the Excel template below shows them all)."
      );
      setRows(null);
      return;
    }
    const parsed = csvRowsToRecords(table);
    if (parsed.length === 0) {
      setError("That file doesn't have any data rows — check it has a header row plus at least one child.");
      setRows(null);
      return;
    }
    setRows(parsed);
  }

  async function runImport() {
    if (!rows || !defaultCategoryId) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/organizations/${organizationId}/children/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultCategoryId,
          defaultEnrollmentDate,
          rows,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not import.");
        return;
      }
      setResult(data);
      if (data.created > 0) await onImported();
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setRows(null);
    setFileName("");
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  if (!open) {
    return (
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Import from Excel / CSV
      </Button>
    );
  }

  return (
    <Card className="mb-6 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold text-foreground">
          Import children from Excel or CSV
        </h2>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            reset();
          }}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Close
        </button>
      </div>

      <p className="mb-3 text-sm text-muted-foreground">
        Upload your class list as an Excel (.xlsx) or CSV file with headings in the
        first row. Your own spreadsheet usually works as it is: headings like
        &quot;Child&apos;s Name&quot;, &quot;Surname&quot;, &quot;ID No.&quot;, &quot;DOB&quot; and
        &quot;Parent 1 Name&quot; are recognised. Required: the child&apos;s name and
        surname, and a parent&apos;s name. Parent 1 is used for fees, statements and
        reminders; Parent 2, allergies and an emergency contact are optional (the
        emergency contact must be someone other than the parents). Rows without a class or enrolment date use
        the defaults below, and children missing details are imported and marked
        &quot;incomplete&quot; so you can fill them in later.
      </p>

      <a
        href={TEMPLATE_URL}
        download
        className="mb-4 inline-block text-sm text-brand underline hover:brightness-90"
      >
        Download the Excel template
      </a>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Label className="flex flex-col gap-1">
          Excel or CSV file
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={handleFile}
            className="text-sm text-foreground file:mr-3 file:rounded-lg file:border file:border-border-strong file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground"
          />
        </Label>
        <div />
        <Label className="flex flex-col gap-1">
          Default class (used when a row doesn&apos;t specify one)
          <Select
            required
            value={defaultCategoryId}
            onChange={(e) => setDefaultCategoryId(e.target.value)}
          >
            <option value="">Select a class...</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Label>
        <Label className="flex flex-col gap-1">
          Default enrolment date
          <Input
            type="date"
            value={defaultEnrollmentDate}
            onChange={(e) => setDefaultEnrollmentDate(e.target.value)}
          />
        </Label>
      </div>

      {rows && (
        <p className="mt-3 text-sm text-foreground">
          {fileName}: {rows.length} row{rows.length === 1 ? "" : "s"} ready to import.
        </p>
      )}

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      {result && (
        <div className="mt-3 rounded-lg border border-border bg-background p-3 text-sm">
          <p className="text-foreground">
            Imported {result.created} {result.created === 1 ? "child" : "children"}.
            {result.errors.length > 0 &&
              ` ${result.errors.length} row${result.errors.length === 1 ? "" : "s"} skipped.`}
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1 text-xs text-danger">
              {result.errors.map((e, i) => (
                <li key={i}>
                  Row {e.row}: {e.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <Button
          type="button"
          onClick={runImport}
          disabled={!rows || !defaultCategoryId || busy}
        >
          {busy ? "Importing…" : "Import"}
        </Button>
        {rows && (
          <Button type="button" variant="secondary" onClick={reset} disabled={busy}>
            Choose a different file
          </Button>
        )}
      </div>
    </Card>
  );
}
