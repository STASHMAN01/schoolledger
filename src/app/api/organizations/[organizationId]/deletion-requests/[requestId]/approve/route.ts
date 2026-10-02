import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { requiredApprovalsForOrg } from "@/lib/deletionApprovers";
import { statusForEntry } from "@/lib/billing/allocation";

type Params = { params: Promise<{ organizationId: string; requestId: string }> };

// Records one admin's approval, and — once enough distinct admins have
// each done this — actually performs the soft-delete in the same
// transaction. "Enough" is normally two, but drops to one in a school
// that only has one person who can approve (see requiredApprovalsFor in
// src/lib/deletion.ts), because otherwise a one-owner crèche can never
// delete anything at all. This is the only place in the codebase that
// ever sets Category.deletedAt / Child.deletedAt.
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId, requestId } = await params;
    const { userId } = await requireMembership(organizationId, "APPROVE_DELETION");

    const request = await db.deletionRequest.findFirst({
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
      await tx.deletionApproval.create({
        data: { deletionRequestId: requestId, userId },
      });

      // Recount inside the transaction rather than trusting the count
      // fetched before it started — two admins approving within moments of
      // each other must never both see themselves as "not yet at 2" and
      // leave the request stuck pending forever.
      const approvalCount = await tx.deletionApproval.count({
        where: { deletionRequestId: requestId },
      });
      // Re-check status too: a concurrent approval that already executed
      // the deletion (and this one arrived a beat later) should record the
      // extra approval but not try to execute/resolve a second time.
      const current = await tx.deletionRequest.findUnique({
        where: { id: requestId },
        select: { status: true },
      });
      // Read inside the transaction too: if an admin is removed from the
      // school while a request is pending, the requirement should reflect
      // who can actually approve now, not who could when it was raised.
      const required = await requiredApprovalsForOrg(tx, organizationId);
      if (approvalCount < required || current?.status !== "PENDING") {
        return { executed: false, approvalCount, required };
      }

      // Enough distinct approvals — execute the deletion.
      let paymentReversal: {
        creditClawedBackCents: number;
        creditShortfallCents: number;
        allocatedTotalCents: number;
      } | null = null;

      if (request.targetType === "CATEGORY") {
        await tx.category.updateMany({
          where: { id: request.targetId, organizationId, deletedAt: null },
          data: { deletedAt: new Date() },
        });
      } else if (request.targetType === "CHILD") {
        await tx.child.updateMany({
          where: { id: request.targetId, organizationId, deletedAt: null },
          data: { deletedAt: new Date() },
        });
      } else {
        // PAYMENT — there's no soft-delete/trash for payments (unlike
        // categories/children): this is a true reversal, same as the old
        // ADMIN-only "void" action used to do directly, just now gated
        // behind the same 2-admin-approval + mandatory-reason flow as
        // everything else. Every FinancialPlanEntry this payment was
        // allocated against gets its amountPaidCents rolled back and
        // status recomputed, any leftover CreditBalance is clawed back
        // (never below zero), and only then is the Payment row deleted.
        const payment = await tx.payment.findUnique({
          where: { id: request.targetId },
          include: { allocations: true },
        });
        if (payment) {
          for (const alloc of payment.allocations) {
            const entry = await tx.financialPlanEntry.findUnique({
              where: { id: alloc.financialPlanEntryId },
            });
            if (!entry) continue;
            const newPaid = Math.max(0, entry.amountPaidCents - alloc.amountCents);
            await tx.financialPlanEntry.update({
              where: { id: entry.id },
              data: {
                amountPaidCents: newPaid,
                status: statusForEntry(entry.amountDueCents, newPaid),
              },
            });
          }

          const allocatedTotalCents = payment.allocations.reduce(
            (sum, a) => sum + a.amountCents,
            0
          );
          const creditFromThisPaymentCents = payment.amountCents - allocatedTotalCents;

          let creditClawedBackCents = 0;
          let creditShortfallCents = 0;
          if (creditFromThisPaymentCents > 0) {
            const credit = await tx.creditBalance.findUnique({
              where: { childId: payment.childId },
            });
            const available = credit?.amountCents ?? 0;
            creditClawedBackCents = Math.min(available, creditFromThisPaymentCents);
            creditShortfallCents = creditFromThisPaymentCents - creditClawedBackCents;
            if (credit && creditClawedBackCents > 0) {
              await tx.creditBalance.update({
                where: { childId: payment.childId },
                data: { amountCents: { decrement: creditClawedBackCents } },
              });
            }
          }

          await tx.payment.delete({ where: { id: payment.id } });
          paymentReversal = { creditClawedBackCents, creditShortfallCents, allocatedTotalCents };
        }
        // If the payment is already gone (e.g. somehow removed another
        // way), there's nothing left to reverse — fall through and still
        // resolve the request rather than leaving it stuck pending.
      }

      await tx.deletionRequest.update({
        where: { id: requestId },
        data: { status: "APPROVED", resolvedAt: new Date() },
      });

      return { executed: true, approvalCount, required, paymentReversal };
    });

    const entityType =
      request.targetType === "CATEGORY" ? "Category" : request.targetType === "CHILD" ? "Child" : "Payment";
    await logAudit({
      organizationId,
      userId,
      action: `${entityType.toLowerCase()}.${result.executed ? "deleted" : "deletionApproved"}`,
      entityType,
      entityId: request.targetId,
      metadata: {
        targetLabel: request.targetLabel,
        reason: request.reason,
        approvalCount: result.approvalCount,
        deletionRequestId: request.id,
        ...(result.executed && "paymentReversal" in result && result.paymentReversal
          ? { paymentReversal: result.paymentReversal }
          : {}),
      },
    });

    return NextResponse.json({
      executed: result.executed,
      approvalCount: result.approvalCount,
      requiredApprovals: result.required,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
