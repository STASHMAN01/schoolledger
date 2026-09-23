"use client";

// Shared "to-do" widget (Phase 3 Session 2, see docs/PLAN.md's to-do
// engine v1) rendered at the top of both dashboard home pages
// (Centre Management and Accounting) -- the list itself is mode-agnostic
// ("every user gets a role-based to-do list"), it just draws items from
// whichever side is relevant to that person's permissions. Renders
// nothing at all once every item has cleared, rather than an empty-state
// card -- an empty to-do list isn't something worth taking up space to
// announce.
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


export function TodoList() {
  const { organizationId } = useOrg();
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(
      `/api/organizations/${organizationId}/todos?date=${todayLocal()}`
    );
    const data = await res.json();
    if (res.ok) setTodos(data.todos);
    setLoaded(true);
  }, [organizationId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    load();
  }, [load]);

  if (!loaded || todos.length === 0) return null;

  return (
    <Card as="div" className="mb-8 p-4">
      <h2 className="font-display mb-3 text-sm font-semibold text-foreground">
        Your to-dos
      </h2>
      <div className="divide-y divide-border">
        {todos.map((t) => (
          <Link
            key={t.id}
            href={t.href}
            className="transition-standard flex items-center justify-between gap-3 py-2.5 hover:bg-background"
          >
            <span className="text-sm font-medium text-foreground">{t.label}</span>
            <Badge variant="accent">{t.count}</Badge>
          </Link>
        ))}
      </div>
    </Card>
  );
}
