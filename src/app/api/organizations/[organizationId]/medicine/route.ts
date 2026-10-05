import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { resolveAttendanceScope } from "@/lib/attendanceScope";
import { schoolClock } from "@/lib/dailySummary";
import { DATE_RE } from "@/lib/lessonPlan";
import { CONSENT_VERSION, medicineCreateSchema } from "@/lib/medicine";
import { blankToNull } from "@/lib/reports";
import { orgTimezone, recordSelect, schoolDateValue, serializeRecord } from "@/lib/medicineData";

type Params = { params: Promise<{ organizationId: string }> };

// Medicine register (Dylan, 5 Oct 2026).
// Read: anyone in Centre Management (a teacher sees their own class only).
// Write: MANAGE_REPORTS (teachers hold it), own class only.

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { role, assignedCategoryId } = await requireMembership(organizationId, "VIEW_CENTRE");

    const timezone = await orgTimezone(organizationId);
    const today = schoolClock(timezone).date;
    const requested = req.nextUrl.searchParams.get("date");
    const date = requested && DATE_RE.test(requested) ? requested : today;

    const scope = resolveAttendanceScope(role, assignedCategoryId, req.nextUrl.searchParams.get("categoryId"));
    if (scope.mode === "none") {
      return NextResponse.json({ date, today, timezone, records: [], summary: { children: 0, unsigned: 0, total: 0 } });
    }

    const day = schoolDateValue(date);
    const rows = await db.medicineRecord.findMany({
      where: {
        organizationId,
        ...(scope.mode === "single" ? { categoryId: scope.categoryId } : {}),
        startDate: { lte: day },
        endDate: { gte: day },
        // Handed back before this day: no longer in the building.
        OR: [{ returnedAt: null }, { returnedAt: { gte: day } }],
        child: { archived: false },
      },
      orderBy: [{ signedAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
      take: 300,
      select: recordSelect,
    });

    const records = rows.map((r) => serializeRecord(r, date, timezone));
    const open = records.filter((r) => !r.returnedAt);
    return NextResponse.json({
      date,
      today,
      timezone,
      records,
      summary: {
        children: new Set(open.map((r) => r.child.id)).size,
        unsigned: open.filter((r) => !r.signed).length,
        total: open.length,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

// A teacher (or admin) takes in a medicine. The parent can sign on the spot
// (`sign`), or the form is saved unsigned and signed later.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { userId, role, assignedCategoryId } = await requireMembership(organizationId, "MANAGE_REPORTS");

    const parsed = medicineCreateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    }
    const body = parsed.data;

    const child = await db.child.findFirst({
      where: { id: body.childId, organizationId, archived: false },
      select: { id: true, categoryId: true, firstName: true, lastName: true },
    });
    if (!child) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (role === "TEACHER" && child.categoryId !== assignedCategoryId) {
      return NextResponse.json({ error: "Not allowed for your class." }, { status: 403 });
    }

    const timezone = await orgTimezone(organizationId);
    const today = schoolClock(timezone).date;
    if (body.endDate < today) {
      return NextResponse.json({ error: "The last day has already passed." }, { status: 400 });
    }

    const sign = body.sign;
    const record = await db.medicineRecord.create({
      data: {
        organizationId,
        childId: child.id,
        categoryId: child.categoryId,
        medicineName: body.medicineName,
        reason: body.reason,
        isPrescribed: body.isPrescribed,
        prescriberName: body.isPrescribed ? blankToNull(body.prescriberName) : null,
        dose: body.dose,
        route: body.route,
        frequency: body.frequency,
        scheduledTimes: [...new Set(body.scheduledTimes)].sort(),
        startDate: schoolDateValue(body.startDate),
        endDate: schoolDateValue(body.endDate),
        lastDoseAtHome: blankToNull(body.lastDoseAtHome),
        storage: body.storage,
        expiryDate: body.expiryDate ? schoolDateValue(body.expiryDate) : null,
        originalContainer: body.originalContainer,
        labelMatches: body.labelMatches,
        notExpired: body.notExpired,
        specialInstructions: blankToNull(body.specialInstructions),
        consentVersion: CONSENT_VERSION,
        ...(sign
          ? {
              parentName: sign.parentName,
              parentRelationship: sign.parentRelationship,
              parentPhone: sign.parentPhone,
              signatureImage: sign.signature,
              signedAt: new Date(),
              signedWitnessUserId: userId,
            }
          : {}),
        createdByUserId: userId,
      },
      select: { id: true },
    });

    await logAudit({
      organizationId,
      userId,
      action: "medicine.created",
      entityType: "Child",
      entityId: child.id,
      metadata: {
        childFirstName: child.firstName,
        childLastName: child.lastName,
        medicineName: body.medicineName,
        signed: Boolean(sign),
      },
    });

    return NextResponse.json({ id: record.id, signed: Boolean(sign) }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
