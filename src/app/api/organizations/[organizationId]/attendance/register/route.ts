import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { attendanceRegisterSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { resolveAttendanceScope } from "@/lib/attendanceScope";
import { todayInTimeZone } from "@/lib/date";
import { isWeekendDate } from "@/lib/lessonPlan";
import { gradeInfo, sortChildrenByGrade } from "@/lib/classGroups";

type Params = { params: Promise<{ organizationId: string }> };

// The "take the register" page's data source: every currently-enrolled
// child in one class, plus whatever attendance status (if any) is already
// on file for the requested date. A TEACHER's own class always wins over
// whatever categoryId the client asked for, same override rule as the
// children GET route.
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { role, assignedCategoryId } = await requireMembership(organizationId); // any member may view

    const dateParam = req.nextUrl.searchParams.get("date");
    if (!dateParam) {
      return NextResponse.json({ error: "date is required." }, { status: 400 });
    }
    const date = new Date(dateParam);
    if (Number.isNaN(date.getTime())) {
      return NextResponse.json({ error: "Invalid date." }, { status: 400 });
    }

    const requestedCategoryId = req.nextUrl.searchParams.get("categoryId");
    const scope = resolveAttendanceScope(role, assignedCategoryId, requestedCategoryId);

    if (scope.mode === "none") {
      return NextResponse.json({ error: "No class assigned yet." }, { status: 400 });
    }
    if (scope.mode === "all") {
      return NextResponse.json({ error: "categoryId is required." }, { status: 400 });
    }

    const category = await db.category.findFirst({
      where: { id: scope.categoryId, organizationId, parentId: null },
      select: { id: true, name: true },
    });
    if (!category) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const [children, records, gradeRows] = await Promise.all([
      db.child.findMany({
        where: {
          organizationId,
          categoryId: scope.categoryId,
          archived: false,
          deletedAt: null,
          exitDate: null,
        },
        select: { id: true, firstName: true, lastName: true, subCategoryId: true },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      }),
      db.attendanceRecord.findMany({
        where: { organizationId, date, child: { categoryId: scope.categoryId } },
        select: { childId: true, status: true, notifiedAt: true },
      }),
      // Grades of a class group (label only): the register lists children by
      // grade and shows a small grade label per child.
      db.category.findMany({
        where: { organizationId, parentId: scope.categoryId, deletedAt: null },
        select: { id: true, name: true, archived: true, createdAt: true },
      }),
    ]);

    const byChildId = new Map(records.map((r) => [r.childId, r]));
    const grades = gradeInfo(gradeRows);
    const ordered = grades.hasGrades ? sortChildrenByGrade(children, grades.rank, "firstName") : children;

    return NextResponse.json({
      category,
      hasGrades: grades.hasGrades,
      children: ordered.map(({ subCategoryId, ...c }) => ({
        ...c,
        gradeId: subCategoryId,
        gradeName: subCategoryId ? (grades.nameById.get(subCategoryId) ?? null) : null,
        status: byChildId.get(c.id)?.status ?? null,
        notifiedAt: byChildId.get(c.id)?.notifiedAt ?? null,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

// Saves the whole register for one class/day in one request -- "take the
// register on a phone in under a minute" per docs/PLAN.md means this
// should be a single tap, not one request per child. Upserts every
// provided (childId, date) row; a child left off the list simply keeps
// whatever status (or none) it already had, so re-submitting after fixing
// one child's mark doesn't require resending everyone else's.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { userId, role, assignedCategoryId } = await requireMembership(
      organizationId,
      "MANAGE_ATTENDANCE"
    );

    const body = attendanceRegisterSchema.parse(await req.json());

    if (role === "TEACHER" && body.categoryId !== assignedCategoryId) {
      return NextResponse.json({ error: "Not allowed for your class." }, { status: 403 });
    }

    // No school on weekends (Dylan, 5 Oct 2026): no register for anyone.
    if (isWeekendDate(body.date.toISOString().slice(0, 10))) {
      return NextResponse.json({ error: "There is no school on weekends, so no register to take." }, { status: 400 });
    }

    // Teachers can fix today's register but not earlier days (Dylan,
    // 4 Oct 2026). "Today" is the school's own date, not the server's.
    if (role === "TEACHER") {
      const org = await db.organization.findUnique({
        where: { id: organizationId },
        select: { timezone: true },
      });
      const today = todayInTimeZone(org?.timezone ?? "Africa/Johannesburg");
      if (body.date.toISOString().slice(0, 10) !== today) {
        return NextResponse.json(
          { error: "You can only mark today's register. Ask an admin to change an earlier day." },
          { status: 403 }
        );
      }
    }

    const category = await db.category.findFirst({
      where: { id: body.categoryId, organizationId, parentId: null },
      select: { id: true, name: true },
    });
    if (!category) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const childIds = body.records.map((r) => r.childId);
    const validChildren = await db.child.findMany({
      where: { id: { in: childIds }, organizationId, categoryId: body.categoryId },
      select: { id: true },
    });
    const validChildIds = new Set(validChildren.map((c) => c.id));
    const toWrite = body.records.filter((r) => validChildIds.has(r.childId));
    if (toWrite.length === 0) {
      return NextResponse.json({ error: "No valid children in this class." }, { status: 400 });
    }

    await db.$transaction(
      toWrite.map((r) =>
        db.attendanceRecord.upsert({
          where: { childId_date: { childId: r.childId, date: body.date } },
          create: {
            organizationId,
            childId: r.childId,
            date: body.date,
            status: r.status,
            markedByUserId: userId,
          },
          update: { status: r.status, markedByUserId: userId },
        })
      )
    );

    const presentCount = toWrite.filter((r) => r.status === "PRESENT").length;
    const absentCount = toWrite.filter((r) => r.status === "ABSENT").length;

    await logAudit({
      organizationId,
      userId,
      action: "attendance.marked",
      entityType: "Attendance",
      metadata: {
        categoryId: category.id,
        className: category.name,
        date: body.date.toISOString().slice(0, 10),
        presentCount,
        absentCount,
      },
    });

    return NextResponse.json({ ok: true, presentCount, absentCount });
  } catch (err) {
    return handleApiError(err);
  }
}
