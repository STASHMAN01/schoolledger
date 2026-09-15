import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { canHandleReminderSend, REQUIRED_REMINDER_SEND_APPROVALS } from "@/lib/reminderSend";
import { getOutstandingReminders } from "@/lib/billing/reminders";

type Params = { params: Promise<{ organizationId: string }> };

// At most one PENDING ReminderSendRequest per org at a time — same "one
// request in flight" shape as deletion requests, just scoped to the whole
// org rather than a single record.
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { userId } = await requireMembership(organizationId); // any role may view

    const request = await db.reminderSendRequest.findFirst({
      where: { organizationId, status: "PENDING" },
      include: { approvals: true },
      orderBy: { createdAt: "desc" },
    });
    if (!request) {
      return NextResponse.json({ request: null });
    }

    return NextResponse.json({
      request: {
        id: request.id,
        reminderCountAtRequest: request.reminderCountAtRequest,
        approvalsCount: request.approvals.length,
        approvedByMe: request.approvals.some((a) => a.userId === userId),
        requestedByMe: request.requestedByUserId === userId,
        createdAt: request.createdAt,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

// Step 1 of "Send all reminders": records the request. Nothing is emailed
// yet — that only happens once REQUIRED_REMINDER_SEND_APPROVALS distinct
// ADMIN/ACCOUNTANT people (never a MANAGER or VIEWER) have approved it, see
// the approve route.
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { userId, role } = await requireMembership(organizationId);
    if (!canHandleReminderSend(role)) {
      return NextResponse.json({ error: "Not allowed for your role." }, { status: 403 });
    }

    const existing = await db.reminderSendRequest.findFirst({
      where: { organizationId, status: "PENDING" },
    });
    if (existing) {
      return NextResponse.json(
        { error: "A send-all request is already pending approval." },
        { status: 400 }
      );
    }

    const outstanding = await getOutstandingReminders(organizationId);
    if (outstanding.length === 0) {
      return NextResponse.json(
        { error: "Nothing outstanding to remind anyone about right now." },
        { status: 400 }
      );
    }

    const request = await db.reminderSendRequest.create({
      data: {
        organizationId,
        requestedByUserId: userId,
        reminderCountAtRequest: outstanding.length,
      },
    });

    await logAudit({
      organizationId,
      userId,
      action: "reminders.sendAllRequested",
      entityType: "Reminder",
      metadata: { reminderCountAtRequest: outstanding.length, reminderSendRequestId: request.id },
    });

    return NextResponse.json({
      request: {
        id: request.id,
        reminderCountAtRequest: request.reminderCountAtRequest,
        approvalsCount: 0,
        approvedByMe: false,
        requestedByMe: true,
        createdAt: request.createdAt,
      },
      requiredApprovals: REQUIRED_REMINDER_SEND_APPROVALS,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
