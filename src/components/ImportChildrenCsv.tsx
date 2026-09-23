"use client";

import { useRef, useState } from "react";
import { Button, Card, Input, Label, Select } from "@/components/ui";
import { parseCsv, csvRowsToRecords, toCsv } from "@/lib/csv";
import { todayLocal } from "@/lib/date";

type Category = { id: string; name: string };

type ImportResult = { created: number; errors: { row: number; error: string }[] };

const TEMPLATE_HEADERS = [
  "Child First Name",
  "Child Last Name",
  "Parent First Name",
  "Parent Last Name",
  "Parent Phone",
  "Parent Email",
  "Class",
  "Enrollment Date",
  "Parent ID",
  "Child ID",
];

function downloadTemplate() {
  const csv = toCsv([
    TEMPLATE_HEADERS,
    [
      "Thandiwe",
      "Nkosi",
      "Sipho",
      "Nkosi",
      "+27821234567",
      "sipho@example.com",
      "",
      "",
      "",
      "",
    ],
  ]);
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "crechely-children-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Bulk-add children from a CSV export of whatever spreadsheet a school
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
    const text = await file.text();
    const parsed = csvRowsToRecords(parseCsv(text));
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
      const data = await res.json();
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
        Import CSV
      </Button>
    );
  }

  return (
    <Card className="mb-6 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold text-foreground">
          Import children from a CSV
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
        Columns: child first/last name and parent first/last name (or a single
        parent name column) are required. Parent phone, parent email,
        class, enrollment date, parent ID and child ID are all optional —
        rows without a class or enrollment date use the defaults below.
      </p>

      <button
        type="button"
        onClick={downloadTemplate}
        className="mb-4 text-sm text-brand underline hover:brightness-90"
      >
        Download a template CSV
      </button>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Label className="flex flex-col gap-1">
          CSV file
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
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
          Default enrollment date
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
