import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { canHandleReminderSend, REQUIRED_REMINDER_SEND_APPROVALS } from "@/lib/reminderSend";
import {
  buildReminderEmailHtml,
  buildReminderMessage,
  getOutstandingReminders,
} from "@/lib/billing/reminders";
import { sendMail } from "@/lib/mail";

type Params = { params: Promise<{ organizationId: string; requestId: string }> };

// Records one ADMIN/ACCOUNTANT's approval, and — once
// REQUIRED_REMINDER_SEND_APPROVALS distinct such people have each done
// this — actually emails every parent who currently owes money. Mirrors
// the DeletionRequest approve route's shape (record → recount inside a
// transaction → execute once threshold hit → audit), except the "execute"
// step here is a batch of outbound emails rather than a DB mutation, so it
// deliberately happens AFTER the transaction commits the APPROVED status
// (an email send should never be rolled back by a later DB error, and a
// half-sent batch is recoverable — see the per-email error handling below
// — in a way a half-committed transaction wouldn't be).
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId, requestId } = await params;
    const { userId, role } = await requireMembership(organizationId);
    if (!canHandleReminderSend(role)) {
      return NextResponse.json({ error: "Not allowed for your role." }, { status: 403 });
    }

    const request = await db.reminderSendRequest.findFirst({
      where: { id: requestId, organizationId },
      include: { approvals: true },
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
    if (request.approvals.some((a) => a.userId === userId)) {
      return NextResponse.json({ error: "You already approved this." }, { status: 400 });
    }

    const result = await db.$transaction(async (tx) => {
      await tx.reminderSendApproval.create({
        data: { reminderSendRequestId: requestId, userId },
      });

      // Recount inside the transaction, same reasoning as the deletion
      // approve route: two approvers acting within moments of each other
      // must never both see "not yet at 2" and leave this stuck pending.
      const approvalCount = await tx.reminderSendApproval.count({
        where: { reminderSendRequestId: requestId },
      });
      const current = await tx.reminderSendRequest.findUnique({
        where: { id: requestId },
        select: { status: true },
      });
      if (approvalCount < REQUIRED_REMINDER_SEND_APPROVALS || current?.status !== "PENDING") {
        return { executed: false, approvalCount };
      }

      await tx.reminderSendRequest.update({
        where: { id: requestId },
        data: { status: "APPROVED", resolvedAt: new Date() },
      });

      return { executed: true, approvalCount };
    });

    if (!result.executed) {
      await logAudit({
        organizationId,
        userId,
        action: "reminders.sendAllApproved",
        entityType: "Reminder",
        metadata: { approvalCount: result.approvalCount, reminderSendRequestId: request.id },
      });
      return NextResponse.json({
        executed: false,
        approvalCount: result.approvalCount,
        requiredApprovals: REQUIRED_REMINDER_SEND_APPROVALS,
      });
    }

    // 2nd (or later) distinct approval — actually send. Re-fetch the
    // outstanding list live rather than trusting reminderCountAtRequest,
    // which could be stale by now (a payment recorded in the meantime
    // should not still get emailed a reminder).
    const organization = await db.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, currencyCode: true },
    });
    const outstanding = organization ? await getOutstandingReminders(organizationId) : [];

    let sentCount = 0;
    let skippedNoEmailCount = 0;
    let failedCount = 0;
    const sentChildIds: string[] = [];

    for (const r of outstanding) {
      if (!r.parentEmail) {
        skippedNoEmailCount++;
        continue;
      }
      const messageInput = {
        schoolName: organization!.name,
        parentName: r.parentName,
        childName: r.childName,
        outstandingCents: r.outstandingCents,
        currencyCode: organization!.currencyCode,
      };
      try {
        const sendResult = await sendMail({
          to: r.parentEmail,
          subject: `Payment reminder from ${organization!.name}`,
          html: buildReminderEmailHtml(messageInput),
          text: buildReminderMessage(messageInput),
        });
        if (sendResult.sent) {
          sentCount++;
          sentChildIds.push(r.childId);
        } else {
          // SMTP not configured yet — not a failure, just not live. See
          // TINYLEDGER-TODO-FOR-DYLAN.md item 1.
          skippedNoEmailCount++;
        }
      } catch (err) {
        console.error("Failed to send reminder email", r.childId, err);
        failedCount++;
      }
    }

    if (sentChildIds.length > 0) {
      await db.child.updateMany({
        where: { id: { in: sentChildIds } },
        data: { lastReminderSentAt: new Date() },
      });
    }

    await logAudit({
      organizationId,
      userId,
      action: "reminders.sendAllExecuted",
      entityType: "Reminder",
      metadata: {
        approvalCount: result.approvalCount,
        reminderSendRequestId: request.id,
        sentCount,
        skippedNoEmailCount,
        failedCount,
      },
    });

    return NextResponse.json({
      executed: true,
      approvalCount: result.approvalCount,
      requiredApprovals: REQUIRED_REMINDER_SEND_APPROVALS,
      sentCount,
      skippedNoEmailCount,
      failedCount,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
