"use client";

import { useCallback, useEffect, useState } from "react";
import { useOrg } from "../../OrgContext";
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { useConfirmDialog } from "@/components/useConfirmDialog";
import { ALL_CLASSES, isOverdue, taskState } from "@/lib/teacherTasks";

// Assigned tasks (Dylan, 5 Oct 2026): the admin hands work to a class; the
// class teacher sees a pop-up, then ticks it off here.

type Task = {
  id: string;
  title: string;
  details: string | null;
  dueDate: string | null;
  createdAt: string;
  acknowledgedAt: string | null;
  completedAt: string | null;
  category: { id: string; name: string };
  createdBy: { name: string };
};
type Category = { id: string; name: string; archived: boolean };

export default function TasksPage() {
  const { organizationId, role, permissions } = useOrg();
  const isTeacher = role === "TEACHER";
  const canAssign = !isTeacher && permissions.includes("MANAGE_CLASSES");
  const { confirm, dialog } = useConfirmDialog();
  const base = `/api/organizations/${organizationId}`;

  const [categories, setCategories] = useState<Category[]>([]);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [today, setToday] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`${base}/tasks`);
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setTasks(data.tasks);
      setToday(data.today);
    } else {
      setTasks([]);
      setError(data.error ?? "Could not load tasks.");
    }
  }, [base]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load
    load();
  }, [load]);

  useEffect(() => {
    if (!canAssign) return;
    (async () => {
      const res = await fetch(`${base}/categories`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const active = (data.categories as Category[]).filter((c) => !c.archived);
        setCategories(active);
        setCategoryId((prev) => prev || active[0]?.id || "");
      }
    })();
  }, [base, canAssign]);

  async function assign() {
    setSaving(true);
    setError("");
    setNotice("");
    const res = await fetch(`${base}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId, title, details, dueDate }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Could not assign the task.");
      return;
    }
    setTitle("");
    setDetails("");
    setDueDate("");
    const count = Array.isArray(data.tasks) ? data.tasks.length : 1;
    setNotice(count > 1 ? `Sent to all ${count} classes.` : "Task assigned.");
    load();
  }

  async function markDone(id: string) {
    const res = await fetch(`${base}/tasks/${id}/complete`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not mark it done.");
      return;
    }
    load();
  }

  async function takeBack(id: string) {
    const ok = await confirm({
      title: "Take this task back?",
      description: "It disappears from the class's list. This is recorded in the activity log.",
      confirmLabel: "Take back",
      variant: "danger",
    });
    if (!ok) return;
    const res = await fetch(`${base}/tasks/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not take it back.");
      return;
    }
    load();
  }

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
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
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

      {tasks === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : tasks.length === 0 ? (
        <EmptyState
          title="No tasks"
          description={isTeacher ? "Nothing has been assigned to your class." : "Tasks you assign will show here."}
        />
      ) : (
        <Card as="div" className="divide-y divide-border">
          {tasks.map((t) => {
            const state = taskState(t);
            return (
              <div key={t.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className={`font-medium ${state === "done" ? "text-muted-foreground line-through" : "text-foreground"}`}>
                    {t.title}
                    {!isTeacher && <span className="ml-2 text-xs font-normal text-muted-foreground">{t.category.name}</span>}
                  </p>
                  {t.details && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{t.details}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">
                    Assigned by {t.createdBy.name}
                    {t.dueDate ? ` · due ${t.dueDate}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  {state === "done" ? (
                    <Badge variant="success">Done</Badge>
                  ) : isOverdue({ dueDate: t.dueDate, completedAt: t.completedAt }, today) ? (
                    <Badge variant="danger">Overdue</Badge>
                  ) : state === "new" ? (
                    <Badge variant="neutral">Not opened yet</Badge>
                  ) : (
                    <Badge variant="neutral">Opened</Badge>
                  )}
                  <div className="flex gap-3">
                    {isTeacher && state !== "done" && (
                      <Button size="sm" onClick={() => markDone(t.id)}>
                        Mark done
                      </Button>
                    )}
                    {canAssign && (
                      <button
                        type="button"
                        onClick={() => takeBack(t.id)}
                        className="text-sm text-danger underline underline-offset-2"
                      >
                        Take back
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
