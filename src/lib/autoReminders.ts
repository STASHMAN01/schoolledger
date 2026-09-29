// South African calendar date for the automatic-reminders cron. SAST is
// UTC+2 all year (no daylight saving), so a fixed offset is exact.
export function saDateParts(now: Date): { isoDate: string; day: number } {
  const sa = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const isoDate = sa.toISOString().slice(0, 10);
  return { isoDate, day: sa.getUTCDate() };
}
