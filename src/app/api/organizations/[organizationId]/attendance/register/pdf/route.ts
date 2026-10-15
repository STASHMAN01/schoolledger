import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { handleApiError } from "@/lib/apiError";
import { logAudit } from "@/lib/audit";
import { isMonthKey } from "@/lib/files";
import { loadMonthlyRegister } from "@/lib/attendanceMonth";
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

    const rows = await loadMonthlyRegister(organizationId, category.id, month);

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
