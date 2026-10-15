"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useOrg } from "../../OrgContext";
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { useConfirmDialog } from "@/components/useConfirmDialog";
import { todayLocal } from "@/lib/date";
import {
  ALL_CLASSES,
  CLASS_STATUS_LABEL,
  batchProgress,
  classStatus,
  dayLabel,
  groupTaskItems,
  TASK_LIST_CAP,
  normaliseTaskDate,
  shiftTaskDate,
  taskState,
  type ClassStatus,
  type TaskBatch,
} from "@/lib/teacherTasks";

// Assigned tasks (Dylan, 5 Oct 2026): the admin hands work to a class; the
// class teacher sees a pop-up, then ticks it off here.
//
// By day (Dylan, 15 Oct 2026): the page opens on today's tasks. A task's day
// is its due date. The office can filter by class and flip between days; an
// "All classes" assignment shows as one row with each class's progress.

type Task = {
  id: string;
  title: string;
  details: string | null;
  dueDate: string | null;
  createdAt: string;
  acknowledgedAt: string | null;
  completedAt: string | null;
  batchId: string | null;
  category: { id: string; name: string };
  createdBy: { name: string };
};
type Category = { id: string; name: string; archived: boolean };
type DayData = {
  key: string;
  today: string;
  date: string;
  todo: Task[];
  overdue: Task[];
  noDate: Task[];
  done: Task[];
  batchSiblings: Task[];
  /** A list hit the server's cap, so some tasks are not shown. */
  truncated: boolean;
  /** The school's timezone, to place a completion time on a school date. */
  timeZone: string;
};

const STATUS_BADGE: Record<ClassStatus, "success" | "danger" | "neutral"> = {
  done: "success",
  overdue: "danger",
  open: "neutral",
  new: "neutral",
};

export default function TasksPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <TasksView />
    </Suspense>
  );
}

function TasksView() {
  const { organizationId, role, permissions } = useOrg();
  const isTeacher = role === "TEACHER";
  const canAssign = !isTeacher && permissions.includes("MANAGE_CLASSES");
  const { confirm, dialog } = useConfirmDialog();
  const base = `/api/organizations/${organizationId}`;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // The view lives in the URL (?date=&class=) so a refresh or the back
  // button keeps it. No ?date= means today.
  const dateParam = normaliseTaskDate(searchParams.get("date"), "");
  const classFilter = isTeacher ? "" : (searchParams.get("class") ?? "");
  const viewKey = `${dateParam}|${classFilter}`;

  const [categories, setCategories] = useState<Category[]>([]);
  const [data, setData] = useState<DayData | null>(null);
  const [tab, setTab] = useState<"todo" | "done">("todo");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [categoryId, setCategoryId] = useState("");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  // null = leave it on today; "" = the admin cleared it on purpose.
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // The school's date comes from the server. If a load fails, keep the last
  // one we saw (or this device's date) so the day arrows still work.
  const latestRequest = useRef(0);
  // (Empty until the first load finishes, so the server and browser render the same.)
  const today = data ? data.today || todayLocal() : "";
  const date = dateParam || data?.date || today;
  const loading = !data || data.key !== viewKey;
  const dueValue = dueDate ?? today;

  const load = useCallback(async () => {
    // Only the newest request may update the page: two quick clicks on the
    // day arrows must not let the older answer land last.
    const requestId = ++latestRequest.current;
    const qs = new URLSearchParams();
    if (dateParam) qs.set("date", dateParam);
    if (classFilter) qs.set("categoryId", classFilter);
    const query = qs.toString();
    let ok = false;
    let json: Record<string, unknown> = {};
    try {
      const res = await fetch(`${base}/tasks${query ? `?${query}` : ""}`);
      ok = res.ok;
      json = await res.json().catch(() => ({}));
    } catch {
      // Offline: shown as a failed load below.
    }
    if (requestId !== latestRequest.current) return;
    if (ok) {
      const fresh = json as unknown as Omit<DayData, "key">;
      setData({ ...fresh, key: viewKey });
    } else {
      setData((prev) => {
        const known = prev?.today || todayLocal();
        return {
          key: viewKey,
          today: known,
          date: dateParam || known,
          todo: [],
          overdue: [],
          noDate: [],
          done: [],
          batchSiblings: [],
          truncated: false,
          timeZone: prev?.timeZone ?? "Africa/Johannesburg",
        };
      });
      setError(typeof json.error === "string" ? json.error : "Could not load tasks.");
    }
  }, [base, dateParam, classFilter, viewKey]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load on mount and whenever the day or class changes
    load();
  }, [load]);

  useEffect(() => {
    if (isTeacher) return;
    (async () => {
      const res = await fetch(`${base}/categories`);
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        const active = (json.categories as Category[]).filter((c) => !c.archived);
        setCategories(active);
        setCategoryId((prev) => prev || active[0]?.id || "");
      }
    })();
  }, [base, isTeacher]);

  /** Change the day and/or class by rewriting the query string. */
  function go(next: { date?: string; class?: string }) {
    const qs = new URLSearchParams();
    const nextDate = next.date ?? date;
    const nextClass = next.class ?? classFilter;
    // Today is the default, so it stays out of the URL.
    if (nextDate && nextDate !== today) qs.set("date", nextDate);
    if (nextClass) qs.set("class", nextClass);
    const query = qs.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    setNotice("");
    setError("");
  }

  async function assign() {
    setSaving(true);
    setError("");
    setNotice("");
    const res = await fetch(`${base}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId, title, details, dueDate: dueValue }),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(json.error ?? "Could not assign the task.");
      return;
    }
    setTitle("");
    setDetails("");
    setDueDate(null);
    const count = Array.isArray(json.tasks) ? json.tasks.length : 1;
    const dayNote =
      dueValue && dueValue !== date ? ` It is due ${dayLabel(dueValue, today).toLowerCase()}, so it shows on that day.` : "";
    setNotice((count > 1 ? `Sent to all ${count} classes.` : "Task assigned.") + dayNote);
    load();
  }

  async function markDone(id: string) {
    const res = await fetch(`${base}/tasks/${id}/complete`, { method: "POST" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Could not mark it done.");
      return;
    }
    load();
  }

  async function takeBack(id: string, className?: string) {
    const ok = await confirm({
      title: className ? `Take this task back from ${className}?` : "Take this task back?",
      description: "It disappears from the class's list. This is recorded in the activity log.",
      confirmLabel: "Take back",
      variant: "danger",
    });
    if (!ok) return;
    const res = await fetch(`${base}/tasks/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Could not take it back.");
      return;
    }
    load();
  }

  function toggle(batchId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(batchId)) next.delete(batchId);
      else next.add(batchId);
      return next;
    });
  }

  // The office sees an "All classes" assignment as one row, unless a class
  // is picked. Teachers always see their own class's copies one by one.
  const group = !isTeacher && !classFilter;
  const siblings = data?.batchSiblings ?? [];
  const sections =
    tab === "todo"
      ? [
          { key: "overdue", label: "Overdue", tone: "danger" as const, rows: data?.overdue ?? [] },
          { key: "todo", label: "", tone: "plain" as const, rows: data?.todo ?? [] },
          { key: "noDate", label: "No date", tone: "plain" as const, rows: data?.noDate ?? [] },
        ]
      : [{ key: "done", label: "", tone: "plain" as const, rows: data?.done ?? [] }];
  // A batch is in Done for a day only if its last copy was ticked off that day.
  const doneOn = { date, timeZone: data?.timeZone ?? "Africa/Johannesburg" };
  const built = sections.map((s) => ({ ...s, items: groupTaskItems(s.rows, siblings, tab, group, doneOn) }));
  const countOf = (which: "todo" | "done") => {
    const lists =
      which === "todo"
        ? [data?.overdue ?? [], data?.todo ?? [], data?.noDate ?? []]
        : [data?.done ?? []];
    return lists.reduce((n, rows) => n + groupTaskItems(rows, siblings, which, group, doneOn).length, 0);
  };
  const todoCount = countOf("todo");
  const doneCount = countOf("done");
  const shownCount = tab === "todo" ? todoCount : doneCount;

  const hasData = !!data;

  return (
    <div className="animate-in max-w-3xl">
      {dialog}
      <PageHeader
        title="Tasks"
        description={
          isTeacher
            ? "Work the office has assigned to your class. Tick it off when it's done."
            : "Assign work to a class. Its teacher gets a pop-up on their tablet and a to-do until it's done."
        }
      />

      {canAssign && (
        <Card as="div" className="mb-5 space-y-3 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Class</label>
              <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                {categories.length === 0 && <option value="">No classes yet</option>}
                {categories.length > 1 && <option value={ALL_CLASSES}>All classes ({categories.length})</option>}
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Due (optional)</label>
              <Input type="date" value={dueValue} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <Input
            value={title}
            maxLength={200}
            placeholder="Task, e.g. Tidy the book corner before Friday"
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Task"
          />
          <Textarea
            rows={2}
            maxLength={5000}
            value={details}
            placeholder="Details (optional)"
            onChange={(e) => setDetails(e.target.value)}
            aria-label="Details"
          />
          <Button onClick={assign} disabled={saving || !title.trim() || !categoryId}>
            {saving ? "Assigning…" : categoryId === ALL_CLASSES ? "Send to all classes" : "Assign task"}
          </Button>
        </Card>
      )}

      {error && (
        <p className="mb-4 rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{error}</p>
      )}
      {notice && !error && (
        <p className="mb-4 rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success" role="status">
          {notice}
        </p>
      )}

      {/* Day and class bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            aria-label="Previous day"
            disabled={!hasData}
            onClick={() => go({ date: shiftTaskDate(date, -1) })}
          >
            ‹
          </Button>
          <span className="min-w-24 text-center text-sm font-semibold text-foreground" aria-live="polite">
            {hasData ? dayLabel(date, today) : "…"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Next day"
            disabled={!hasData}
            onClick={() => go({ date: shiftTaskDate(date, 1) })}
          >
            ›
          </Button>
        </div>
        {hasData && date !== today && (
          <Button variant="secondary" size="sm" onClick={() => go({ date: today })}>
            Today
          </Button>
        )}
        <Input
          type="date"
          value={date}
          aria-label="Jump to a date"
          className="w-auto"
          onChange={(e) => {
            const picked = normaliseTaskDate(e.target.value, "");
            if (picked) go({ date: picked });
          }}
        />
        {!isTeacher && (
          <Select
            value={classFilter}
            aria-label="Class"
            className="w-auto"
            onChange={(e) => go({ class: e.target.value })}
          >
            <option value="">All classes</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        )}
      </div>

      <div role="tablist" className="mb-4 flex gap-1 border-b border-border">
        {(
          [
            ["todo", "To do", todoCount],
            ["done", "Done", doneCount],
          ] as const
        ).map(([id, label, n]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`-mb-px min-h-11 border-b-2 px-4 text-sm font-medium ${
              tab === id ? "border-brand text-foreground" : "border-transparent text-muted-foreground"
            }`}
          >
            {label} {loading ? "" : `(${n})`}
          </button>
        ))}
      </div>

      {!loading && data?.truncated && (
        <p className="mb-3 text-xs text-muted-foreground" role="status">
          Showing the first {TASK_LIST_CAP.toLocaleString("en-ZA")} tasks. Pick a class or another day to see the rest.
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : shownCount === 0 ? (
        <EmptyState
          title={tab === "todo" ? "No tasks for this day." : "Nothing finished on this day."}
          description={
            tab === "todo"
              ? isTeacher
                ? "Nothing has been assigned to your class for this day."
                : "Tasks you assign for this day will show here."
              : "Tasks that are ticked off show here."
          }
        />
      ) : (
        <div className="space-y-5">
          {built
            .filter((s) => s.items.length > 0)
            .map((s) => (
              <section key={s.key}>
                {s.label && (
                  <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                    {s.tone === "danger" ? <Badge variant="danger">{s.label}</Badge> : s.label}
                    <span className="font-normal text-muted-foreground">{s.items.length}</span>
                  </h2>
                )}
                <Card as="div" className="divide-y divide-border">
                  {s.items.map((item) =>
                    item.kind === "batch" ? (
                      <BatchRow
                        key={item.batch.batchId}
                        batch={item.batch}
                        today={today}
                        open={expanded.has(item.batch.batchId)}
                        onToggle={() => toggle(item.batch.batchId)}
                        onTakeBack={takeBack}
                        canAssign={canAssign}
                        showDue={s.key === "overdue"}
                      />
                    ) : (
                      <TaskRow
                        key={item.task.id}
                        task={item.task}
                        today={today}
                        isTeacher={isTeacher}
                        canAssign={canAssign}
                        showDue={s.key === "overdue"}
                        onDone={markDone}
                        onTakeBack={takeBack}
                      />
                    )
                  )}
                </Card>
              </section>
            ))}
        </div>
      )}
    </div>
  );
}

function dueText(task: Task, today: string, showDue: boolean) {
  return showDue && task.dueDate ? ` · due ${dayLabel(task.dueDate, today)}` : "";
}

function StatusBadge({ task, today }: { task: Task; today: string }) {
  const status = classStatus(task, today);
  return <Badge variant={STATUS_BADGE[status]}>{CLASS_STATUS_LABEL[status]}</Badge>;
}

function TaskRow({
  task,
  today,
  isTeacher,
  canAssign,
  showDue,
  onDone,
  onTakeBack,
}: {
  task: Task;
  today: string;
  isTeacher: boolean;
  canAssign: boolean;
  showDue: boolean;
  onDone: (id: string) => void;
  onTakeBack: (id: string) => void;
}) {
  const state = taskState(task);
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className={`font-medium ${state === "done" ? "text-muted-foreground line-through" : "text-foreground"}`}>
          {task.title}
          {!isTeacher && <span className="ml-2 text-xs font-normal text-muted-foreground">{task.category.name}</span>}
        </p>
        {task.details && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{task.details}</p>}
        <p className="mt-1 text-xs text-muted-foreground">
          Assigned by {task.createdBy.name}
          {dueText(task, today, showDue)}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <StatusBadge task={task} today={today} />
        <div className="flex gap-3">
          {isTeacher && state !== "done" && (
            <Button size="sm" onClick={() => onDone(task.id)}>
              Mark done
            </Button>
          )}
          {canAssign && (
            <button
              type="button"
              onClick={() => onTakeBack(task.id)}
              className="min-h-10 text-sm text-danger underline underline-offset-2"
            >
              Take back
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function BatchRow({
  batch,
  today,
  open,
  onToggle,
  onTakeBack,
  canAssign,
  showDue,
}: {
  batch: TaskBatch<Task>;
  today: string;
  open: boolean;
  onToggle: () => void;
  onTakeBack: (id: string, className?: string) => void;
  canAssign: boolean;
  showDue: boolean;
}) {
  const first = batch.first;
  const finished = batch.doneCount === batch.total;
  const anyOverdue = batch.tasks.some((t) => classStatus(t, today) === "overdue");
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full flex-wrap items-start justify-between gap-3 p-4 text-left"
      >
        <div className="min-w-0">
          <p className={`font-medium ${finished ? "text-muted-foreground line-through" : "text-foreground"}`}>
            {first.title}
            <span className="ml-2 text-xs font-normal text-muted-foreground">Sent to all classes</span>
          </p>
          {first.details && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{first.details}</p>}
          <p className="mt-1 text-xs text-muted-foreground">
            Assigned by {first.createdBy.name}
            {dueText(first, today, showDue)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge variant={finished ? "success" : anyOverdue ? "danger" : "neutral"}>{batchProgress(batch)}</Badge>
          <span className="text-xs text-muted-foreground">{open ? "Hide classes" : "Show classes"}</span>
        </div>
      </button>
      {open && (
        <ul className="divide-y divide-border border-t border-border bg-background">
          {batch.tasks.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
              <span className="text-sm text-foreground">{t.category.name}</span>
              <span className="flex items-center gap-3">
                <StatusBadge task={t} today={today} />
                {canAssign && (
                  <button
                    type="button"
                    onClick={() => onTakeBack(t.id, t.category.name)}
                    className="min-h-10 text-sm text-danger underline underline-offset-2"
                  >
                    Take back
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

