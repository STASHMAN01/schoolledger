import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { handleApiError } from "@/lib/apiError";
import { logAudit } from "@/lib/audit";
import { buildReportFilename, generateReportPdf } from "@/lib/reportPdf";

type Params = { params: Promise<{ organizationId: string; reportId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { organizationId, reportId } = await params;
    const { userId, role, assignedCategoryId } = await requireMembership(organizationId);

    const report = await db.childReport.findFirst({
      where: { id: reportId, organizationId },
      select: {
        type: true,
        occurredAt: true,
        summary: true,
        injury: true,
        firstAidGiven: true,
        witnesses: true,
        actionTaken: true,
        incidentTime: true,
        location: true,
        incidentTypes: true,
        incidentTypeOther: true,
        caregiver: true,
        emergencyCareRequired: true,
        staffConsulted: true,
        witnessesPresent: true,
        term: true,
        developmentArea: true,
        rating: true,
        behaviour: true,
        followUp: true,
        parentNotified: true,
        parentNotifiedAt: true,
        createdAt: true,
        categoryId: true,
        child: { select: { firstName: true, lastName: true, dateOfBirth: true } },
        category: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
    });
    if (
      !report ||
      (role === "TEACHER" && (report.categoryId !== assignedCategoryId || report.type !== "INCIDENT"))
    ) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const organization = await db.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, addressLine1: true, addressLine2: true, province: true, letterheadImage: true },
    });
    if (!organization) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const pdfBytes = await generateReportPdf(organization, report);

    await logAudit({
      organizationId,
      userId,
      action: "report.pdf_generated",
      entityType: "Child",
      metadata: { type: report.type },
    });

    const filename = buildReportFilename(report.type, report.child.firstName, report.child.lastName, report.occurredAt);
    const download = req.nextUrl.searchParams.get("download") === "1";
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
