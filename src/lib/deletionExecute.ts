import type { Tx } from "@/lib/db";
import type { DeletionTargetType } from "@prisma/client";
import { statusForEntry } from "@/lib/billing/allocation";


export type PaymentReversal = {
  creditClawedBackCents: number;
  creditShortfallCents: number;
  allocatedTotalCents: number;
};

/**
 * Actually deletes one record, inside the caller's transaction. Since
 * 4 Oct 2026 (Dylan) deleting is one step for an admin -- no approvals --
 * so this runs straight from the Delete button:
 *  - a class or child is soft-deleted (deletedAt) into Trash, restorable
 *    for TRASH_RETENTION_DAYS, then purged (see purgeExpiredTrash);
 *  - a payment has no Trash: it's reversed now. Every charge it paid gets
 *    its paid amount rolled back, any credit it created is clawed back
 *    (never below zero), and the payment row is deleted.
 */
export async function executeDeletion(
  tx: Tx,
  organizationId: string,
  targetType: DeletionTargetType,
  targetId: string
): Promise<PaymentReversal | null> {
  if (targetType === "CATEGORY") {
    await tx.category.updateMany({
      where: { id: targetId, organizationId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return null;
  }
  if (targetType === "CHILD") {
    await tx.child.updateMany({
      where: { id: targetId, organizationId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return null;
  }

  const payment = await tx.payment.findFirst({
    where: { id: targetId, organizationId },
    include: { allocations: true },
  });
  // Already gone: nothing left to reverse.
  if (!payment) return null;

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

  const allocatedTotalCents = payment.allocations.reduce((sum, a) => sum + a.amountCents, 0);
  const creditFromThisPaymentCents = payment.amountCents - allocatedTotalCents;

  let creditClawedBackCents = 0;
  let creditShortfallCents = 0;
  if (creditFromThisPaymentCents > 0) {
    const credit = await tx.creditBalance.findUnique({ where: { childId: payment.childId } });
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
  return { creditClawedBackCents, creditShortfallCents, allocatedTotalCents };
}

export function entityTypeFor(targetType: DeletionTargetType): "Category" | "Child" | "Payment" {
  return targetType === "CATEGORY" ? "Category" : targetType === "CHILD" ? "Child" : "Payment";
}
