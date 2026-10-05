import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { parentSignSchema } from "@/lib/medicine";

type Params = { params: Promise<{ organizationId: string; recordId: string }> };

// The parent signs a form that was saved unsigned. Once signed it never
// changes: a mistake means a new form.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { organizationId, recordId } = await params;
    const { userId, role, assignedCategoryId } = await requireMembership(organizationId, "MANAGE_REPORTS");

    const parsed = parentSignSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    }
    const sign = parsed.data;

    const record = await db.medicineRecord.findFirst({
      where: { id: recordId, organizationId, ...(role === "TEACHER" ? { categoryId: assignedCategoryId ?? "none" } : {}) },
      select: { id: true, signedAt: true, medicineName: true, childId: true, child: { select: { firstName: true, lastName: true } } },
    });
    if (!record) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (record.signedAt) return NextResponse.json({ error: "This form is already signed." }, { status: 409 });

    await db.medicineRecord.update({
      where: { id: record.id },
      data: {
        parentName: sign.parentName,
        parentRelationship: sign.parentRelationship,
        parentPhone: sign.parentPhone,
        signatureImage: sign.signature,
        signedAt: new Date(),
        signedWitnessUserId: userId,
      },
    });

    await logAudit({
      organizationId,
      userId,
      action: "medicine.signed",
      entityType: "Child",
      entityId: record.childId,
      metadata: {
        childFirstName: record.child.firstName,
        childLastName: record.child.lastName,
        medicineName: record.medicineName,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
