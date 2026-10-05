import { z } from "zod";
import { DATE_RE } from "@/lib/lessonPlan";

// Tasks an admin assigns to a class (Dylan, 5 Oct 2026). Pure helpers.

export const taskCreateSchema = z.object({
  categoryId: z.string().min(1, "Choose a class."),
  title: z.string().trim().min(1, "Say what the task is.").max(200, "Keep the title under 200 characters."),
  details: z.string().trim().max(5_000, "Keep the details under 5,000 characters.").optional().or(z.literal("")),
  dueDate: z.string().regex(DATE_RE).optional().or(z.literal("")),
});

/** How long a finished task stays in a teacher's list. */
export const DONE_VISIBLE_DAYS = 7;

export type TaskState = "new" | "open" | "done";

/** new = nobody has opened it yet; open = acknowledged, not finished; done. */
export function taskState(t: { acknowledgedAt: Date | string | null; completedAt: Date | string | null }): TaskState {
  if (t.completedAt) return "done";
  return t.acknowledgedAt ? "open" : "new";
}

/** Overdue only when still unfinished and the due day (school date) has passed. */
export function isOverdue(t: { dueDate: string | null; completedAt: Date | string | null }, today: string): boolean {
  return !t.completedAt && !!t.dueDate && t.dueDate < today;
}
