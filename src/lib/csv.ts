// A small hand-rolled CSV reader/writer — RFC 4180-ish (quoted fields,
// doubled quotes, commas/newlines inside quotes). No dependency needed for
// the size of file this product deals with (a school's own class list),
// and it works identically in the browser (children/page.tsx, parsing an
// uploaded file) and on the server (payments export already had its own
// copy of the escaping half of this — kept here so there's one version).

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  // Normalize line endings up front so \r\n and \r don't leave stray \r
  // characters embedded in field values.
  const input = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  // Trailing field/row (a file without a final newline).
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Drop fully-blank trailing rows (a common artifact of Excel exports).
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

// One CSV escaper for the whole app (final inspection D3). Quotes a field
// when it contains a comma, quote or line break (RFC 4180), and defuses
// spreadsheet formulas: a cell starting with = + - @ (or a tab/CR) is
// prefixed with ' so Excel shows it as text instead of running it --
// names and notes are free text typed by people.
export function escapeCsvField(value: string): string {
  let v = value;
  // Plain numbers and phone numbers (+27 82 ..., -150.00) are left alone.
  if (/^[=+\-@\t\r]/.test(v) && !/^[+-]?[\d\s().]+$/.test(v)) v = `'${v}`;
  if (/[",\r\n]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

export function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map(escapeCsvField).join(",")).join("\n");
}

// Turns a parsed CSV (header row + data rows) into an array of
// header→value objects, matching headers case-insensitively and ignoring
// surrounding whitespace so "Parent Email", "parent email", and
// " Parent Email " all line up the same way.
export function csvRowsToRecords(rows: string[][]): Record<string, string>[] {
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => {
    const record: Record<string, string> = {};
    headers.forEach((h, i) => {
      record[h] = (r[i] ?? "").trim();
    });
    return record;
  });
}
