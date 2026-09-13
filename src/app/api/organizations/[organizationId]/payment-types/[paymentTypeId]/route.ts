import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { paymentTypeSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";

type Params = {
  params: Promise<{ organizationId: string; paymentTypeId: string }>;
};

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { organizationId, paymentTypeId } = await params;
    const { userId } = await requireMembership(organizationId, ["ADMIN"]);

    const existing = await db.paymentType.findFirst({
      where: { id: paymentTypeId, organizationId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const body = paymentTypeSchema.partial().parse(await req.json());

    // At least one active recurring type must always exist — per spec,
    // monthly plan generation depends on it. Block the change that would
    // remove the last one rather than let the product silently stop being
    // able to bill.
    const wouldDeactivate = body.active === false || body.isRecurring === false;
    if (existing.isRecurring && existing.active && wouldDeactivate) {
      const otherActiveRecurring = await db.paymentType.count({
        where: {
          organizationId,
          isRecurring: true,
          active: true,
          id: { not: paymentTypeId },
        },
      });
      if (otherActiveRecurring === 0) {
        return NextResponse.json(
          {
            error:
              "At least one active recurring payment type must always exist.",
          },
          { status: 400 }
        );
      }
    }

    const paymentType = await db.paymentType.update({
      where: { id: paymentTypeId },
      data: {
        name: body.name ?? undefined,
        isRecurring: body.isRecurring ?? undefined,
        defaultAmountCents:
          body.defaultAmountCents === undefined ? undefined : body.defaultAmountCents,
        active: body.active ?? undefined,
      },
    });

    await logAudit({
      organizationId,
      userId,
      action: "paymentType.updated",
      entityType: "PaymentType",
      entityId: paymentType.id,
    });

    return NextResponse.json({ paymentType });
  } catch (err) {
    return handleApiError(err);
  }
}

// Soft-delete only — per spec, a PaymentType used in historical records
// should never be hard-deleted (it would corrupt existing statements).
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId, paymentTypeId } = await params;
    const { userId } = await requireMembership(organizationId, ["ADMIN"]);

    const existing = await db.paymentType.findFirst({
      where: { id: paymentTypeId, organizationId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    if (existing.isRecurring) {
      const otherActiveRecurring = await db.paymentType.count({
        where: {
          organizationId,
          isRecurring: true,
          active: true,
          id: { not: paymentTypeId },
        },
      });
      if (otherActiveRecurring === 0) {
        return NextResponse.json(
          {
            error:
              "At least one active recurring payment type must always exist.",
          },
          { status: 400 }
        );
      }
    }

    const paymentType = await db.paymentType.update({
      where: { id: paymentTypeId },
      data: { active: false },
    });

    await logAudit({
      organizationId,
      userId,
      action: "paymentType.deactivated",
      entityType: "PaymentType",
      entityId: paymentType.id,
    });

    return NextResponse.json({ paymentType });
  } catch (err) {
    return handleApiError(err);
  }
}
