"use client";

// Shared "to-do" widget (Phase 3 Session 2, see docs/PLAN.md's to-do
// engine v1). Every item is computed live on the server and clears itself
// once its condition is resolved -- no manual ticking.
//
// Dylan's revision (23 Sept): each dashboard shows only its own mode's
// to-dos (`mode`), and Centre Management shows them as a tall panel on the
// right with a red total badge (`variant="panel"`), per his mock-up.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useOrg } from "./OrgContext";
import { Badge, Card } from "@/components/ui";
import { todayLocal } from "@/lib/date";

type TodoItem = {
  id: string;
  label: string;
  count: number;
  href: string;
};

export function TodoList({
  mode,
  variant = "card",
  tourId,
}: {
  mode: "centre" | "accounting";
  variant?: "card" | "panel";
  /** Spotlight target for the guided walkthrough -- see src/lib/tourSteps.ts. */
  tourId?: string;
}) {
  const { organizationId } = useOrg();
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/organizations/${organizationId}/todos?mode=${mode}&date=${todayLocal()}`
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) setTodos(data.todos ?? []);
      else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setLoaded(true);
    }
  }, [organizationId, mode]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    load();
  }, [load]);

  const total = todos.reduce((sum, t) => sum + t.count, 0);

  if (variant === "card") {
    if (!loaded || todos.length === 0) return null;
    return (
      <Card as="div" data-tour={tourId} className="mb-8 p-4">
        <h2 className="font-display mb-3 text-sm font-semibold text-foreground">Your to-dos</h2>
        <TodoRows todos={todos} />
      </Card>
    );
  }

  // Panel: always shown, so "nothing to do" is visible too.
  return (
    <Card as="div" data-tour={tourId} className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-3 bg-brand px-4 py-3 text-brand-foreground">
        <h2 className="font-display text-base font-semibold">Your to-do list</h2>
        {total > 0 && (
          <span
            className="min-w-9 rounded-full bg-danger px-2.5 py-0.5 text-center text-sm font-bold text-danger-foreground"
            aria-label={`${total} to-dos`}
          >
            {total}
          </span>
        )}
      </div>
      <div className="flex-1 p-4">
        {!loaded ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : failed ? (
          <p className="text-sm text-danger">Couldn&apos;t load your to-dos. Refresh the page to try again.</p>
        ) : todos.length === 0 ? (
          <p className="text-sm text-muted-foreground">All done — nothing needs your attention right now.</p>
        ) : (
          <TodoRows todos={todos} />
        )}
      </div>
    </Card>
  );
}

function TodoRows({ todos }: { todos: TodoItem[] }) {
  return (
    <div className="divide-y divide-border">
      {todos.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          className="transition-standard flex min-h-11 items-center justify-between gap-3 py-2.5 hover:bg-background"
        >
          <span className="text-sm font-medium text-foreground">{t.label}</span>
          <Badge variant="accent">{t.count}</Badge>
        </Link>
      ))}
    </div>
  );
}
