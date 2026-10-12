import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

/**
 * REC-{year}-{6-digit sequence}, sequential per organization, resetting
 * only at year boundary — per spec. Computed inside the same transaction as
 * the payment write as "this school's highest number this year, plus one".
 * Highest-plus-one (rather than a count) so deleting a payment, and its
 * receipt with it, can never make the next number collide with a later one
 * that still exists. Two schools can and do share the same number; the
 * database only requires it to be unique within one school.
 * (A high-volume multi-instance deployment should eventually move this to a
 * dedicated DB sequence — see PHASES.md — but is not a real risk at this
 * product's expected scale.)
 */
export async function nextReceiptNumber(
  tx: Tx,
  organizationId: string,
  year: number
) {
  const prefix = `REC-${year}-`;
  const latest = await tx.receipt.findFirst({
    where: { payment: { organizationId }, number: { startsWith: prefix } },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const lastSequence = latest ? Number(latest.number.slice(prefix.length)) : 0;
  const sequence = String((Number.isFinite(lastSequence) ? lastSequence : 0) + 1).padStart(6, "0");
  return `${prefix}${sequence}`;
}
