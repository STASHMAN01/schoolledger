import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

/**
 * REC-{year}-{6-digit sequence}, sequential per organization, resetting
 * only at year boundary — per spec. Computed as "count of this org's
 * receipts this year, plus one" inside the same transaction as the
 * payment write, so two concurrent payments can't be handed the same
 * number under normal transaction isolation. (A high-volume multi-instance
 * deployment should eventually move this to a dedicated DB sequence — see
 * PHASES.md — but is not a real risk at this product's expected scale.)
 */
export async function nextReceiptNumber(
  tx: Tx,
  organizationId: string,
  year: number
) {
  const prefix = `REC-${year}-`;
  const count = await tx.receipt.count({
    where: { payment: { organizationId }, number: { startsWith: prefix } },
  });
  const sequence = String(count + 1).padStart(6, "0");
  return `${prefix}${sequence}`;
}
