import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
// (isHighPositionRole retired — see src/lib/permissions.ts APPROVE_DELETION)

type Params = { params: Promise<{ organizationId: string; requestId: string }> };

// Withdraw a pending deletion request — either the person who asked for it
// (they changed their mind) or any admin (they disagree with the request)
// can do this. Nothing is deleted either way; the request just stops being
// actionable.
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId, requestId } = await params;
    const { userId, permissions } = await requireMembership(organizationId);

    const request = await db.deletionRequest.findFirst({
      where: { id: requestId, organizationId },
    });
    if (!request) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    if (request.status !== "PENDING") {
      return NextResponse.json(
        { error: "This request has already been resolved." },
        { status: 400 }
      );
    }
    if (!permissions.includes("APPROVE_DELETION") && request.requestedByUserId !== userId) {
      return NextResponse.json({ error: "Not allowed for your role." }, { status: 403 });
    }

    await db.deletionRequest.update({
      where: { id: requestId },
      data: { status: "CANCELLED", resolvedAt: new Date() },
    });

    const entityType =
      request.targetType === "CATEGORY"
        ? "Category"
        : request.targetType === "CHILD"
          ? "Child"
          : "Payment";
    await logAudit({
      organizationId,
      userId,
      action: `${entityType.toLowerCase()}.deletionCancelled`,
      entityType,
      entityId: request.targetId,
      metadata: { targetLabel: request.targetLabel },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
