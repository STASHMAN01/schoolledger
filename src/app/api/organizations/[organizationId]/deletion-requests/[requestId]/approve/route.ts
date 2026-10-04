import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { entityTypeFor, executeDeletion } from "@/lib/deletionExecute";

type Params = { params: Promise<{ organizationId: string; requestId: string }> };

// Only for deletion requests raised before 4 Oct 2026, when deleting
// needed approvals. Deleting is one step now (see the POST in
// ../../route.ts), so one admin approving a leftover request carries it
// out straight away -- a class or child goes to Trash, a payment is
// reversed.
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId, requestId } = await params;
    const { userId } = await requireMembership(organizationId, "APPROVE_DELETION");

    const request = await db.deletionRequest.findFirst({
      where: { id: requestId, organizationId },
    });
    if (!request) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const result = await db.$transaction(async (tx) => {
      // Claim the request first so two clicks can't both carry it out.
      const claimed = await tx.deletionRequest.updateMany({
        where: { id: requestId, status: "PENDING" },
        data: { status: "APPROVED", resolvedAt: new Date() },
      });
      if (claimed.count === 0) return null;
      await tx.deletionApproval.upsert({
        where: { deletionRequestId_userId: { deletionRequestId: requestId, userId } },
        create: { deletionRequestId: requestId, userId },
        update: {},
      });
      const paymentReversal = await executeDeletion(
        tx,
        organizationId,
        request.targetType,
        request.targetId
      );
      return { paymentReversal };
    });
    if (!result) {
      return NextResponse.json({ error: "This request has already been resolved." }, { status: 400 });
    }

    const entityType = entityTypeFor(request.targetType);
    await logAudit({
      organizationId,
      userId,
      action: `${entityType.toLowerCase()}.deleted`,
      entityType,
      entityId: request.targetId,
      metadata: {
        targetLabel: request.targetLabel,
        reason: request.reason,
        deletionRequestId: request.id,
        ...(result.paymentReversal ? { paymentReversal: result.paymentReversal } : {}),
      },
    });

    return NextResponse.json({ executed: true });
  } catch (err) {
    return handleApiError(err);
  }
}
