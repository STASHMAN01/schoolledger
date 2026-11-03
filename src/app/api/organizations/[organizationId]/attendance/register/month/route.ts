import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { handleApiError } from "@/lib/apiError";
import { isMonthKey } from "@/lib/files";
import { loadMonthlyRegister } from "@/lib/attendanceMonth";
import { weekdaysOfMonth } from "@/lib/attendanceRegisterPdf";
import { resolveAttendanceScope } from "@/lib/attendanceScope";

type Params = { params: Promise<{ organizationId: string }> };

// The Attendance page's "Monthly register" view (Dylan, 15 Oct 2026): the
// same children and marks as the printable PDF, as JSON, so the office can
// look through a month on screen before downloading it. Teachers can see
// their own class's past registers too (Dylan, 3 Nov 2026): for a TEACHER
// the categoryId is ignored and their assigned class is used instead.
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { role, assignedCategoryId } = await requireMembership(organizationId, "MANAGE_ATTENDANCE");

    const month = req.nextUrl.searchParams.get("month");
    const scope = resolveAttendanceScope(role, assignedCategoryId, req.nextUrl.searchParams.get("categoryId"));
    if (scope.mode === "none") {
      return NextResponse.json({ error: "No class assigned yet." }, { status: 400 });
    }
    if (scope.mode === "all" || !isMonthKey(month)) {
      return NextResponse.json({ error: "categoryId and month (YYYY-MM) are required." }, { status: 400 });
    }
    const categoryId = scope.categoryId;

    const category = await db.category.findFirst({
      where: { id: categoryId, organizationId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!category) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const rows = await loadMonthlyRegister(organizationId, category.id, month);
    const days = weekdaysOfMonth(month);

    return NextResponse.json({
      categoryId: category.id,
      className: category.name,
      month,
      days,
      rows: rows.map((r) => {
        const marks: Record<number, "P" | "A"> = {};
        let present = 0;
        let absent = 0;
        for (const [day, status] of r.marks) {
          marks[day] = status === "PRESENT" ? "P" : "A";
          if (status === "PRESENT") present++;
          else absent++;
        }
        return { childId: r.childId, firstName: r.firstName, lastName: r.lastName, marks, present, absent };
      }),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
