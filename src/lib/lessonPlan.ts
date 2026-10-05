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

/** Saturday or Sunday: no school, no register. */
export function isWeekendDate(date: string): boolean {
  return weekdayOf(date) > 5;
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
  // Admin only (ignored when a teacher submits).
  guide: z.string().trim().max(5_000, "Keep the teaching guide under 5,000 characters.").optional().or(z.literal("")),
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

export const PLAN_STATUSES = ["APPROVED", "PENDING", "RETURNED"] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

/** A teacher proposes topics for days that have no approved plan yet. */
export const lessonPlanSubmitSchema = z.object({
  weekStart: z.string().regex(DATE_RE),
  days: z.array(lessonPlanDaySchema).max(5),
});

export const lessonPlanReviewSchema = z
  .object({
    categoryId: z.string().min(1),
    action: z.enum(["approve", "return"]),
    note: z.string().trim().max(1_000).optional().or(z.literal("")),
  })
  .refine((v) => v.action === "approve" || (v.note?.trim().length ?? 0) >= 3, {
    message: "Tell the teacher what to change.",
    path: ["note"],
  });

// Themes (Dylan, 5 Oct 2026): one topic for a stretch of days, e.g. "Numbers
// and shapes" for the week of 5 Oct, for every class or chosen ones.
export const MAX_THEME_DAYS = 62;

export const lessonThemeSchema = z
  .object({
    title: z.string().trim().min(2, "Give the theme a name.").max(120, "Keep the theme name under 120 characters."),
    description: z.string().trim().max(2_000).optional().or(z.literal("")),
    startDate: z.string().regex(DATE_RE, "Choose the first day."),
    endDate: z.string().regex(DATE_RE, "Choose the last day."),
    categoryIds: z.array(z.string().min(1)).max(100).default([]),
  })
  .superRefine((v, ctx) => {
    if (v.endDate < v.startDate) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "The last day can't be before the first day." });
    } else if (daysApart(v.startDate, v.endDate) + 1 > MAX_THEME_DAYS) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: `A theme can run for up to ${MAX_THEME_DAYS} days.` });
    }
  });

export function daysApart(a: string, b: string): number {
  return Math.round((utc(b).getTime() - utc(a).getTime()) / 86_400_000);
}

/** Does a theme for these classes ([] = all) apply to this class? */
export function themeAppliesTo(categoryIds: string[], categoryId: string): boolean {
  return categoryIds.length === 0 || categoryIds.includes(categoryId);
}
