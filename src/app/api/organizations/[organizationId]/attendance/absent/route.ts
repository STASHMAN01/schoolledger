import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { handleApiError } from "@/lib/apiError";
import { resolveAttendanceScope } from "@/lib/attendanceScope";

type Params = { params: Promise<{ organizationId: string }> };

// The dashboard Attendance tile's "Absent" count is clickable -- this is
// what it opens onto: today's absent children (optionally scoped to one
// class), each with a one-tap "Notify" action (see POST /attendance/notify).
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
      return NextResponse.json({ records: [] });
    }

    const records = await db.attendanceRecord.findMany({
      where: {
        organizationId,
        date,
        status: "ABSENT",
        child: {
          categoryId: scope.mode === "single" ? scope.categoryId : undefined,
          archived: false,
          deletedAt: null,
        },
      },
      include: {
        child: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            parentEmail: true,
            category: { select: { name: true } },
          },
        },
      },
      orderBy: [{ child: { firstName: "asc" } }],
    });

    return NextResponse.json({
      records: records.map((r) => ({
        id: r.id,
        childId: r.child.id,
        firstName: r.child.firstName,
        lastName: r.child.lastName,
        className: r.child.category.name,
        hasParentEmail: Boolean(r.child.parentEmail),
        notifiedAt: r.notifiedAt,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
