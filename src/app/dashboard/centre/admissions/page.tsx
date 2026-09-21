"use client";

// Admissions -- new children sortable Today/This week/This month/All by
// enrollment date, with Exits folded in underneath (not a separate
// dashboard tile, per docs/PLAN.md decision #1: exits stay inside
// Admissions rather than also surfacing in Accounting). No money on this
// page, same rule as the rest of Centre Management -- Session 2 per
// docs/PLAN.md.
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useOrg } from "../../OrgContext";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";

type ChildRow = {
  id: string;
  firstName: string;
  lastName: string;
  category: { id: string; name: string };
  enrollmentDate: string;
  exitDate: string | null;
  archived: boolean;
};

type Filter = "today" | "week" | "month" | "all";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "all", label: "All" },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

export default function AdmissionsPage() {
  const { organizationId } = useOrg();
  const [children, setChildren] = useState<ChildRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("week");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/organizations/${organizationId}/children`);
    const data = await res.json();
    if (res.ok) setChildren(data.children);
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount, standard pattern
    load();
  }, [load]);

  const active = useMemo(() => children.filter((c) => !c.archived), [children]);

  const admissions = useMemo(
    () =>
      [...active].sort(
        (a, b) => new Date(b.enrollmentDate).getTime() - new Date(a.enrollmentDate).getTime()
      ),
    [active]
  );

  const buckets = useMemo(() => {
    const todayStart = daysAgo(0);
    const weekStart = daysAgo(7);
    const monthStart = daysAgo(30);
    const counts = { today: 0, week: 0, month: 0, all: admissions.length };
    for (const c of admissions) {
      const d = new Date(c.enrollmentDate);
      if (d >= todayStart) counts.today++;
      if (d >= weekStart) counts.week++;
      if (d >= monthStart) counts.month++;
    }
    return counts;
  }, [admissions]);

  const filtered = useMemo(() => {
    if (filter === "all") return admissions;
    const since = filter === "today" ? daysAgo(0) : filter === "week" ? daysAgo(7) : daysAgo(30);
    return admissions.filter((c) => new Date(c.enrollmentDate) >= since);
  }, [admissions, filter]);

  const exits = useMemo(
    () =>
      active
        .filter((c) => c.exitDate)
        .sort((a, b) => new Date(b.exitDate!).getTime() - new Date(a.exitDate!).getTime()),
    [active]
  );

  return (
    <div className="animate-in">
      <PageHeader
        title="Admissions"
        description="New children by when they were enrolled. Exits are below."
      />

      <Card as="div" className="mb-8 p-4">
        <div className="mb-4 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`transition-standard rounded-full border px-3 py-1.5 text-sm font-medium ${
                filter === f.key
                  ? "border-brand bg-brand-soft text-brand-soft-foreground"
                  : "border-border text-muted-foreground hover:border-border-strong"
              }`}
            >
              {f.label}
              <span className="ml-1.5 text-xs opacity-70">{buckets[f.key]}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No admissions in this range.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((c) => (
              <Link
                key={c.id}
                href={`/dashboard/centre/children/${c.id}`}
                className="transition-standard flex items-center justify-between gap-3 py-2.5 hover:bg-background"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {c.firstName} {c.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">{c.category.name}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDate(c.enrollmentDate)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </Card>

      <Card as="div" className="p-4">
        <h2 className="font-display mb-3 text-sm font-semibold text-foreground">Exits</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : exits.length === 0 ? (
          <EmptyState
            title="No exits recorded"
            description="Children who leave (exit date set on the Accounting-side child record) will show up here."
          />
        ) : (
          <div className="divide-y divide-border">
            {exits.map((c) => (
              <Link
                key={c.id}
                href={`/dashboard/centre/children/${c.id}`}
                className="transition-standard flex items-center justify-between gap-3 py-2.5 hover:bg-background"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {c.firstName} {c.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">{c.category.name}</p>
                </div>
                <Badge variant="neutral">Exited {formatDate(c.exitDate!)}</Badge>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
