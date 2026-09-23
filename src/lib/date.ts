// Today's date as YYYY-MM-DD in the viewer's own timezone. Never use
// `new Date().toISOString().slice(0, 10)` for this: that's the UTC date,
// which in South Africa (UTC+2) is still yesterday until 02:00.
export function todayLocal(): string {
  return new Date().toLocaleDateString("en-CA");
}

// Reads a date typed or pasted by a person (spreadsheets, forms): accepts
// 2021-03-21, 2021/03/21 and the South African day-first 21/03/2021
// (also with - or .). Returns a UTC-midnight Date -- the same "date only"
// convention every date column in this app uses -- or the input unchanged
// so the schema can report it as invalid. Blank becomes undefined.
export function parseFlexibleDate(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const s = value.trim();
  if (!s) return undefined;
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s);
  if (m) return utcDate(+m[1], +m[2], +m[3]) ?? s;
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s);
  if (m) return utcDate(+m[3], +m[2], +m[1]) ?? s;
  return s;
}

function utcDate(y: number, month: number, d: number): Date | null {
  const date = new Date(Date.UTC(y, month - 1, d));
  // Rejects impossible dates like 31/02 instead of silently rolling over.
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === d ? date : null;
}
