import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { handleApiError } from "@/lib/apiError";
import { logAudit } from "@/lib/audit";
import { buildMedicineFilename, generateMedicinePdf } from "@/lib/medicinePdf";
import { dayString, orgTimezone } from "@/lib/medicineData";

type Params = { params: Promise<{ organizationId: string; recordId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { organizationId, recordId } = await params;
    const { userId, role, assignedCategoryId } = await requireMembership(organizationId, "VIEW_CENTRE");

    const r = await db.medicineRecord.findFirst({
      where: { id: recordId, organizationId, ...(role === "TEACHER" ? { categoryId: assignedCategoryId ?? "none" } : {}) },
      include: {
        child: { select: { firstName: true, lastName: true, allergies: true } },
        category: { select: { name: true } },
        createdBy: { select: { name: true } },
        doses: { orderBy: { givenAt: "asc" }, include: { givenBy: { select: { name: true } } } },
      },
    });
    if (!r) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const org = await db.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, addressLine1: true, addressLine2: true, province: true },
    });
    if (!org) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const timezone = await orgTimezone(organizationId);

    const bytes = await generateMedicinePdf({
      org,
      timezone,
      child: r.child,
      className: r.category.name,
      medicineName: r.medicineName,
      reason: r.reason,
      isPrescribed: r.isPrescribed,
      prescriberName: r.prescriberName,
      dose: r.dose,
      route: r.route,
      frequency: r.frequency,
      scheduledTimes: r.scheduledTimes,
      startDate: dayString(r.startDate)!,
      endDate: dayString(r.endDate)!,
      lastDoseAtHome: r.lastDoseAtHome,
      storage: r.storage,
      expiryDate: dayString(r.expiryDate),
      originalContainer: r.originalContainer,
      labelMatches: r.labelMatches,
      notExpired: r.notExpired,
      specialInstructions: r.specialInstructions,
      parentName: r.parentName,
      parentRelationship: r.parentRelationship,
      parentPhone: r.parentPhone,
      signatureImage: r.signatureImage,
      signedAt: r.signedAt,
      receivedBy: r.createdBy.name,
      returnedAt: r.returnedAt,
      returnedNote: r.returnedNote,
      doses: r.doses.map((x) => ({
        givenAt: x.givenAt,
        outcome: x.outcome,
        doseGiven: x.doseGiven,
        note: x.note,
        witnessName: x.witnessName,
        givenBy: x.givenBy.name,
      })),
    });

    await logAudit({
      organizationId,
      userId,
      action: "medicine.pdf_generated",
      entityType: "Child",
      entityId: r.childId,
      metadata: { medicineName: r.medicineName },
    });

    const filename = buildMedicineFilename(r.child.firstName, r.child.lastName, dayString(r.startDate)!);
    const download = req.nextUrl.searchParams.get("download") === "1";
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
