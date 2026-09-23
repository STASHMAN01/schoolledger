// Today's date as YYYY-MM-DD in the viewer's own timezone. Never use
// `new Date().toISOString().slice(0, 10)` for this: that's the UTC date,
// which in South Africa (UTC+2) is still yesterday until 02:00.
export function todayLocal(): string {
  return new Date().toLocaleDateString("en-CA");
}
