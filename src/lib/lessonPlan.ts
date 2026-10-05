import { z } from "zod";

// Lesson plan and classwork (Dylan, 5 Oct 2026). Pure helpers, no db.

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function utc(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** ISO weekday of a "YYYY-MM-DD" date, 1 = Monday ... 7 = Sunday. */
export function weekdayOf(date: string): number {
  const js = utc(date).getUTCDay();
  return js === 0 ? 7 : js;
}

/** The Monday of the week containing `date` (weekends belong to the week before). */
export function mondayOf(date: string): string {
  const d = utc(date);
  d.setUTCDate(d.getUTCDate() - (weekdayOf(date) - 1));
  return fmt(d);
}

export function addDays(date: string, days: number): string {
  const d = utc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fmt(d);
}

/** Monday to Friday of the week starting on `monday`. */
export function weekDays(monday: string): string[] {
  return [0, 1, 2, 3, 4].map((n) => addDays(monday, n));
}

export const lessonPlanDaySchema = z.object({
  date: z.string().regex(DATE_RE),
  topic: z.string().trim().max(200, "Keep the topic under 200 characters."),
  notes: z.string().trim().max(5_000, "Keep the notes under 5,000 characters.").optional().or(z.literal("")),
});

export const lessonPlanPutSchema = z.object({
  categoryId: z.string().min(1),
  weekStart: z.string().regex(DATE_RE),
  days: z.array(lessonPlanDaySchema).max(5),
});

export const classworkSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, "Describe what you did with the children.")
    .max(5_000, "Keep it under 5,000 characters."),
});

/** How far back the Classwork history looks. */
export const CLASSWORK_HISTORY_DAYS = 30;

/** From this hour (school time) a teacher is reminded to record classwork. */
export const CLASSWORK_REMINDER_HOUR = 15;
