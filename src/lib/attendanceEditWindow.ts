// How far back a register can still be changed (Dylan, 3 Nov 2026):
// today plus the 2 school days before it, for everyone -- admins and
// teachers alike. Older registers stay viewable (day view, monthly view,
// PDF) but are locked, so the record can't be quietly rewritten weeks
// later. Weekends aren't school days, so on a Monday the window is
// Monday, Friday and Thursday.
//
// Dates are plain "YYYY-MM-DD" strings in the school's own time zone. No
// imports beyond the date helpers, so the page and the API share it.
import { addDays, isWeekendDate } from "@/lib/lessonPlan";

/** School days before today that can still be changed. */
export const REGISTER_EDIT_PAST_SCHOOL_DAYS = 2;

/** Every date whose register can still be changed, newest first. */
export function editableRegisterDates(today: string): string[] {
  const out: string[] = [];
  if (!isWeekendDate(today)) out.push(today);
  let d = today;
  let found = 0;
  while (found < REGISTER_EDIT_PAST_SCHOOL_DAYS) {
    d = addDays(d, -1);
    if (!isWeekendDate(d)) {
      out.push(d);
      found++;
    }
  }
  return out;
}

/** True when `date`'s register may still be saved, given the school's `today`. */
export function canEditRegister(date: string, today: string): boolean {
  return editableRegisterDates(today).includes(date);
}

/** The oldest date that can still be changed, e.g. for "editable from" copy. */
export function earliestEditableRegisterDate(today: string): string {
  const dates = editableRegisterDates(today);
  return dates[dates.length - 1];
}

/** The school day before `date` (skips weekends). */
export function previousSchoolDay(date: string): string {
  let d = addDays(date, -1);
  while (isWeekendDate(d)) d = addDays(d, -1);
  return d;
}

/** The school day after `date` (skips weekends). */
export function nextSchoolDay(date: string): string {
  let d = addDays(date, 1);
  while (isWeekendDate(d)) d = addDays(d, 1);
  return d;
}
