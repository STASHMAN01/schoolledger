import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
// (canHandleReminderSend retired — see src/lib/permissions.ts VIEW_MONEY)

type Params = { params: Promise<{ organizationId: string; requestId: string }> };

// Cancel a pending "send all" request — whoever requested it, or anyone
// who could have approved it, can back out before it executes. Same
// permission shape as cancelling a DeletionRequest.
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId, requestId } = await params;
    const { userId, permissions } = await requireMembership(organizationId);

    const request = await db.reminderSendRequest.findFirst({
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
    if (request.requestedByUserId !== userId && !permissions.includes("VIEW_MONEY")) {
      return NextResponse.json({ error: "Not allowed for your role." }, { status: 403 });
    }

    await db.reminderSendRequest.update({
      where: { id: requestId },
      data: { status: "CANCELLED", resolvedAt: new Date() },
    });

    await logAudit({
      organizationId,
      userId,
      action: "reminders.sendAllCancelled",
      entityType: "Reminder",
      metadata: { reminderSendRequestId: request.id },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
