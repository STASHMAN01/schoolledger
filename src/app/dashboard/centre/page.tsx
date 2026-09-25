"use client";

// Centre Management home. Layout follows Dylan's mock-up (23 Sept):
// number tiles on the left (each number is also a link), recent CENTRE
// activity underneath, and the to-do list as a tall panel on the right.
// Each tile's data is fetched on its own so one failing request never
// blanks the whole page -- a tile that can't load says so.
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useOrg } from "../OrgContext";
import { TodoList } from "../TodoList";
import { useTour } from "../TourContext";
import { Tile, TileHeader } from "../DashboardTile";
import { Badge, Card, PageHeader } from "@/components/ui";
import { CENTRE_ENTITY_TYPES } from "@/lib/activityArea";
import { describeAuditAction } from "@/lib/auditLabel";
import { isoWeekday } from "@/lib/schedule";
import { todayLocal } from "@/lib/date";

type ChildStat = { enrollmentDate: string; exitDate: string | null; archived: boolean };
type AttendanceSummary = {
  scope: "none" | "single" | "all";
  className: string | null;
  total: number;
  present: number;
  absent: number;
  notTaken: number;
};
type UpcomingEvent = { id: string; name: string; eventDate: string };
type TodayItem = { id: string; dayOfWeek: number; startTime: string; endTime: string | null; activity: string };
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
  ParentSubmission: "Online form",
  ParentFormLink: "Online form",
};

function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-ZA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Fetches JSON, returning null (never throwing) on any failure. */
async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json().catch(() => ({}))) as T;
  } catch {
    return null;
  }
}

export default function CentreManagementHomePage() {
  const { organizationId, permissions, role, centreTourSeenAt } = useOrg();
  const { start } = useTour();
  const searchParams = useSearchParams();
  const router = useRouter();
  const tourTriggered = useRef(false);
  const isTeacher = role === "TEACHER";
  const canSeeAttendance = permissions.includes("MANAGE_ATTENDANCE");
  const canSeeSubmissions = permissions.includes("MANAGE_CHILDREN");
  const canSeeStaff = permissions.includes("MANAGE_CLASSES") || permissions.includes("MANAGE_TEAM");
  const canSeeActivity = permissions.includes("VIEW_ACTIVITY_LOG");

  const [loading, setLoading] = useState(true);
  const [children, setChildren] = useState<ChildStat[] | null>(null);
  const [attendance, setAttendance] = useState<AttendanceSummary | null>(null);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [staffCount, setStaffCount] = useState<number | null>(null);
  const [unassignedTeachers, setUnassignedTeachers] = useState(0);
  const [upcoming, setUpcoming] = useState<{ total: number; events: UpcomingEvent[] } | null>(null);
  const [classCount, setClassCount] = useState<number | null>(null);
  const [todayItems, setTodayItems] = useState<TodayItem[] | null>(null);
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const base = `/api/organizations/${organizationId}`;
    const activityQs = new URLSearchParams({ entityTypes: CENTRE_ENTITY_TYPES.join(",") }).toString();
    const [kids, att, subs, staff, events, classes, sched, activity] = await Promise.all([
      getJson<{ children: ChildStat[] }>(`${base}/children`),
      canSeeAttendance ? getJson<AttendanceSummary>(`${base}/attendance/summary?date=${todayLocal()}`) : null,
      canSeeSubmissions ? getJson<{ submissions: unknown[] }>(`${base}/parent-submissions`) : null,
      canSeeStaff
        ? getJson<{ staff: { role: string; assignedClass: unknown }[] }>(`${base}/staff`)
        : null,
      getJson<{ total: number; events: UpcomingEvent[] }>(`${base}/events/upcoming?from=${todayLocal()}`),
      getJson<{ categories: { archived: boolean }[] }>(`${base}/categories`),
      isTeacher ? getJson<{ items: TodayItem[] }>(`${base}/schedule`) : null,
      canSeeActivity ? getJson<{ entries: AuditEntry[] }>(`${base}/audit?${activityQs}`) : null,
    ]);
    setChildren(kids?.children ?? null);
    setAttendance(att);
    setPendingCount(subs ? subs.submissions.length : null);
    if (staff) {
      setStaffCount(staff.staff.length);
      setUnassignedTeachers(staff.staff.filter((m) => m.role === "TEACHER" && !m.assignedClass).length);
    }
    setUpcoming(events);
    setClassCount(classes ? classes.categories.filter((c) => !c.archived).length : null);
    if (sched) {
      const today = isoWeekday(new Date());
      setTodayItems(sched.items.filter((i) => i.dayOfWeek === today));
    }
    setEntries(activity ? activity.entries.slice(0, 10) : null);
    setLoading(false);
  }, [organizationId, canSeeAttendance, canSeeSubmissions, canSeeStaff, isTeacher, canSeeActivity]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    load();
  }, [load]);

  // First-time guided walkthrough: auto-opens once (centreTourSeenAt is
  // null until it's finished/skipped), or on demand via the header's
  // "Take a tour" link (?tour=1).
  useEffect(() => {
    if (tourTriggered.current) return;
    const forced = searchParams.get("tour") === "1";
    if (!forced && centreTourSeenAt) return;
    tourTriggered.current = true;
    start("centre");
    if (forced) router.replace("/dashboard/centre");
  }, [centreTourSeenAt, searchParams, start, router]);

  const active = (children ?? []).filter((c) => !c.archived);
  const enrolledCount = active.filter((c) => !c.exitDate).length;
  const newThisWeekCount = active.filter((c) => new Date(c.enrollmentDate) >= daysAgo(7)).length;
  const num = (v: number | null) => (loading ? "…" : v === null ? "—" : v);

  return (
    <div className="animate-in">
      <PageHeader title="Centre Management" description="Enrolment, attendance and the day-to-day running of your centre." />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        {/* Left: tiles, then activity */}
        <div className="min-w-0">
          <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            <Tile
              title="Admissions"
              href="/dashboard/centre/admissions"
              value={num(children ? newThisWeekCount : null)}
              hint="New this week"
              tourId="tile-admissions"
            />

            {canSeeAttendance && (
              <div data-tour="tile-attendance" className="overflow-hidden rounded-xl border border-border bg-surface">
                <TileHeader title={`Attendance${attendance?.className ? ` · ${attendance.className}` : ""}`} />
                {loading ? (
                  <p className="font-display p-3 text-2xl font-semibold text-foreground">…</p>
                ) : !attendance ? (
                  <p className="p-3 text-xs text-danger">Couldn&apos;t load attendance.</p>
                ) : attendance.total === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">No children yet</p>
                ) : attendance.notTaken === attendance.total ? (
                  <Link href="/dashboard/centre/attendance" className="block p-3 text-sm font-medium text-brand hover:underline">
                    Not taken yet — take register →
                  </Link>
                ) : (
                  <div className="grid grid-cols-2 divide-x divide-border text-center">
                    <Link href="/dashboard/centre/attendance" className="block p-3 hover:bg-background">
                      <span className="block text-xs text-muted-foreground">Present</span>
                      <span className="font-display text-2xl font-semibold text-success">{attendance.present}</span>
                    </Link>
                    <Link href="/dashboard/centre/attendance/absent" className="block p-3 hover:bg-background">
                      <span className="block text-xs text-muted-foreground">Absent</span>
                      <span className="font-display text-2xl font-semibold text-danger">{attendance.absent}</span>
                    </Link>
                  </div>
                )}
              </div>
            )}

            {canSeeSubmissions && (
              <Tile
                title="Online submissions"
                href="/dashboard/centre/admissions#submissions"
                value={num(pendingCount)}
                hint="Waiting for your review"
                tourId="tile-online-submissions"
              />
            )}
            <Tile
              title="Enrolled"
              href="/dashboard/centre/enrolled"
              value={num(children ? enrolledCount : null)}
              hint="By class, gender and age"
              tourId="tile-enrolled"
            />
            {canSeeStaff && (
              <Tile
                title="Staff"
                href="/dashboard/centre/staff"
                value={num(staffCount)}
                hint={
                  unassignedTeachers > 0
                    ? `${unassignedTeachers} teacher${unassignedTeachers === 1 ? "" : "s"} without a class`
                    : "Team, roles and classes"
                }
                warn={unassignedTeachers > 0}
                tourId="tile-staff"
              />
            )}
            <Tile
              title="Upcoming events"
              href="/dashboard/centre/events"
              value={num(upcoming ? upcoming.total : null)}
              hint={
                upcoming?.events[0]
                  ? `Next: ${upcoming.events[0].name} · ${new Date(upcoming.events[0].eventDate).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}`
                  : "Nothing coming up"
              }
              tourId="tile-upcoming-events"
            />
            <Tile
              title="Classes"
              href="/dashboard/centre/classes"
              value={num(classCount)}
              hint="Teachers and age groups"
              tourId="tile-classes"
            />
          </div>

          {isTeacher && todayItems !== null && (
            <Card as="div" className="mb-8 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-sm font-semibold text-foreground">Today&apos;s timetable</h2>
                <Link href="/dashboard/centre/schedule" className="text-xs font-medium text-brand hover:underline">
                  Full week →
                </Link>
              </div>
              {todayItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing scheduled for today.</p>
              ) : (
                <div className="divide-y divide-border">
                  {todayItems.map((i) => (
                    <div key={i.id} className="flex gap-4 py-2 text-sm">
                      <span className="w-28 shrink-0 tabular-nums text-muted-foreground">
                        {i.startTime}
                        {i.endTime ? `–${i.endTime}` : ""}
                      </span>
                      <span className="text-foreground">{i.activity}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {canSeeActivity && (
            <Card as="div" data-tour="recent-activity" className="p-4">
              <h2 className="font-display mb-3 text-sm font-semibold text-foreground">Recent centre activity</h2>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : entries === null ? (
                <p className="text-sm text-danger">Couldn&apos;t load recent activity.</p>
              ) : entries.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nothing yet — adding children, taking attendance and similar will show up here.
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {entries.map((entry) => (
                    <div key={entry.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                      <Badge variant="brand">{ENTITY_LABEL[entry.entityType] ?? entry.entityType}</Badge>
                      <p className="min-w-0 flex-1 text-sm text-foreground">
                        <span className="font-medium">{entry.actor ? entry.actor.name : "System"}</span>{" "}
                        {describeAuditAction(entry)}
                      </p>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatWhen(entry.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Right: to-do panel (stacks under the tiles on phones) */}
        <aside className="order-first lg:order-none">
          <div className="lg:sticky lg:top-4 lg:min-h-[28rem]">
            <TodoList mode="centre" variant="panel" tourId="todo-panel" />
          </div>
        </aside>
      </div>
    </div>
  );
}
