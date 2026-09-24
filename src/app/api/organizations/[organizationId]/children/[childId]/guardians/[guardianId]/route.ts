import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { guardianUpdateSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { maskIdNumber } from "@/lib/idMask";
import { billingFieldsFromGuardian, pickBillingGuardianId } from "@/lib/billingContact";

type Params = {
  params: Promise<{ organizationId: string; childId: string; guardianId: string }>;
};

async function findAccessibleGuardian(
  organizationId: string,
  childId: string,
  guardianId: string,
  role: string,
  assignedCategoryId: string | null
) {
  const guardian = await db.guardian.findFirst({
    where: { id: guardianId, childId, organizationId },
    include: { child: true },
  });
  if (
    !guardian ||
    (role === "TEACHER" && guardian.child.categoryId !== assignedCategoryId)
  ) {
    return null;
  }
  return guardian;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { organizationId, childId, guardianId } = await params;
    const { userId, role, assignedCategoryId } = await requireMembership(
      organizationId,
      "MANAGE_CHILDREN"
    );

    const existing = await findAccessibleGuardian(
      organizationId,
      childId,
      guardianId,
      role,
      assignedCategoryId
    );
    if (!existing) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const body = guardianUpdateSchema.parse(await req.json());

    if (
      body.photoImage !== undefined &&
      body.photoImage !== null &&
      !existing.child.photoConsentGiven
    ) {
      return NextResponse.json(
        { error: "Photo consent is required (on the child's profile) before a guardian photo can be saved." },
        { status: 400 }
      );
    }

    // If this guardian is the billing contact, the edit carries through to
    // the fees/reminders contact too -- but only for the fields actually
    // being changed, so editing (say) an occupation never wipes a phone.
    const siblings = await db.guardian.findMany({
      where: { childId, organizationId },
      orderBy: { createdAt: "asc" },
    });
    const wasBilling = pickBillingGuardianId(siblings, existing.child) === guardianId;

    const guardian = await db.guardian.update({
      where: { id: guardianId },
      data: {
        relationship: body.relationship ?? undefined,
        firstName: body.firstName ?? undefined,
        lastName: body.lastName ?? undefined,
        idNumber: body.idNumber === undefined ? undefined : body.idNumber,
        occupation: body.occupation === undefined ? undefined : body.occupation,
        phone: body.phone === undefined ? undefined : body.phone,
        email: body.email === undefined ? undefined : body.email,
        photoImage: body.photoImage === undefined ? undefined : body.photoImage,
      },
    });

    let billingWarning: string | null = null;
    if (wasBilling) {
      const { fields, phoneProblem } = billingFieldsFromGuardian(guardian);
      const data: Partial<typeof fields> = {};
      if (body.firstName !== undefined || body.lastName !== undefined) data.parentName = fields.parentName;
      if (body.email !== undefined) data.parentEmail = fields.parentEmail;
      if (body.phone !== undefined) {
        if (phoneProblem) {
          billingWarning =
            "Saved. The phone number isn't one reminders can use, so the old billing phone number was kept.";
        } else {
          data.parentPhone = fields.parentPhone;
        }
      }
      if (Object.keys(data).length > 0) {
        await db.child.update({ where: { id: childId }, data });
      }
    }

    await logAudit({
      organizationId,
      userId,
      action: "guardian.updated",
      entityType: "Guardian",
      entityId: guardian.id,
      metadata: { childId, billingContactUpdated: wasBilling },
    });

    return NextResponse.json({
      guardian: { ...guardian, idNumber: maskIdNumber(guardian.idNumber) },
      billingWarning,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId, childId, guardianId } = await params;
    const { userId, role, assignedCategoryId } = await requireMembership(
      organizationId,
      "MANAGE_CHILDREN"
    );

    const existing = await findAccessibleGuardian(
      organizationId,
      childId,
      guardianId,
      role,
      assignedCategoryId
    );
    if (!existing) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    await db.guardian.delete({ where: { id: guardianId } });

    await logAudit({
      organizationId,
      userId,
      action: "guardian.deleted",
      entityType: "Guardian",
      entityId: guardianId,
      metadata: { childId },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
