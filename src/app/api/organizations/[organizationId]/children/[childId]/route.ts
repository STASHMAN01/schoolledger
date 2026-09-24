import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { childSchema, childProfileSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { cancelEntriesAfterExit } from "@/lib/billing/financialPlan";
import { serializeChild } from "@/lib/childView";
import { PROFILE_VIEW_ENTITY_TYPE } from "@/lib/activityArea";

type Params = { params: Promise<{ organizationId: string; childId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId, childId } = await params;
    const { userId, role, assignedCategoryId, permissions } = await requireMembership(organizationId);

    const child = await db.child.findFirst({
      where: { id: childId, organizationId },
      include: {
        category: true,
        creditBalance: true,
        planEntries: {
          include: { paymentType: true },
          orderBy: [{ year: "asc" }, { month: "asc" }],
        },
        guardians: { orderBy: { createdAt: "asc" } },
      },
    });
    // Same "Not found" for a real mismatch and a TEACHER outside their own
    // class — never confirm a child exists in a class they can't see.
    if (!child || (role === "TEACHER" && child.categoryId !== assignedCategoryId)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    // POPIA: record who opened this child's record (shown in the admin-only
    // Privacy log). At most once per person per child every 10 minutes, so
    // reloads and saves on the same page don't flood the log.
    const recent = await db.auditLog.findFirst({
      where: {
        organizationId,
        entityType: PROFILE_VIEW_ENTITY_TYPE,
        entityId: childId,
        userId,
        createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
      },
      select: { id: true },
    });
    if (!recent) {
      await logAudit({
        organizationId,
        userId,
        action: "child.profile.viewed",
        entityType: PROFILE_VIEW_ENTITY_TYPE,
        entityId: childId,
        metadata: { childName: `${child.firstName} ${child.lastName}` },
      });
    }

    // ID numbers are masked by default everywhere (see reveal-id/route.ts
    // for the audit-logged endpoint that returns the real value), and money
    // is blanked for anyone without VIEW_MONEY -- see src/lib/childView.ts.
    return NextResponse.json({
      child: serializeChild(child, permissions.includes("VIEW_MONEY")),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { organizationId, childId } = await params;
    const { userId, role, assignedCategoryId, permissions } = await requireMembership(
      organizationId,
      "MANAGE_CHILDREN"
    );
    const canViewMoney = permissions.includes("VIEW_MONEY");

    const existing = await db.child.findFirst({
      where: { id: childId, organizationId },
    });
    if (!existing || (role === "TEACHER" && existing.categoryId !== assignedCategoryId)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const rawBody = await req.json();
    const body = childSchema.partial().parse(rawBody);
    const profileBody = childProfileSchema.parse(rawBody);

    // A fee override is money -- only VIEW_MONEY may change it.
    if (body.feeOverrideCents !== undefined && !canViewMoney) {
      return NextResponse.json(
        { error: "You don't have permission to change a fee." },
        { status: 403 }
      );
    }

    // A photo can only be set/changed alongside explicit consent -- either
    // this request is granting it (photoConsentGiven: true) or the child
    // already has it on file from an earlier request.
    if (
      profileBody.photoImage !== undefined &&
      profileBody.photoImage !== null &&
      !profileBody.photoConsentGiven &&
      !existing.photoConsentGiven
    ) {
      return NextResponse.json(
        { error: "Photo consent is required before a photo can be saved." },
        { status: 400 }
      );
    }

    if (role === "TEACHER" && body.categoryId && body.categoryId !== assignedCategoryId) {
      return NextResponse.json(
        { error: "You can only move children within your own class." },
        { status: 403 }
      );
    }

    if (body.categoryId) {
      const category = await db.category.findFirst({
        where: { id: body.categoryId, organizationId, deletedAt: null },
      });
      if (!category) {
        return NextResponse.json(
          { error: "Class not found." },
          { status: 400 }
        );
      }
    }

    const exitDateChanged =
      body.exitDate !== undefined &&
      body.exitDate !== null &&
      body.exitDate.getTime() !== existing.exitDate?.getTime();

    const child = await db.$transaction(async (tx) => {
      const updated = await tx.child.update({
        where: { id: childId },
        data: {
          categoryId: body.categoryId ?? undefined,
          firstName: body.firstName ?? undefined,
          lastName: body.lastName ?? undefined,
          parentName: body.parentName ?? undefined,
          parentPhone: body.parentPhone === undefined ? undefined : body.parentPhone,
          parentEmail: body.parentEmail === undefined ? undefined : body.parentEmail,
          enrollmentDate: body.enrollmentDate ?? undefined,
          exitDate: body.exitDate === undefined ? undefined : body.exitDate,
          feeOverrideCents:
            body.feeOverrideCents === undefined ? undefined : body.feeOverrideCents,
          dateOfBirth:
            profileBody.dateOfBirth === undefined ? undefined : profileBody.dateOfBirth,
          photoImage:
            profileBody.photoImage === undefined ? undefined : profileBody.photoImage,
          photoConsentGiven:
            profileBody.photoConsentGiven === undefined
              ? undefined
              : profileBody.photoConsentGiven,
          photoConsentAt:
            profileBody.photoConsentGiven === true ? new Date() : undefined,
          gender: profileBody.gender === undefined ? undefined : profileBody.gender,
        },
      });

      if (exitDateChanged && updated.exitDate) {
        await cancelEntriesAfterExit(
          tx,
          organizationId,
          childId,
          updated.exitDate,
          userId
        );
      }

      return updated;
    });

    await logAudit({
      organizationId,
      userId,
      action: "child.updated",
      entityType: "Child",
      entityId: child.id,
    });

    return NextResponse.json({ child: serializeChild(child, canViewMoney) });
  } catch (err) {
    return handleApiError(err);
  }
}

// Archive, never hard-delete — same reasoning as categories: an accidental
// click must be recoverable, and a child's payment history must never
// disappear even after they leave the school.
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId, childId } = await params;
    const { userId, role, assignedCategoryId, permissions } = await requireMembership(
      organizationId,
      "MANAGE_CHILDREN"
    );

    const existing = await db.child.findFirst({
      where: { id: childId, organizationId },
    });
    if (!existing || (role === "TEACHER" && existing.categoryId !== assignedCategoryId)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const child = await db.child.update({
      where: { id: childId },
      data: { archived: true },
    });

    await logAudit({
      organizationId,
      userId,
      action: "child.archived",
      entityType: "Child",
      entityId: child.id,
    });

    return NextResponse.json({ child: serializeChild(child, permissions.includes("VIEW_MONEY")) });
  } catch (err) {
    return handleApiError(err);
  }
}
