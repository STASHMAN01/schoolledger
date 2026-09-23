// Phase 5: pure helpers for the weekly class timetable. No db import, so
// they can be unit tested and used on both the server and the client.

export const SCHOOL_DAYS = [
  { day: 1, label: "Monday", short: "Mon" },
  { day: 2, label: "Tuesday", short: "Tue" },
  { day: 3, label: "Wednesday", short: "Wed" },
  { day: 4, label: "Thursday", short: "Thu" },
  { day: 5, label: "Friday", short: "Fri" },
] as const;

export const MAX_SCHEDULE_ITEMS = 100; // per class, whole week

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTime(value: string): boolean {
  return TIME_RE.test(value);
}

// ISO weekday: Monday = 1 ... Sunday = 7.
export function isoWeekday(d: Date): number {
  const js = d.getDay(); // Sunday = 0
  return js === 0 ? 7 : js;
}

export type ScheduleItemInput = {
  dayOfWeek: number;
  startTime: string;
  endTime?: string | null;
  activity: string;
  notes?: string | null;
};

// "HH:MM" strings sort correctly as plain strings.
export function sortScheduleItems<T extends { dayOfWeek: number; startTime: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));
}

/** Returns a human-readable problem with one item, or null if it's fine. */
export function scheduleItemProblem(item: ScheduleItemInput): string | null {
  if (!Number.isInteger(item.dayOfWeek) || item.dayOfWeek < 1 || item.dayOfWeek > 5) {
    return "Day must be Monday to Friday.";
  }
  if (!isValidTime(item.startTime)) return "Start time must look like 08:30.";
  if (item.endTime) {
    if (!isValidTime(item.endTime)) return "End time must look like 09:15.";
    if (item.endTime <= item.startTime) return "End time must be after the start time.";
  }
  if (!item.activity.trim()) return "Every row needs an activity.";
  if (item.activity.length > 120) return "Activity is too long (120 characters max).";
  if (item.notes && item.notes.length > 500) return "Notes are too long (500 characters max).";
  return null;
}
