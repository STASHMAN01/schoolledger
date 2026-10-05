"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOrg } from "../OrgContext";
import { Button, Card } from "@/components/ui";

const CHECK_EVERY_MS = 2 * 60 * 1000;

type Task = { id: string; title: string; details: string | null; dueDate: string | null; acknowledgedAt: string | null; completedAt: string | null };

/**
 * "Admin has assigned you to ..." (Dylan, 5 Oct 2026). Pops up on a class
 * tablet for the oldest task nobody has opened yet. "Got it" marks it
 * opened for the whole class; it stays on the Tasks page until done.
 */
export function TaskPopup() {
  const { organizationId, role } = useOrg();
  const pathname = usePathname();
  const isTeacher = role === "TEACHER";
  const [task, setTask] = useState<Task | null>(null);
  const [busy, setBusy] = useState(false);

  const check = useCallback(async () => {
    try {
      const res = await fetch(`/api/organizations/${organizationId}/tasks`);
      if (!res.ok) return;
      const data = await res.json();
      const fresh = (data.tasks as Task[])
        .filter((t) => !t.acknowledgedAt && !t.completedAt)
        .sort((a, b) => a.id.localeCompare(b.id));
      setTask(fresh[0] ?? null);
    } catch {
      // Offline: try again on the next tick.
    }
  }, [organizationId]);

  useEffect(() => {
    if (!isTeacher) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first check on mount, then on a timer
    check();
    const id = setInterval(check, CHECK_EVERY_MS);
    return () => clearInterval(id);
  }, [isTeacher, check, pathname]);

  async function gotIt() {
    if (!task) return;
    setBusy(true);
    await fetch(`/api/organizations/${organizationId}/tasks/${task.id}/acknowledge`, { method: "POST" }).catch(() => {});
    setBusy(false);
    setTask(null);
    check();
  }

  if (!isTeacher || !task) return null;

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <Card className="animate-in max-h-[85dvh] w-full max-w-sm overflow-y-auto p-5 sm:p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-brand">New task from the office</p>
        <h2 className="font-display mt-1 text-lg font-semibold text-foreground">
          Admin has assigned you to: {task.title}
        </h2>
        {task.details && <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{task.details}</p>}
        {task.dueDate && <p className="mt-2 text-sm text-muted-foreground">Due {task.dueDate}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Link href="/dashboard/centre/tasks" onClick={gotIt} className="self-center text-sm text-brand underline underline-offset-2">
            Open tasks
          </Link>
          <Button onClick={gotIt} disabled={busy}>
            Got it
          </Button>
        </div>
      </Card>
    </div>
  );
}
