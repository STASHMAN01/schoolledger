import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { handleApiError } from "@/lib/apiError";
import { resolveAttendanceScope } from "@/lib/attendanceScope";
import { getOutstandingReminders } from "@/lib/billing/outstandingReminders";

type Params = { params: Promise<{ organizationId: string }> };

type TodoItem = {
  id: string;
  label: string;
  count: number;
  href: string;
};

// Phase 3 Session 2 -- the to-do engine v1 (see docs/PLAN.md: "3-4 tasks
// the app can actually observe... clears itself on the observed action,
// no manual ticking"). Deliberately NO new table: every item here is
// computed live from data that already exists (AttendanceRecord,
// ParentSubmission, the reminders helper) rather than a checklist someone
// has to maintain -- so an item simply stops being returned the moment
// its underlying condition is resolved, which is what "clears itself"
// means in practice. Same role/class scoping every other endpoint in
// this app already uses (TEACHER limited to their own assigned class),
// so this list is naturally different for a teacher than an admin.
//
// `date` is a required query param (yyyy-mm-dd, computed client-side from
// the browser's own clock) for the two attendance-related items, same
// convention as every other /attendance/* route -- see the comment on
// attendanceRegisterSchema in validation.ts for why the server never
// guesses "today" itself. The other two items don't depend on a date and
// are still returned even if `date` is omitted.
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { role, permissions, assignedCategoryId } = await requireMembership(organizationId);

    const todos: TodoItem[] = [];
    const dateParam = req.nextUrl.searchParams.get("date");
    const date = dateParam ? new Date(dateParam) : null;
    const hasValidDate = date !== null && !Number.isNaN(date.getTime());

    const canAttendance = permissions.includes("VIEW_CENTRE") && permissions.includes("MANAGE_ATTENDANCE");
    const canReviews = permissions.includes("VIEW_CENTRE") && permissions.includes("MANAGE_CHILDREN");
    const canReminders =
      permissions.includes("VIEW_ACCOUNTING") &&
      permissions.includes("SEND_REMINDERS") &&
      permissions.includes("VIEW_MONEY");

    if (canAttendance && hasValidDate) {
      const scope = resolveAttendanceScope(role, assignedCategoryId, null);

      if (scope.mode === "single") {
        const [enrolledCount, markedCount, category] = await Promise.all([
          db.child.count({
            where: {
              organizationId,
              categoryId: scope.categoryId,
              archived: false,
              deletedAt: null,
              exitDate: null,
            },
          }),
          db.attendanceRecord.count({
            where: { organizationId, date, child: { categoryId: scope.categoryId } },
          }),
          db.category.findUnique({ where: { id: scope.categoryId }, select: { name: true } }),
        ]);
        const remaining = Math.max(enrolledCount - markedCount, 0);
        if (remaining > 0) {
          todos.push({
            id: "attendance.take",
            label: `Take attendance for ${category?.name ?? "your class"}`,
            count: remaining,
            href: "/dashboard/centre/attendance",
          });
        }
      } else if (scope.mode === "all") {
        const categories = await db.category.findMany({
          where: { organizationId, archived: false, deletedAt: null },
          select: { id: true },
        });
        let classesNeeded = 0;
        for (const cat of categories) {
          const [enrolledCount, markedCount] = await Promise.all([
            db.child.count({
              where: {
                organizationId,
                categoryId: cat.id,
                archived: false,
                deletedAt: null,
                exitDate: null,
              },
            }),
            db.attendanceRecord.count({
              where: { organizationId, date, child: { categoryId: cat.id } },
            }),
          ]);
          if (enrolledCount > 0 && markedCount < enrolledCount) classesNeeded++;
        }
        if (classesNeeded > 0) {
          todos.push({
            id: "attendance.take",
            label: "Take attendance",
            count: classesNeeded,
            href: "/dashboard/centre/attendance",
          });
        }
      }

      // Absent-parents-not-yet-notified, same scope as the register check
      // above (TEACHER: own class; anyone else: every class). Skipped
      // entirely for a TEACHER with no assigned class (scope.mode "none")
      // -- never falls through to an org-wide query for them.
      if (scope.mode !== "none") {
        const notifyCount = await db.attendanceRecord.count({
          where: {
            organizationId,
            date,
            status: "ABSENT",
            notifiedAt: null,
            child: {
              categoryId: scope.mode === "single" ? scope.categoryId : undefined,
              archived: false,
              deletedAt: null,
              parentEmail: { not: null },
            },
          },
        });
        if (notifyCount > 0) {
          todos.push({
            id: "attendance.notify",
            label: "Notify absent parents",
            count: notifyCount,
            href: "/dashboard/centre/attendance/absent",
          });
        }
      }
    }

    // A TEACHER with no assigned class yet has nothing to review (same
    // "no class, no data" rule as the attendance routes) -- skip the
    // query entirely rather than filtering by a categoryId that isn't
    // there.
    if (canReviews && !(role === "TEACHER" && !assignedCategoryId)) {
      const pendingCount = await db.parentSubmission.count({
        where: {
          organizationId,
          status: "PENDING",
          // ParentSubmission has no direct child/categoryId of its own
          // (see the model comment -- nothing about the submission is
          // real until approved), so scope through the link it came from,
          // which does point at an existing Child.
          link: role === "TEACHER" ? { child: { categoryId: assignedCategoryId } } : undefined,
        },
      });
      if (pendingCount > 0) {
        todos.push({
          id: "reviews.pending",
          label: "Review pending enrolment forms",
          count: pendingCount,
          href: "/dashboard/centre/pending-reviews",
        });
      }
    }

    if (canReminders) {
      const outstanding = await getOutstandingReminders(organizationId);
      if (outstanding.length > 0) {
        todos.push({
          id: "reminders.send",
          label: "Send payment reminders",
          count: outstanding.length,
          href: "/dashboard/accounting/reminders",
        });
      }
    }

    return NextResponse.json({ todos });
  } catch (err) {
    return handleApiError(err);
  }
}
