import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { handleApiError } from "@/lib/apiError";
import { resolveAttendanceScope } from "@/lib/attendanceScope";
import { getOutstandingReminders } from "@/lib/billing/outstandingReminders";
import { hasUnseenScheduleChange } from "@/lib/scheduleNotice";
import { isProfileIncomplete } from "@/lib/childProfile";
import { finalReviewWindow } from "@/lib/deletion";
import { isSummaryDue, schoolClock, schoolDateValue } from "@/lib/dailySummary";
import { isWeekendDate } from "@/lib/lessonPlan";

type Params = { params: Promise<{ organizationId: string }> };

type TodoItem = {
  id: string;
  label: string;
  count: number;
  href: string;
  // Dylan, 8 Oct 2026: the three things a class teacher must do every single
  // day (register, classwork, daily report). They are listed from the start
  // of the day rather than from a reminder hour, and the widget pins them to
  // the top, so nobody has to remember what the day's minimum is.
  required?: boolean;
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
    const { userId, role, permissions, assignedCategoryId } = await requireMembership(organizationId);

    const todos: TodoItem[] = [];
    // Each dashboard shows only its own mode's to-dos (Dylan 23 Sept):
    // "centre" or "accounting"; omitted = everything.
    const mode = req.nextUrl.searchParams.get("mode");
    const inCentre = mode !== "accounting";
    const inAccounting = mode !== "centre";
    const dateParam = req.nextUrl.searchParams.get("date");
    const date = dateParam ? new Date(dateParam) : null;
    const hasValidDate = date !== null && !Number.isNaN(date.getTime());

    const canAttendance =
      inCentre && permissions.includes("VIEW_CENTRE") && permissions.includes("MANAGE_ATTENDANCE");
    const canReviews =
      inCentre && permissions.includes("VIEW_CENTRE") && permissions.includes("MANAGE_CHILDREN");
    const canReminders =
      inAccounting &&
      permissions.includes("VIEW_ACCOUNTING") &&
      permissions.includes("SEND_REMINDERS") &&
      permissions.includes("VIEW_MONEY");

    if (canAttendance && hasValidDate && !isWeekendDate(dateParam!.slice(0, 10))) {
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
            required: true,
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
          link:
            role === "TEACHER" && assignedCategoryId
              ? { child: { categoryId: assignedCategoryId } }
              : undefined,
        },
      });
      if (pendingCount > 0) {
        todos.push({
          id: "reviews.pending",
          label: "Review online submissions",
          count: pendingCount,
          href: "/dashboard/centre/admissions#submissions",
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

    // Centre: children whose parent isn't ticked off as added to their
    // class WhatsApp group yet, and children missing core details. Both are
    // for whoever manages children (TEACHER: own class only).
    if (canReviews && !(role === "TEACHER" && !assignedCategoryId)) {
      const scope = resolveAttendanceScope(role, assignedCategoryId, null);
      const active = await db.child.findMany({
        where: {
          organizationId,
          archived: false,
          deletedAt: null,
          exitDate: null,
          ...(scope.mode === "single" ? { categoryId: scope.categoryId } : {}),
        },
        select: {
          categoryId: true,
          dateOfBirth: true,
          gender: true,
          parentPhone: true,
          guardians: { select: { phone: true } },
          whatsappGroupChecks: { select: { categoryId: true } },
        },
      });
      // A tick only counts for the class the child is in now.
      const notInGroup = active.filter(
        (c) => !c.whatsappGroupChecks.some((w) => w.categoryId === c.categoryId)
      ).length;
      if (notInGroup > 0) {
        todos.push({
          id: "whatsapp.add",
          label: "Add new children's parents to the class WhatsApp group",
          count: notInGroup,
          href: "/dashboard/centre/communication",
        });
      }
      const incomplete = active.filter((c) => isProfileIncomplete(c)).length;
      if (incomplete > 0) {
        todos.push({
          id: "children.incomplete",
          label: "Complete children's profiles",
          count: incomplete,
          href: "/dashboard/centre/enrolled?incomplete=1",
        });
      }
    }

    // Phase 5: a teacher is told when someone else changed their class's
    // timetable; opening the Timetable page clears it (schedule/acknowledge).
    if (
      inCentre &&
      role === "TEACHER" &&
      assignedCategoryId &&
      permissions.includes("VIEW_CENTRE") &&
      (await hasUnseenScheduleChange(organizationId, userId, assignedCategoryId))
    ) {
      todos.push({
        id: "schedule.changed",
        label: "Your class routine changed — have a look",
        count: 1,
        href: "/dashboard/centre/schedule",
      });
    }

    // Daily summary (Dylan, 4 Oct 2026), weekdays from 12:00 school time:
    // the class teacher is asked to send it; admins/managers see how many
    // classes haven't.
    if (inCentre && permissions.includes("VIEW_CENTRE")) {
      const org = await db.organization.findUnique({ where: { id: organizationId }, select: { timezone: true } });
      const clock = schoolClock(org?.timezone ?? "Africa/Johannesburg");
      const summaryDate = schoolDateValue(clock.date);
      if (clock.weekday <= 5) {
        const date = summaryDate;
        if (role === "TEACHER" && assignedCategoryId) {
          const sent = await db.dailySummary.findUnique({
            where: { categoryId_date: { categoryId: assignedCategoryId, date } },
            select: { id: true },
          });
          if (!sent) {
            todos.push({
              id: "dailySummary.send",
              label: "Send today's daily report",
              count: 1,
              href: "/dashboard/centre/daily-summary",
              required: true,
            });
          }
        } else if (role !== "TEACHER" && permissions.includes("MANAGE_CLASSES") && isSummaryDue(clock)) {
          const classes = await db.membership.findMany({
            where: {
              organizationId,
              role: "TEACHER",
              assignedCategoryId: { not: null },
              assignedCategory: { deletedAt: null, archived: false },
            },
            select: { assignedCategoryId: true },
            distinct: ["assignedCategoryId"],
          });
          const ids = classes.map((c) => c.assignedCategoryId!);
          const sent = ids.length
            ? await db.dailySummary.count({ where: { organizationId, categoryId: { in: ids }, date } })
            : 0;
          const missing = ids.length - sent;
          if (missing > 0) {
            todos.push({
              id: "dailySummary.missing",
              label: `${missing === 1 ? "1 class hasn't" : `${missing} classes haven't`} sent today's daily report`,
              count: missing,
              href: "/dashboard/centre/daily-summary",
            });
          }
        }
      }
    }

    // Classwork (Dylan, 5 Oct 2026): from 15:00 school time on weekdays a
    // class teacher is reminded to record what the class did today.
    if (inCentre && role === "TEACHER" && assignedCategoryId && permissions.includes("VIEW_CENTRE")) {
      const org = await db.organization.findUnique({ where: { id: organizationId }, select: { timezone: true } });
      const clock = schoolClock(org?.timezone ?? "Africa/Johannesburg");
      if (clock.weekday <= 5) {
        const recorded = await db.classworkEntry.count({
          where: { categoryId: assignedCategoryId, date: schoolDateValue(clock.date) },
        });
        if (recorded === 0) {
          todos.push({
            id: "classwork.record",
            label: "Record today's classwork",
            count: 1,
            href: "/dashboard/centre/classwork",
            required: true,
          });
        }
      }
    }

    // Lesson plans (Dylan, 5 Oct 2026): teachers propose them, an admin
    // reviews them; a plan sent back shows on that teacher's list.
    if (inCentre && permissions.includes("VIEW_CENTRE")) {
      if (role !== "TEACHER" && permissions.includes("MANAGE_CLASSES")) {
        const waiting = await db.lessonPlan.findMany({
          where: { organizationId, status: "PENDING", category: { deletedAt: null } },
          distinct: ["categoryId"],
          select: { categoryId: true },
        });
        if (waiting.length > 0) {
          todos.push({
            id: "lessonPlan.review",
            label: `Review lesson plans for ${waiting.length === 1 ? "1 class" : `${waiting.length} classes`}`,
            count: waiting.length,
            href: "/dashboard/centre/lesson-plan",
          });
        }
      } else if (role === "TEACHER" && assignedCategoryId) {
        const returned = await db.lessonPlan.count({
          where: { organizationId, categoryId: assignedCategoryId, status: "RETURNED" },
        });
        if (returned > 0) {
          todos.push({
            id: "lessonPlan.returned",
            label: "Your lesson plan was sent back — fix it and send it again",
            count: returned,
            href: "/dashboard/centre/lesson-plan",
          });
        }
      }
    }

    // Medicine a parent brought in but hasn't signed for yet (Dylan, 5 Oct 2026).
    if (inCentre && permissions.includes("VIEW_CENTRE") && permissions.includes("MANAGE_REPORTS")) {
      const clock = schoolClock(
        (await db.organization.findUnique({ where: { id: organizationId }, select: { timezone: true } }))?.timezone ??
          "Africa/Johannesburg"
      );
      const day = schoolDateValue(clock.date);
      const unsigned = await db.medicineRecord.count({
        where: {
          organizationId,
          signedAt: null,
          returnedAt: null,
          startDate: { lte: day },
          endDate: { gte: day },
          child: { archived: false },
          ...(role === "TEACHER" ? { categoryId: assignedCategoryId ?? "none" } : {}),
        },
      });
      if (unsigned > 0) {
        todos.push({
          id: "medicine.unsigned",
          label: `Get a parent's signature for ${unsigned === 1 ? "1 medicine" : `${unsigned} medicines`}`,
          count: unsigned,
          href: "/dashboard/centre/medicine",
        });
      }
    }

    // Tasks an admin assigned to this teacher's class and nobody has done.
    if (inCentre && role === "TEACHER" && assignedCategoryId && permissions.includes("VIEW_CENTRE")) {
      const open = await db.teacherTask.count({
        where: { organizationId, categoryId: assignedCategoryId, completedAt: null },
      });
      if (open > 0) {
        todos.push({
          id: "tasks.open",
          label: open === 1 ? "1 task assigned to your class" : `${open} tasks assigned to your class`,
          count: open,
          href: "/dashboard/centre/tasks",
        });
      }
    }

    // Final review (Dylan, 4 Oct 2026): deleting is one step now, so admins
    // get one last look on the day before a class or child in Trash is
    // removed for good. Shown in both modes; opening Trash lets them
    // restore anything. Clears itself once the day passes or it's restored.
    if (permissions.includes("APPROVE_DELETION")) {
      const window = finalReviewWindow();
      const [classes, children] = await Promise.all([
        db.category.count({ where: { organizationId, deletedAt: window } }),
        db.child.count({ where: { organizationId, deletedAt: window } }),
      ]);
      const due = classes + children;
      if (due > 0) {
        todos.push({
          id: "trash.finalReview",
          label: `Final review: ${due === 1 ? "1 deleted record will be" : `${due} deleted records will be`} permanently removed within a day. Restore anything you still need`,
          count: due,
          href: inAccounting && !inCentre ? "/dashboard/accounting/settings/trash" : "/dashboard/centre/settings/trash",
        });
      }
    }

    return NextResponse.json({ todos });
  } catch (err) {
    return handleApiError(err);
  }
}
