import { db } from "@/lib/db";
import { trashPurgeCutoff } from "@/lib/deletion";

/**
 * Permanently removes classes and children that have been in Trash longer
 * than TRASH_RETENTION_DAYS. Runs from the daily cron (all schools) and
 * whenever someone opens Trash (one school).
 *
 * A record the database refuses to delete because something still points
 * at it -- a class with children, or a child with charges, payments or
 * credit (Restrict on FinancialPlanEntry/CreditBalance/Payment -> Child,
 * final inspection R7) -- simply stays soft-deleted and hidden, so billing
 * history is never lost.
 */
export async function purgeExpiredTrash(organizationId?: string) {
  const cutoff = trashPurgeCutoff();
  const scope = organizationId ? { organizationId } : {};
  let purged = 0;

  // Children first, so a class emptied by this run can go in the same run.
  const expiredChildren = await db.child.findMany({
    where: { ...scope, deletedAt: { lt: cutoff } },
    select: { id: true },
  });
  for (const { id } of expiredChildren) {
    try {
      await db.child.delete({ where: { id } });
      purged++;
    } catch {
      // Still referenced by billing history: stays hidden instead.
    }
  }

  const expiredCategories = await db.category.findMany({
    where: { ...scope, deletedAt: { lt: cutoff } },
    select: { id: true },
  });
  for (const { id } of expiredCategories) {
    try {
      await db.category.delete({ where: { id } });
      purged++;
    } catch {
      // Still referenced: stays hidden instead.
    }
  }

  return purged;
}
