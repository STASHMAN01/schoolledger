import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { statusForEntry } from "@/lib/billing/allocation";

type Params = { params: Promise<{ organizationId: string; paymentId: string }> };

// Voiding reverses a data-entry mistake: wrong amount, wrong child, wrong
// method. Deliberately ADMIN-only — narrower than who can *record* a
// payment (ADMIN/ACCOUNTANT) — because unwinding money movement is a
// bigger deal than moving it in the first place, and it's the kind of
// action a school would want restricted to one trusted person.
//
// There's no schema field for "voided" (that would need a migration this
// session can't safely apply against the live database), so this is a
// true reversal: every FinancialPlanEntry the payment was allocated
// against gets its amountPaidCents rolled back and status recomputed, any
// leftover that became CreditBalance is clawed back (never below zero —
// if the parent has already spent that credit elsewhere, we can't create
// a negative balance, so the audit entry records the shortfall instead of
// silently losing money), and only then is the Payment row itself
// deleted (cascading its allocations and receipt). The full picture of
// what was reversed is captured in the audit log entry BEFORE the row is
// gone, so "what did payment X look like before it was voided" is still
// answerable from Settings → Activity log even though the row itself is
// no longer queryable.
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId, paymentId } = await params;
    const { userId } = await requireMembership(organizationId, ["ADMIN"]);

    const payment = await db.payment.findFirst({
      where: { id: paymentId, organizationId },
      include: { allocations: true, receipt: true },
    });
    if (!payment) {
      return NextResponse.json({ error: "Payment not found." }, { status: 404 });
    }

    const result = await db.$transaction(async (tx) => {
      for (const alloc of payment.allocations) {
        const entry = await tx.financialPlanEntry.findUnique({
          where: { id: alloc.financialPlanEntryId },
        });
        if (!entry) continue; // shouldn't happen, but never let a void 500
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

      return { creditClawedBackCents, creditShortfallCents, allocatedTotalCents };
    });

    await logAudit({
      organizationId,
      userId,
      action: "payment.voided",
      entityType: "Payment",
      entityId: payment.id,
      metadata: {
        childId: payment.childId,
        amountCents: payment.amountCents,
        method: payment.method,
        date: payment.date.toISOString(),
        receiptNumber: payment.receipt?.number ?? null,
        reversedEntryCount: payment.allocations.length,
        creditClawedBackCents: result.creditClawedBackCents,
        // Non-zero only if the parent already spent credit this payment
        // created before it was voided — surfaced so an admin can see it
        // and follow up manually rather than it vanishing silently.
        creditShortfallCents: result.creditShortfallCents,
      },
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return handleApiError(err);
  }
}
