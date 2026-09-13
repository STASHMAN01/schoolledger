import type { FinancialPlanEntry } from "@prisma/client";

export type AllocationLine = { entryId: string; amountCents: number };

/**
 * The core money rule of the whole product, kept in ONE place so it's
 * testable and never re-implemented slightly differently in two routes:
 * given a pool of money and a set of outstanding entries (already sorted
 * oldest-first by the caller), pay off entries oldest-first until the pool
 * runs out. If an entry isn't fully covered, it takes a partial allocation
 * and the pool ends there. Anything left over after every entry is fully
 * paid is returned as `remainingCents` — the caller decides what to do
 * with it (become a CreditBalance for a payment, or stop for a credit
 * sweep).
 *
 * This function does NOT touch the database — it's pure so the allocation
 * logic can be unit tested without a real Postgres connection, and so it
 * can be reused both for "apply a new payment" and "apply existing credit
 * to newly-created entries" without duplicating the loop.
 */
export function allocateOldestFirst(
  entries: Pick<FinancialPlanEntry, "id" | "amountDueCents" | "amountPaidCents">[],
  amountCents: number
): { lines: AllocationLine[]; remainingCents: number } {
  let remaining = amountCents;
  const lines: AllocationLine[] = [];

  for (const entry of entries) {
    if (remaining <= 0) break;
    const due = entry.amountDueCents - entry.amountPaidCents;
    if (due <= 0) continue;
    const amount = Math.min(due, remaining);
    lines.push({ entryId: entry.id, amountCents: amount });
    remaining -= amount;
  }

  return { lines, remainingCents: remaining };
}

export function statusForEntry(amountDueCents: number, amountPaidCents: number) {
  if (amountPaidCents <= 0) return "OUTSTANDING" as const;
  if (amountPaidCents >= amountDueCents) return "PAID" as const;
  return "PARTIALLY_PAID" as const;
}
