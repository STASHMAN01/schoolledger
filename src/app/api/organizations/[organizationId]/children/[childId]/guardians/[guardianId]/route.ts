import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { guardianUpdateSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { maskIdNumber } from "@/lib/idMask";

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

    await logAudit({
      organizationId,
      userId,
      action: "guardian.updated",
      entityType: "Guardian",
      entityId: guardian.id,
      metadata: { childId },
    });

    return NextResponse.json({
      guardian: { ...guardian, idNumber: maskIdNumber(guardian.idNumber) },
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
