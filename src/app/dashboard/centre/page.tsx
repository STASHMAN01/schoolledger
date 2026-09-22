"use client";

// Centre Management home. Grew from an almost-empty Phase 1 page into a
// real dashboard as Phase 2/3 features shipped: Admissions/Enrolled/
// Pending reviews tiles (Phase 2), Attendance tile (Phase 3 Session 1).
// Staff/events tiles are still Phase 5.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useOrg } from "../OrgContext";
import { TodoList } from "../TodoList";
import { Badge, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { CENTRE_ENTITY_TYPES } from "@/lib/activityArea";
import { describeAuditAction } from "@/lib/auditLabel";

type ChildStat = {
  category: { id: string };
  enrollmentDate: string;
  exitDate: string | null;
  archived: boolean;
};

type AttendanceSummary = {
  scope: "none" | "single" | "all";
  className: string | null;
  total: number;
  present: number;
  absent: number;
  notTaken: number;
};

function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

function todayLocal(): string {
  return new Date().toLocaleDateString("en-CA");
}

type AuditEntry = {
  id: string;
  action: string;
  entityType: string;
  metadata: unknown;
  createdAt: string;
  actor: { name: string; email: string } | null;
};

const ENTITY_LABEL: Record<string, string> = {
  Category: "Class",
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function CentreManagementHomePage() {
  const { organizationId, permissions } = useOrg();
  const canSeeAttendance = permissions.includes("MANAGE_ATTENDANCE");
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [children, setChildren] = useState<ChildStat[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [attendance, setAttendance] = useState<AttendanceSummary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      entityTypes: CENTRE_ENTITY_TYPES.join(","),
    });
    const requests = [
      fetch(`/api/organizations/${organizationId}/audit?${params.toString()}`),
      fetch(`/api/organizations/${organizationId}/children`),
      fetch(`/api/organizations/${organizationId}/parent-submissions`),
    ];
    if (canSeeAttendance) {
      requests.push(
        fetch(`/api/organizations/${organizationId}/attendance/summary?date=${todayLocal()}`)
      );
    }
    const [activityRes, childrenRes, reviewsRes, attendanceRes] = await Promise.all(requests);
    const activityData = await activityRes.json();
    if (activityRes.ok) setEntries((activityData.entries ?? []).slice(0, 8));
    const childrenData = await childrenRes.json();
    if (childrenRes.ok) setChildren(childrenData.children);
    const reviewsData = await reviewsRes.json();
    if (reviewsRes.ok) setPendingCount(reviewsData.submissions.length);
    if (attendanceRes) {
      const attendanceData = await attendanceRes.json();
      if (attendanceRes.ok) setAttendance(attendanceData);
    }
    setLoading(false);
  }, [organizationId, canSeeAttendance]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount, standard pattern
    load();
  }, [load]);

  const active = children.filter((c) => !c.archived);
  const enrolledCount = active.filter((c) => !c.exitDate).length;
  const newThisWeekCount = active.filter(
    (c) => new Date(c.enrollmentDate) >= daysAgo(7)
  ).length;

  return (
    <div className="animate-in">
      <PageHeader
        title="Centre Management"
        description="Enrolment, attendance and the rest of centre management. Billing lives under Accounting, top-left."
        actions={<LinkButton href="/dashboard/centre/children" size="sm">Children</LinkButton>}
      />

      <TodoList />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/dashboard/centre/admissions"
          className="transition-standard block rounded-xl border border-border bg-surface p-4 hover:border-border-strong"
        >
          <p className="text-xs text-muted-foreground">New this week</p>
          <p className="font-display mt-1 text-2xl font-semibold text-foreground">
            {loading ? "…" : newThisWeekCount}
          </p>
          <p className="mt-1 text-xs text-muted">Admissions, sortable by day/week/month</p>
        </Link>
        <Link
          href="/dashboard/centre/enrolled"
          className="transition-standard block rounded-xl border border-border bg-surface p-4 hover:border-border-strong"
        >
          <p className="text-xs text-muted-foreground">Enrolled</p>
          <p className="font-display mt-1 text-2xl font-semibold text-foreground">
            {loading ? "…" : enrolledCount}
          </p>
          <p className="mt-1 text-xs text-muted">Gender, age and class breakdown</p>
        </Link>

        {canSeeAttendance && (
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs text-muted-foreground">
              Attendance{attendance?.className ? ` · ${attendance.className}` : ""}
            </p>
            {loading || !attendance ? (
              <p className="font-display mt-1 text-2xl font-semibold text-foreground">…</p>
            ) : attendance.total === 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">No children yet</p>
            ) : attendance.notTaken === attendance.total ? (
              <Link
                href="/dashboard/centre/attendance"
                className="mt-1 block text-sm font-medium text-brand hover:underline"
              >
                Not taken yet — take register →
              </Link>
            ) : (
              <p className="font-display mt-1 text-2xl font-semibold text-foreground">
                {attendance.present}
                <span className="ml-1 text-xs font-normal text-muted-foreground">present</span>
              </p>
            )}
            {attendance && attendance.total > 0 && (
              <Link
                href="/dashboard/centre/attendance/absent"
                className="mt-1 block text-xs font-medium text-danger hover:underline"
              >
                {attendance.absent} absent — notify parents
              </Link>
            )}
          </div>
        )}

        <Link
          href="/dashboard/centre/pending-reviews"
          className="transition-standard block rounded-xl border border-border bg-surface p-4 hover:border-border-strong"
        >
          <p className="text-xs text-muted-foreground">Pending reviews</p>
          <p className="font-display mt-1 text-2xl font-semibold text-foreground">
            {loading ? "…" : pendingCount}
          </p>
          <p className="mt-1 text-xs text-muted">Parent-submitted enrolment forms awaiting approval</p>
        </Link>
      </div>

      <Card as="div" className="mb-8 p-4">
        <h2 className="font-display mb-3 text-sm font-semibold text-foreground">
          Recent centre activity
        </h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing yet — adding or editing a child or class will show up here.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3 py-2.5">
                <Badge variant="brand">
                  {ENTITY_LABEL[entry.entityType] ?? entry.entityType}
                </Badge>
                <p className="min-w-0 flex-1 truncate text-sm text-foreground">
                  <span className="font-medium">
                    {entry.actor ? entry.actor.name : "System"}
                  </span>{" "}
                  {describeAuditAction(entry)}
                </p>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatWhen(entry.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <EmptyState
        title="More is coming here"
        description="Staff and events move in over the next phases — see docs/PLAN.md."
      />
    </div>
  );
}
