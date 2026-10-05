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
import { schoolClock } from "@/lib/dailySummary";
import { aroundNow, markProgress } from "@/lib/routineAlerts";
import { todayLocal } from "@/lib/date";

type ChildStat = { enrollmentDate: string; exitDate: string | null; archived: boolean };
type AttendanceSummary = {
  scope: "none" | "single" | "all";
  className: string | null;
  total: number;
  present: number;
  absent: number;
  notTaken: number;
  weekend?: boolean;
};
type UpcomingEvent = { id: string; name: string; eventDate: string };
type TodayItem = { id: string; dayOfWeek: number; startTime: string; endTime: string | null; activity: string };
type TodayLesson = {
  date: string;
  topic: string;
  notes: string;
  guide?: string;
  status?: string;
  theme?: { id: string; title: string } | null;
};
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
  const canSeeMedicine = permissions.includes("MANAGE_REPORTS");

  const [loading, setLoading] = useState(true);
  const [children, setChildren] = useState<ChildStat[] | null>(null);
  const [attendance, setAttendance] = useState<AttendanceSummary | null>(null);
  const [medicine, setMedicine] = useState<{ summary: { children: number; unsigned: number } } | null>(null);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [staffCount, setStaffCount] = useState<number | null>(null);
  const [unassignedTeachers, setUnassignedTeachers] = useState(0);
  const [upcoming, setUpcoming] = useState<{ total: number; events: UpcomingEvent[] } | null>(null);
  const [classCount, setClassCount] = useState<number | null>(null);
  const [routine, setRoutine] = useState<{ items: TodayItem[]; timezone: string } | null>(null);
  const [lesson, setLesson] = useState<{ today: string; days: TodayLesson[] } | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [missingDocs, setMissingDocs] = useState<{ required: string[]; children: unknown[] } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const base = `/api/organizations/${organizationId}`;
    const activityQs = new URLSearchParams({ entityTypes: CENTRE_ENTITY_TYPES.join(",") }).toString();
    const [kids, att, subs, staff, events, classes, sched, activity, docs, plan, med] = await Promise.all([
      getJson<{ children: ChildStat[] }>(`${base}/children`),
      canSeeAttendance ? getJson<AttendanceSummary>(`${base}/attendance/summary?date=${todayLocal()}`) : null,
      canSeeSubmissions ? getJson<{ submissions: unknown[] }>(`${base}/parent-submissions`) : null,
      canSeeStaff
        ? getJson<{ staff: { role: string; assignedClass: unknown }[] }>(`${base}/staff`)
        : null,
      getJson<{ total: number; events: UpcomingEvent[] }>(`${base}/events/upcoming?from=${todayLocal()}`),
      isTeacher ? null : getJson<{ categories: { archived: boolean }[] }>(`${base}/categories`),
      isTeacher ? getJson<{ items: TodayItem[]; timezone?: string }>(`${base}/schedule`) : null,
      canSeeActivity ? getJson<{ entries: AuditEntry[] }>(`${base}/audit?${activityQs}`) : null,
      isTeacher ? null : getJson<{ required: string[]; children: unknown[] }>(`${base}/documents/missing`),
      isTeacher ? getJson<{ today: string; days: TodayLesson[] }>(`${base}/lesson-plans`) : null,
      canSeeMedicine ? getJson<{ summary: { children: number; unsigned: number } }>(`${base}/medicine`) : null,
    ]);
    setMedicine(med);
    setMissingDocs(docs);
    setChildren(kids?.children ?? null);
    setAttendance(att);
    setPendingCount(subs ? subs.submissions.length : null);
    if (staff) {
      setStaffCount(staff.staff.length);
      setUnassignedTeachers(staff.staff.filter((m) => m.role === "TEACHER" && !m.assignedClass).length);
    }
    setUpcoming(events);
    setClassCount(classes ? classes.categories.filter((c) => !c.archived).length : null);
    if (sched) setRoutine({ items: sched.items, timezone: sched.timezone ?? "Africa/Johannesburg" });
    setLesson(plan);
    setEntries(activity ? activity.entries.slice(0, 10) : null);
    setLoading(false);
  }, [organizationId, canSeeAttendance, canSeeSubmissions, canSeeStaff, isTeacher, canSeeActivity, canSeeMedicine]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    load();
  }, [load]);

  // Keep "now" fresh so the routine card moves on through the day.
  useEffect(() => {
    if (!isTeacher) return;
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, [isTeacher]);

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
      <PageHeader
        title="Centre Management"
        description="Enrolment, attendance and the day-to-day running of your centre."
        actions={
          isTeacher ? (
            <>
              <Link
                href="/dashboard/centre/reports?new=INCIDENT"
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-danger px-4 text-sm font-semibold text-white shadow-sm hover:opacity-90 sm:flex-none"
              >
                Report an incident
              </Link>
              <Link
                href="/dashboard/centre/medicine?new=1"
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-brand px-4 text-sm font-semibold text-brand-foreground shadow-sm hover:bg-brand-hover sm:flex-none"
              >
                Medicine brought in
              </Link>
            </>
          ) : undefined
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        {/* Left: tiles, then activity */}
        <div className="min-w-0">
          <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {/* Teachers only get Attendance, Enrolled and Upcoming events
                (Dylan, 4 Oct 2026; src/lib/teacherAccess.ts). */}
            {!isTeacher && (
              <Tile
                title="Admissions"
                href="/dashboard/centre/admissions"
                value={num(children ? newThisWeekCount : null)}
                hint="New this week"
                tourId="tile-admissions"
              />
            )}

            {canSeeAttendance && (
              <div data-tour="tile-attendance" className="overflow-hidden rounded-xl border border-border bg-surface">
                <TileHeader title={`Attendance${attendance?.className ? ` · ${attendance.className}` : ""}`} />
                {loading ? (
                  <p className="font-display p-3 text-2xl font-semibold text-foreground">…</p>
                ) : !attendance ? (
                  <p className="p-3 text-xs text-danger">Couldn&apos;t load attendance.</p>
                ) : attendance.weekend ? (
                  <p className="p-3 text-sm text-muted-foreground">No school on weekends</p>
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
                    {isTeacher ? (
                      // The absent list shows parents' contacts: admin only.
                      <Link href="/dashboard/centre/attendance" className="block p-3 hover:bg-background">
                        <span className="block text-xs text-muted-foreground">Absent</span>
                        <span className="font-display text-2xl font-semibold text-danger">{attendance.absent}</span>
                      </Link>
                    ) : (
                      <Link href="/dashboard/centre/attendance/absent" className="block p-3 hover:bg-background">
                        <span className="block text-xs text-muted-foreground">Absent</span>
                        <span className="font-display text-2xl font-semibold text-danger">{attendance.absent}</span>
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )}

            {canSeeMedicine && (
              <Tile
                title="Medicine today"
                href="/dashboard/centre/medicine"
                value={num(medicine ? medicine.summary.children : null)}
                hint={
                  medicine && medicine.summary.unsigned > 0
                    ? `${medicine.summary.unsigned} not signed by a parent`
                    : medicine && medicine.summary.children === 0
                      ? "No medicine today"
                      : `Child${medicine?.summary.children === 1 ? "" : "ren"} with medicine`
                }
                warn={Boolean(medicine && medicine.summary.unsigned > 0)}
              />
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
            {!isTeacher && (
            <Tile
              title="Missing documents"
              href="/dashboard/centre/documents"
              value={num(missingDocs ? missingDocs.children.length : null)}
              hint={
                missingDocs && missingDocs.children.length > 0
                  ? `Child${missingDocs.children.length === 1 ? "" : "ren"} missing documents`
                  : missingDocs && missingDocs.required.length === 0
                    ? "Choose which documents are required"
                    : "Every child's documents are on file"
              }
              warn={Boolean(missingDocs && missingDocs.children.length > 0)}
              tourId="tile-missing-documents"
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
            {!isTeacher && (
              <Tile
                title="Classes"
                href="/dashboard/centre/classes"
                value={num(classCount)}
                hint="Teachers and age groups"
                tourId="tile-classes"
              />
            )}
          </div>

          {isTeacher && lesson !== null && (
            <Link href="/dashboard/centre/lesson-plan" className="mb-4 block">
              <Card as="div" className="p-4 transition-colors hover:bg-background">
                <p className="text-xs font-medium uppercase tracking-wide text-brand">Today&apos;s lesson</p>
                {(() => {
                  const day = lesson.days.find((d) => d.date === lesson.today);
                  const plan = day && (day.status ?? "APPROVED") === "APPROVED" ? day : undefined;
                  return (
                    <>
                      {day?.theme && <p className="mt-1 text-sm text-muted-foreground">Theme: {day.theme.title}</p>}
                      {plan?.topic ? (
                        <>
                          <p className="font-display mt-1 text-base font-semibold text-foreground">{plan.topic}</p>
                          {plan.guide ? (
                            <p className="mt-1 line-clamp-3 text-sm text-foreground">{plan.guide}</p>
                          ) : (
                            plan.notes && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{plan.notes}</p>
                          )}
                          {plan.guide && <p className="mt-1 text-xs font-medium text-brand">Open the full teaching guide →</p>}
                        </>
                      ) : (
                        <p className="mt-1 text-sm text-muted-foreground">No lesson plan for today. Tap to plan one.</p>
                      )}
                    </>
                  );
                })()}
              </Card>
            </Link>
          )}

          {isTeacher && routine !== null && (() => {
            const clock = schoolClock(routine.timezone, now);
            const rows = markProgress(routine.items, clock.weekday, clock.minutes);
            const { earlier, now: current, later } = aroundNow(rows);
            const show = [...earlier, ...current, ...later];
            return (
              <Card as="div" className="mb-8 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-display text-sm font-semibold text-foreground">Today&apos;s routine</h2>
                  <Link
                    href="/dashboard/centre/schedule"
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-brand hover:bg-background"
                  >
                    View full routine
                  </Link>
                </div>
                {rows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing scheduled for today.</p>
                ) : show.length === 0 ? (
                  <p className="text-sm text-muted-foreground">That&apos;s the routine done for today.</p>
                ) : (
                  <div className="divide-y divide-border">
                    {show.map((i) => (
                      <div
                        key={i.id}
                        className={`flex gap-4 py-2 text-sm transition-all duration-700 ${
                          i.status === "past" ? "opacity-40" : ""
                        } ${i.status === "current" ? "-mx-2 rounded-lg bg-brand-soft px-2" : ""}`}
                      >
                        <span
                          className={`w-28 shrink-0 tabular-nums text-muted-foreground ${
                            i.status === "past" ? "line-through" : ""
                          }`}
                        >
                          {i.startTime}
                          {i.endTime ? `–${i.endTime}` : ""}
                        </span>
                        <span className={`text-foreground ${i.status === "past" ? "line-through" : ""}`}>
                          {i.activity}
                          {i.status === "current" && (
                            <span className="ml-2 rounded-full bg-brand px-2 py-0.5 text-xs font-medium text-white">
                              Now
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })()}

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
