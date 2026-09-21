import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { childSchema, childProfileSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { cancelEntriesAfterExit } from "@/lib/billing/financialPlan";
import { maskIdNumber } from "@/lib/idMask";

type Params = { params: Promise<{ organizationId: string; childId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId, childId } = await params;
    const { role, assignedCategoryId } = await requireMembership(organizationId);

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

    // ID numbers are masked by default everywhere -- see reveal-id/route.ts
    // for the audit-logged endpoint that returns the real value.
    return NextResponse.json({
      child: {
        ...child,
        childIdNumber: maskIdNumber(child.childIdNumber),
        parentIdNumber: maskIdNumber(child.parentIdNumber),
        guardians: child.guardians.map((g) => ({ ...g, idNumber: maskIdNumber(g.idNumber) })),
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { organizationId, childId } = await params;
    const { userId, role, assignedCategoryId } = await requireMembership(
      organizationId,
      "MANAGE_CHILDREN"
    );

    const existing = await db.child.findFirst({
      where: { id: childId, organizationId },
    });
    if (!existing || (role === "TEACHER" && existing.categoryId !== assignedCategoryId)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const rawBody = await req.json();
    const body = childSchema.partial().parse(rawBody);
    const profileBody = childProfileSchema.parse(rawBody);

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
          { error: "Category not found." },
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

    return NextResponse.json({ child });
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
    const { userId, role, assignedCategoryId } = await requireMembership(
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

    return NextResponse.json({ child });
  } catch (err) {
    return handleApiError(err);
  }
}
