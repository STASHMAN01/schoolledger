import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { schoolClock } from "@/lib/dailySummary";
import { blankToNull } from "@/lib/reports";
import { canGiveDose, doseSchema } from "@/lib/medicine";
import { dayString, orgTimezone } from "@/lib/medicineData";

type Params = { params: Promise<{ organizationId: string; recordId: string }> };

// Staff record a dose (or a refused / vomited / skipped one). Only once the
// parent has signed, and only within the course dates and before expiry.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { organizationId, recordId } = await params;
    const { userId, role, assignedCategoryId } = await requireMembership(organizationId, "MANAGE_REPORTS");

    const parsed = doseSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    }
    const body = parsed.data;

    const record = await db.medicineRecord.findFirst({
      where: { id: recordId, organizationId, ...(role === "TEACHER" ? { categoryId: assignedCategoryId ?? "none" } : {}) },
      select: {
        id: true,
        signedAt: true,
        returnedAt: true,
        startDate: true,
        endDate: true,
        expiryDate: true,
        dose: true,
        medicineName: true,
        childId: true,
        child: { select: { firstName: true, lastName: true } },
      },
    });
    if (!record) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const today = schoolClock(await orgTimezone(organizationId)).date;
    const check = canGiveDose(
      {
        signedAt: record.signedAt,
        returnedAt: record.returnedAt,
        startDate: dayString(record.startDate)!,
        endDate: dayString(record.endDate)!,
        expiryDate: dayString(record.expiryDate),
      },
      today
    );
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 409 });

    const dose = await db.medicineDose.create({
      data: {
        organizationId,
        medicineRecordId: record.id,
        outcome: body.outcome,
        doseGiven: body.outcome === "GIVEN" ? blankToNull(body.doseGiven) ?? record.dose : null,
        note: blankToNull(body.note),
        witnessName: blankToNull(body.witnessName),
        givenByUserId: userId,
      },
      select: { id: true },
    });

    await logAudit({
      organizationId,
      userId,
      action: "medicine.dose",
      entityType: "Child",
      entityId: record.childId,
      metadata: {
        childFirstName: record.child.firstName,
        childLastName: record.child.lastName,
        medicineName: record.medicineName,
        outcome: body.outcome,
      },
    });
    return NextResponse.json({ id: dose.id }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
