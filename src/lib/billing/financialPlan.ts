import type { Prisma, Child, Category } from "@prisma/client";
import { allocateOldestFirst, statusForEntry } from "./allocation";
import { logAudit } from "@/lib/audit";

type Tx = Prisma.TransactionClient;

/**
 * Which PaymentType recurring monthly fee rows (School Fees, Aftercare,
 * etc.) get attached to. MVP rule: the organization's oldest active
 * recurring PaymentType — in practice "School Fees", since it's the first
 * one seeded on registration. Revisit once categories need to map to a
 * *specific* recurring PaymentType (e.g. an Aftercare category billing
 * under the Aftercare type instead) — flagged in PHASES.md.
 */
export async function getPrimaryRecurringPaymentType(tx: Tx, organizationId: string) {
  const type = await tx.paymentType.findFirst({
    where: { organizationId, isRecurring: true, active: true },
    orderBy: { createdAt: "asc" },
  });
  if (!type) {
    throw new Error(
      "No active recurring payment type exists for this organization — at least one (e.g. School Fees) must always exist."
    );
  }
  return type;
}

async function getRegistrationPaymentType(tx: Tx, organizationId: string) {
  return tx.paymentType.findFirst({
    where: {
      organizationId,
      isRecurring: false,
      active: true,
      name: { equals: "Registration", mode: "insensitive" },
    },
  });
}

export function monthlyFeeForChild(child: Pick<Child, "feeOverrideCents">, category: Pick<Category, "monthlyFeeCents">) {
  return child.feeOverrideCents ?? category.monthlyFeeCents ?? 0;
}

/**
 * Sweeps any existing CreditBalance for a child across their currently
 * outstanding entries, oldest first. Called whenever new entries are
 * created (enrollment, a new year's plan) so a credit "becomes applied"
 * the moment a new due entry exists to apply it to — per the original
 * spec's credit-balance rule. Not tied to a Payment record (nothing new
 * was paid), just an internal reallocation, so it's logged via AuditLog
 * instead of a Payment/Receipt.
 */
export async function sweepCreditIntoOutstanding(
  tx: Tx,
  organizationId: string,
  childId: string,
  userId?: string | null
) {
  const credit = await tx.creditBalance.findUnique({ where: { childId } });
  if (!credit || credit.amountCents <= 0) return;

  const outstanding = await tx.financialPlanEntry.findMany({
    where: { organizationId, childId, status: { in: ["OUTSTANDING", "PARTIALLY_PAID"] } },
    orderBy: [{ year: "asc" }, { month: "asc" }],
  });
  if (outstanding.length === 0) return;

  const { lines, remainingCents } = allocateOldestFirst(outstanding, credit.amountCents);
  if (lines.length === 0) return;

  for (const line of lines) {
    const entry = outstanding.find((e) => e.id === line.entryId)!;
    const newPaid = entry.amountPaidCents + line.amountCents;
    await tx.financialPlanEntry.update({
      where: { id: entry.id },
      data: {
        amountPaidCents: newPaid,
        status: statusForEntry(entry.amountDueCents, newPaid),
      },
    });
  }

  await tx.creditBalance.update({
    where: { childId },
    data: { amountCents: remainingCents },
  });

  await logAudit({
    organizationId,
    userId,
    action: "credit.applied",
    entityType: "Child",
    entityId: childId,
    metadata: { appliedCents: credit.amountCents - remainingCents },
  });
}

/**
 * Generates a child's FinancialPlanEntry rows for `year`, from the later of
 * (enrollment month, January) through the earlier of (exit month, December)
 * — the child owes nothing for months before they joined or after they
 * left, per the original spec. Also creates the mandatory one-time
 * Registration charge exactly once, regardless of enrollment month.
 * Safe to call more than once for the same child/year: existing entries
 * for a given (child, year, month, paymentType) are never duplicated.
 */
export async function generateAnnualPlanForChild(
  tx: Tx,
  organizationId: string,
  child: Child,
  category: Category,
  year: number,
  userId?: string | null,
  // false when filling in months after an edit (Edit details, 25 Sept):
  // editing must never add a Registration charge that wasn't there.
  includeRegistration = true
) {
  const recurringType = await getPrimaryRecurringPaymentType(tx, organizationId);
  const monthlyFee = monthlyFeeForChild(child, category);

  const enrollmentYear = child.enrollmentDate.getUTCFullYear();
  const enrollmentMonth = child.enrollmentDate.getUTCMonth() + 1;
  const exitYear = child.exitDate?.getUTCFullYear();
  const exitMonth = child.exitDate ? child.exitDate.getUTCMonth() + 1 : undefined;

  const startMonth = year === enrollmentYear ? enrollmentMonth : year > enrollmentYear ? 1 : 13; // 13 = none this year
  const endMonth = exitYear === year ? exitMonth! : exitYear !== undefined && exitYear < year ? 0 : 12;

  const existing = await tx.financialPlanEntry.findMany({
    where: { organizationId, childId: child.id, year, paymentTypeId: recurringType.id },
    select: { month: true },
  });
  const existingMonths = new Set(existing.map((e) => e.month));

  for (let month = startMonth; month <= endMonth; month++) {
    if (existingMonths.has(month)) continue;
    await tx.financialPlanEntry.create({
      data: {
        organizationId,
        childId: child.id,
        paymentTypeId: recurringType.id,
        year,
        month,
        description: `${recurringType.name} — ${year}-${String(month).padStart(2, "0")}`,
        amountDueCents: monthlyFee,
      },
    });
  }

  const registrationType = includeRegistration ? await getRegistrationPaymentType(tx, organizationId) : null;
  if (registrationType) {
    const alreadyCharged = await tx.financialPlanEntry.findFirst({
      where: { organizationId, childId: child.id, paymentTypeId: registrationType.id },
    });
    if (!alreadyCharged) {
      await tx.financialPlanEntry.create({
        data: {
          organizationId,
          childId: child.id,
          paymentTypeId: registrationType.id,
          year: enrollmentYear,
          month: null,
          description: "Registration",
          amountDueCents: registrationType.defaultAmountCents ?? 0,
        },
      });
    }
  }

  await sweepCreditIntoOutstanding(tx, organizationId, child.id, userId);
}

/**
 * Called when a child's exit date changes. Cancels any FUTURE months'
 * entries (after the exit month) that are not already paid/partially
 * paid — historical entries before/at exit are left untouched, per spec
 * section 5 ("the child owes nothing for months after leaving").
 */
export async function cancelEntriesAfterExit(
  tx: Tx,
  organizationId: string,
  childId: string,
  exitDate: Date,
  userId?: string | null
) {
  const exitYear = exitDate.getUTCFullYear();
  const exitMonth = exitDate.getUTCMonth() + 1;

  const toCancel = await tx.financialPlanEntry.findMany({
    where: {
      organizationId,
      childId,
      month: { not: null },
      status: { in: ["OUTSTANDING", "UPCOMING"] },
      OR: [{ year: { gt: exitYear } }, { year: exitYear, month: { gt: exitMonth } }],
    },
  });

  for (const entry of toCancel) {
    await tx.financialPlanEntry.update({
      where: { id: entry.id },
      data: { status: "CANCELLED" },
    });
  }

  if (toCancel.length > 0) {
    await logAudit({
      organizationId,
      userId,
      action: "financialPlan.cancelledAfterExit",
      entityType: "Child",
      entityId: childId,
      metadata: { cancelledEntryCount: toCancel.length },
    });
  }
}
