import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { handleApiError } from "@/lib/apiError";
import { resolveAttendanceScope } from "@/lib/attendanceScope";

type Params = { params: Promise<{ organizationId: string }> };

// Powers the Centre Management dashboard's Attendance tile: Present is a
// plain number, Absent is a clickable count (see /attendance/absent).
// `date` is a required yyyy-mm-dd query param computed client-side from
// the browser's own clock -- see the comment on attendanceRegisterSchema
// in validation.ts for why the server never guesses "today" itself.
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
      return NextResponse.json({
        scope: "none",
        className: null,
        total: 0,
        present: 0,
        absent: 0,
        notTaken: 0,
      });
    }

    const [children, records, category] = await Promise.all([
      db.child.findMany({
        where: {
          organizationId,
          categoryId: scope.mode === "single" ? scope.categoryId : undefined,
          archived: false,
          deletedAt: null,
          exitDate: null,
        },
        select: { id: true },
      }),
      db.attendanceRecord.findMany({
        where: {
          organizationId,
          date,
          child: {
            categoryId: scope.mode === "single" ? scope.categoryId : undefined,
            archived: false,
            deletedAt: null,
            exitDate: null,
          },
        },
        select: { status: true },
      }),
      scope.mode === "single"
        ? db.category.findFirst({ where: { id: scope.categoryId, organizationId }, select: { name: true } })
        : Promise.resolve(null),
    ]);

    const present = records.filter((r) => r.status === "PRESENT").length;
    const absent = records.filter((r) => r.status === "ABSENT").length;

    return NextResponse.json({
      scope: scope.mode,
      className: category?.name ?? null,
      total: children.length,
      present,
      absent,
      notTaken: Math.max(children.length - present - absent, 0),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
