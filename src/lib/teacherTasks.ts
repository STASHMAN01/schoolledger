import { z } from "zod";
import { DATE_RE, addDays } from "@/lib/lessonPlan";
import { schoolClock } from "@/lib/dailySummary";

// Tasks an admin assigns to a class (Dylan, 5 Oct 2026). Pure helpers.

/**
 * Sent as categoryId to give the same task to every active class at once
 * (Dylan, 9 Oct 2026). Each class still gets its own copy, so every teacher
 * acknowledges and ticks it off separately.
 */
export const ALL_CLASSES = "__all__";

export const taskCreateSchema = z.object({
  categoryId: z.string().min(1, "Choose a class."),
  title: z.string().trim().min(1, "Say what the task is.").max(200, "Keep the title under 200 characters."),
  details: z.string().trim().max(5_000, "Keep the details under 5,000 characters.").optional().or(z.literal("")),
  dueDate: z.string().regex(DATE_RE).optional().or(z.literal("")),
});

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

// ---------------------------------------------------------------------------
// Tasks by day (Dylan, 15 Oct 2026). A task's day is its due date. The list
// opens on today and can be flipped to any day or filtered to one class; an
// "All classes" assignment (one copy per class, sharing a batchId) shows as
// one row for the office. All pure, no db.
// ---------------------------------------------------------------------------

type DateLike = Date | string | null;

/** What the day buckets need to know about a task. dueDate is "YYYY-MM-DD". */
export type BucketableTask = { dueDate: string | null; completedAt: DateLike };

export type TaskBuckets<T> = {
  /** Open, due on the chosen day. */
  todo: T[];
  /** Open and due before today. Only when the chosen day is today. */
  overdue: T[];
  /** Open with no due date. Only when the chosen day is today. */
  noDate: T[];
  /** Finished: due on the chosen day, or undated and finished on it. */
  done: T[];
};

/** A real calendar date in "YYYY-MM-DD" form, or the fallback. */
export function normaliseTaskDate(raw: string | null | undefined, fallback: string): string {
  if (!raw || !DATE_RE.test(raw)) return fallback;
  const d = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== raw ? fallback : raw;
}

/** The school's date (in its timezone) on which a timestamp falls. */
export function schoolDateOf(ts: Date | string, timeZone: string): string {
  return schoolClock(timeZone, typeof ts === "string" ? new Date(ts) : ts).date;
}

/**
 * Sorts tasks into the day's buckets. `date` is the day being looked at,
 * `today` the school's date now; overdue and no-date tasks only show on
 * today. Rows that belong to none of the buckets are dropped.
 */
export function bucketTasks<T extends BucketableTask>(
  rows: T[],
  date: string,
  today: string,
  timeZone: string
): TaskBuckets<T> {
  const out: TaskBuckets<T> = { todo: [], overdue: [], noDate: [], done: [] };
  const isToday = date === today;
  for (const t of rows) {
    if (t.completedAt) {
      if (t.dueDate === date) out.done.push(t);
      else if (!t.dueDate && schoolDateOf(t.completedAt, timeZone) === date) out.done.push(t);
    } else if (t.dueDate === date) {
      out.todo.push(t);
    } else if (isToday && t.dueDate && t.dueDate < today) {
      out.overdue.push(t);
    } else if (isToday && !t.dueDate) {
      out.noDate.push(t);
    }
  }
  return out;
}

/** Previous/next day for the date arrows. */
export function shiftTaskDate(date: string, days: number): string {
  return addDays(date, days);
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Today", "Tomorrow", "Yesterday", otherwise e.g. "Thu 16 Oct". */
export function dayLabel(date: string, today: string): string {
  if (date === today) return "Today";
  if (date === addDays(today, 1)) return "Tomorrow";
  if (date === addDays(today, -1)) return "Yesterday";
  const d = new Date(`${date}T00:00:00.000Z`);
  return `${DAY_NAMES[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]}`;
}

/** A class's status on a task, as the office reads it. Overdue beats opened. */
export type ClassStatus = "new" | "open" | "done" | "overdue";

export function classStatus(
  t: { dueDate: string | null; acknowledgedAt: DateLike; completedAt: DateLike },
  today: string
): ClassStatus {
  if (t.completedAt) return "done";
  if (isOverdue({ dueDate: t.dueDate, completedAt: t.completedAt }, today)) return "overdue";
  return t.acknowledgedAt ? "open" : "new";
}

export const CLASS_STATUS_LABEL: Record<ClassStatus, string> = {
  new: "Not opened yet",
  open: "Opened",
  done: "Done",
  overdue: "Overdue",
};

/** What grouping needs to know about a task. */
export type GroupableTask = {
  id: string;
  batchId: string | null;
  completedAt: DateLike;
  category: { name: string };
};

/** One "All classes" assignment: every copy that still exists. */
export type TaskBatch<T> = {
  batchId: string;
  /** The first copy in the list, for the shared title, details and due date. */
  first: T;
  /** Every copy, in class-name order. */
  tasks: T[];
  doneCount: number;
  total: number;
};

export type TaskItem<T> = { kind: "single"; task: T } | { kind: "batch"; batch: TaskBatch<T> };

export function batchProgress(batch: { doneCount: number; total: number }): string {
  return `${batch.doneCount} of ${batch.total} ${batch.total === 1 ? "class" : "classes"} done`;
}

/**
 * Turns the tab's rows into list items, merging copies that share a batchId
 * into one. `siblings` holds every copy of the batches involved, finished or
 * not, so progress is right even when some copies sit on another day. A
 * batch belongs to "todo" while any copy is open and to "done" once all are
 * finished. With `group` false (a class is selected, or a teacher) every row
 * stays on its own. Order follows each item's first row.
 */
export function groupTaskItems<T extends GroupableTask>(
  rows: T[],
  siblings: T[],
  tab: "todo" | "done",
  group: boolean
): TaskItem<T>[] {
  if (!group) return rows.map((task) => ({ kind: "single", task }));

  const byBatch = new Map<string, Map<string, T>>();
  for (const t of [...siblings, ...rows]) {
    if (!t.batchId) continue;
    const copies = byBatch.get(t.batchId) ?? new Map<string, T>();
    copies.set(t.id, t);
    byBatch.set(t.batchId, copies);
  }

  const items: TaskItem<T>[] = [];
  const seen = new Set<string>();
  for (const task of rows) {
    const copies = task.batchId ? byBatch.get(task.batchId) : undefined;
    // A batch with one copy left (the rest taken back) reads as a plain task.
    if (!task.batchId || !copies || copies.size < 2) {
      items.push({ kind: "single", task });
      continue;
    }
    if (seen.has(task.batchId)) continue;
    seen.add(task.batchId);
    const tasks = [...copies.values()].sort((a, b) => a.category.name.localeCompare(b.category.name));
    const doneCount = tasks.filter((t) => !!t.completedAt).length;
    const allDone = doneCount === tasks.length;
    if (tab === "todo" ? allDone : !allDone) continue;
    items.push({ kind: "batch", batch: { batchId: task.batchId, first: task, tasks, doneCount, total: tasks.length } });
  }
  return items;
}
