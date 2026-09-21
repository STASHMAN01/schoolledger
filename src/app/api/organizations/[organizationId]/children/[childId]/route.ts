import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { childSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { cancelEntriesAfterExit } from "@/lib/billing/financialPlan";

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
      },
    });
    // Same "Not found" for a real mismatch and a TEACHER outside their own
    // class — never confirm a child exists in a class they can't see.
    if (!child || (role === "TEACHER" && child.categoryId !== assignedCategoryId)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    return NextResponse.json({ child });
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

    const body = childSchema.partial().parse(await req.json());

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
