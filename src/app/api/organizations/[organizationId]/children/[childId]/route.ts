import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { childSchema, childProfileSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import {
  generateAnnualPlanForChild,
  getPrimaryRecurringPaymentType,
  monthlyFeeForChild,
} from "@/lib/billing/financialPlan";
import { planAdjustments, summariseAdjustments, ymFromDate } from "@/lib/billing/planAdjust";
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

    // Start and leaving dates decide which months are billed, so a teacher
    // (scoped to one class, no billing role) can't change them.
    const startChanged =
      body.enrollmentDate !== undefined && body.enrollmentDate.getTime() !== existing.enrollmentDate.getTime();
    const exitChanged =
      body.exitDate !== undefined && (body.exitDate?.getTime() ?? null) !== (existing.exitDate?.getTime() ?? null);
    if (role === "TEACHER" && (startChanged || exitChanged)) {
      return NextResponse.json(
        { error: "Only the office can change a child's start or leaving date." },
        { status: 403 }
      );
    }

    const oldCategory = await db.category.findFirst({ where: { id: existing.categoryId, organizationId } });
    const newCategory = body.categoryId
      ? await db.category.findFirst({ where: { id: body.categoryId, organizationId, deletedAt: null } })
      : oldCategory;
    if (!newCategory || !oldCategory) {
      return NextResponse.json({ error: "Class not found." }, { status: 400 });
    }

    const newStart = body.enrollmentDate ?? existing.enrollmentDate;
    const newExit = body.exitDate === undefined ? existing.exitDate : body.exitDate;
    if (newExit && newExit.getTime() < newStart.getTime()) {
      return NextResponse.json(
        { error: "The leaving date can't be before the start date." },
        { status: 400 }
      );
    }

    // What this edit does to the monthly fee charges (lib/billing/planAdjust.ts).
    const oldFee = monthlyFeeForChild(existing, oldCategory);
    const newFee = monthlyFeeForChild(
      { feeOverrideCents: body.feeOverrideCents === undefined ? existing.feeOverrideCents : body.feeOverrideCents },
      newCategory
    );
    const feeChanged = newFee !== oldFee;
    const datesChanged = startChanged || exitChanged;
    const recurringType =
      feeChanged || datesChanged ? await getPrimaryRecurringPaymentType(db, organizationId) : null;
    const adjustments = recurringType
      ? planAdjustments({
          entries: await db.financialPlanEntry.findMany({
            where: { organizationId, childId, paymentTypeId: recurringType.id },
          }),
          recurringTypeId: recurringType.id,
          today: ymFromDate(new Date()),
          newFeeCents: newFee,
          start: ymFromDate(newStart),
          exit: newExit ? ymFromDate(newExit) : null,
          feeChanged,
          datesChanged,
        })
      : [];

    // "?preview=1": say what would change, without changing anything.
    if (req.nextUrl.searchParams.get("preview") === "1") {
      return NextResponse.json({
        preview: {
          ...summariseAdjustments(adjustments),
          feeChanged,
          ...(canViewMoney ? { oldFeeCents: oldFee, newFeeCents: newFee } : {}),
        },
      });
    }

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
          // ID numbers: a new value replaces the old one; blank leaves it.
          childIdNumber: body.childIdNumber ?? undefined,
          parentIdNumber: body.parentIdNumber ?? undefined,
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

      for (const u of adjustments) {
        // Guarded: only applies if the charge is still exactly as it was
        // read (unpaid / still cancelled), so a payment recorded at the
        // same moment is never overwritten.
        await tx.financialPlanEntry.updateMany({
          where: {
            id: u.id,
            organizationId,
            ...(u.kind === "restored" ? { status: "CANCELLED" } : { amountPaidCents: 0 }),
          },
          data: { status: u.status, ...(u.amountDueCents !== undefined ? { amountDueCents: u.amountDueCents } : {}) },
        });
      }
      // Fill in this year's months that are now inside the enrolled
      // period but were never created (e.g. an earlier start date), and
      // let any credit settle the new amounts. Never adds Registration.
      if (feeChanged || datesChanged) {
        await generateAnnualPlanForChild(
          tx,
          organizationId,
          updated,
          newCategory,
          new Date().getUTCFullYear(),
          userId,
          false
        );
      }

      return updated;
    });

    const changedFields = Object.keys(rawBody ?? {}).filter((k) => k !== "childIdNumber" && k !== "parentIdNumber");
    await logAudit({
      organizationId,
      userId,
      action: "child.updated",
      entityType: "Child",
      entityId: child.id,
      metadata: {
        fields: changedFields,
        ...(adjustments.length > 0 ? { feeCharges: summariseAdjustments(adjustments) } : {}),
      },
    });
    if (body.childIdNumber || body.parentIdNumber) {
      // Never the numbers themselves -- just that they changed.
      await logAudit({
        organizationId,
        userId,
        action: "child.idNumber.changed",
        entityType: "Child",
        entityId: child.id,
        metadata: { child: Boolean(body.childIdNumber), parent: Boolean(body.parentIdNumber) },
      });
    }

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
