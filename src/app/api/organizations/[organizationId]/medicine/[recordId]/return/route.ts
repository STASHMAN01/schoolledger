import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { blankToNull } from "@/lib/reports";
import { medicineReturnSchema } from "@/lib/medicine";

type Params = { params: Promise<{ organizationId: string; recordId: string }> };

// The medicine went home with the parent, or the course is over. After this
// no more doses can be recorded.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { organizationId, recordId } = await params;
    const { userId, role, assignedCategoryId } = await requireMembership(organizationId, "MANAGE_REPORTS");
    const body = medicineReturnSchema.parse(await req.json().catch(() => ({})));

    const record = await db.medicineRecord.findFirst({
      where: { id: recordId, organizationId, ...(role === "TEACHER" ? { categoryId: assignedCategoryId ?? "none" } : {}) },
      select: { id: true, returnedAt: true, medicineName: true, childId: true, child: { select: { firstName: true, lastName: true } } },
    });
    if (!record) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (record.returnedAt) return NextResponse.json({ ok: true });

    await db.medicineRecord.update({
      where: { id: record.id },
      data: { returnedAt: new Date(), returnedNote: blankToNull(body.note) },
    });
    await logAudit({
      organizationId,
      userId,
      action: "medicine.returned",
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
