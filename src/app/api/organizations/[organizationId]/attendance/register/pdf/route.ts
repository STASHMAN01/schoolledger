import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { handleApiError } from "@/lib/apiError";
import { logAudit } from "@/lib/audit";
import { isMonthKey, monthRange } from "@/lib/files";
import { buildRegisterFilename, generateAttendanceRegisterPdf } from "@/lib/attendanceRegisterPdf";

type Params = { params: Promise<{ organizationId: string }> };

// One class's attendance for one month as a printable PDF -- what the
// Files > Attendance registers folder opens. A TEACHER can only get their
// own class, same rule as the register itself.
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { userId, role, assignedCategoryId } = await requireMembership(organizationId, "MANAGE_ATTENDANCE");

    const categoryId = req.nextUrl.searchParams.get("categoryId");
    const month = req.nextUrl.searchParams.get("month");
    if (!categoryId || !isMonthKey(month)) {
      return NextResponse.json({ error: "categoryId and month (YYYY-MM) are required." }, { status: 400 });
    }
    if (role === "TEACHER" && categoryId !== assignedCategoryId) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const [category, organization] = await Promise.all([
      db.category.findFirst({
        where: { id: categoryId, organizationId, deletedAt: null },
        select: { id: true, name: true },
      }),
      db.organization.findUnique({
        where: { id: organizationId },
        select: { name: true, addressLine1: true, addressLine2: true, province: true },
      }),
    ]);
    if (!category || !organization) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    // Attendance dates are stored as midnight UTC of the calendar day, so
    // the month's range here is plain UTC, not the school's timezone.
    const { start, end } = monthRange(month, "UTC");

    const [children, records] = await Promise.all([
      db.child.findMany({
        where: { organizationId, categoryId, deletedAt: null },
        select: { id: true, firstName: true, lastName: true, archived: true },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      }),
      db.attendanceRecord.findMany({
        where: { organizationId, child: { categoryId }, date: { gte: start, lt: end } },
        select: { childId: true, date: true, status: true },
      }),
    ]);

    const marksByChild = new Map<string, Map<number, "PRESENT" | "ABSENT">>();
    for (const r of records) {
      const marks = marksByChild.get(r.childId) ?? new Map<number, "PRESENT" | "ABSENT">();
      marks.set(r.date.getUTCDate(), r.status);
      marksByChild.set(r.childId, marks);
    }

    // Archived children only appear if they have marks in this month.
    const rows = children
      .filter((c) => !c.archived || marksByChild.has(c.id))
      .map((c) => ({
        firstName: c.firstName,
        lastName: c.lastName,
        marks: marksByChild.get(c.id) ?? new Map<number, "PRESENT" | "ABSENT">(),
      }));

    const pdfBytes = await generateAttendanceRegisterPdf(organization, category.name, month, rows);

    await logAudit({
      organizationId,
      userId,
      action: "attendance.register_pdf_generated",
      entityType: "Category",
      entityId: category.id,
      metadata: { month },
    });

    const download = req.nextUrl.searchParams.get("download") === "1";
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${buildRegisterFilename(category.name, month)}"`,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
