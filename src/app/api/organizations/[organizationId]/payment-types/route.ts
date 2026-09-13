import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { paymentTypeSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";

type Params = { params: Promise<{ organizationId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    await requireMembership(organizationId);

    const paymentTypes = await db.paymentType.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ paymentTypes });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { userId } = await requireMembership(organizationId, ["ADMIN"]);

    const body = paymentTypeSchema.parse(await req.json());

    const paymentType = await db.paymentType.create({
      data: {
        organizationId,
        name: body.name,
        isRecurring: body.isRecurring,
        defaultAmountCents: body.defaultAmountCents ?? null,
      },
    });

    await logAudit({
      organizationId,
      userId,
      action: "paymentType.created",
      entityType: "PaymentType",
      entityId: paymentType.id,
      metadata: { name: paymentType.name },
    });

    return NextResponse.json({ paymentType }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
