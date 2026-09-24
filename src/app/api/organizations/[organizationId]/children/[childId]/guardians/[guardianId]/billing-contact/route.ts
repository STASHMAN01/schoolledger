import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { billingFieldsFromGuardian } from "@/lib/billingContact";

type Params = {
  params: Promise<{ organizationId: string; childId: string; guardianId: string }>;
};

// "Use for fees & reminders": makes this guardian the child's billing
// contact (Child.parentName/Phone/Email), which statements, fee reminders
// and absence emails use. See lib/billingContact.ts.
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId, childId, guardianId } = await params;
    const { userId, role, assignedCategoryId } = await requireMembership(
      organizationId,
      "MANAGE_CHILDREN"
    );

    const guardian = await db.guardian.findFirst({
      where: { id: guardianId, childId, organizationId },
      include: { child: true },
    });
    if (!guardian || (role === "TEACHER" && guardian.child.categoryId !== assignedCategoryId)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const { fields, phoneProblem } = billingFieldsFromGuardian(guardian);
    if (phoneProblem) {
      return NextResponse.json(
        {
          error:
            "This guardian's phone number isn't in a format reminders can use. Fix it first (for example 082 123 4567), then try again.",
        },
        { status: 400 }
      );
    }
    if (!fields.parentPhone && !fields.parentEmail) {
      return NextResponse.json(
        { error: "Add a phone number or email for this guardian first, so reminders have somewhere to go." },
        { status: 400 }
      );
    }

    await db.child.update({ where: { id: childId }, data: fields });

    await logAudit({
      organizationId,
      userId,
      action: "child.billingContact.changed",
      entityType: "Child",
      entityId: childId,
      metadata: { guardianId },
    });

    return NextResponse.json({ ok: true, billingContact: { name: fields.parentName, phone: fields.parentPhone, email: fields.parentEmail } });
  } catch (err) {
    return handleApiError(err);
  }
}
