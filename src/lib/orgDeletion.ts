import { db } from "@/lib/db";
import { isOwnerEmail } from "@/lib/platformAdmin";

/** How long a deleted school stays restorable before it's permanently removed. */
export const ORG_TRASH_DAYS = 30;

export function purgeDateFor(deletedAt: Date): Date {
  return new Date(deletedAt.getTime() + ORG_TRASH_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Permanently removes every school whose 30 days in the trash are up,
 * plus the logins that belonged only to those schools. Run once a day by
 * /api/cron/purge-deleted-schools. Each school is removed in its own
 * transaction so one failure can't block the rest.
 *
 * Most school-owned rows cascade from the organization row, but several
 * links are RESTRICT on purpose (payments and plan entries, so money
 * records can't vanish by accident; child -> class; event -> class), so
 * those are cleared explicitly first, in dependency order -- this is the
 * one place that's meant to remove them.
 */
export async function purgeExpiredOrganizations(now = new Date()) {
  const cutoff = new Date(now.getTime() - ORG_TRASH_DAYS * 24 * 60 * 60 * 1000);
  const expired = await db.organization.findMany({
    where: { deletedAt: { not: null, lte: cutoff } },
    select: { id: true, name: true, memberships: { select: { userId: true } } },
  });

  const purged: string[] = [];
  const failed: { id: string; error: string }[] = [];

  for (const org of expired) {
    try {
      await db.$transaction(async (tx) => {
        // Order matters: Postgres RESTRICT foreign keys fire immediately,
        // even when the referencing row would have been cascaded away too
        // (found 28 Sept: event_categories blocked deleting categories).
        const where = { organizationId: org.id };
        await tx.paymentAllocation.deleteMany({ where: { payment: where } });
        await tx.payment.deleteMany({ where });
        await tx.creditBalance.deleteMany({ where });
        await tx.financialPlanEntry.deleteMany({ where });
        await tx.eventCategory.deleteMany({ where: { event: where } });
        await tx.event.deleteMany({ where });
        await tx.child.deleteMany({ where });
        await tx.category.deleteMany({ where });
        await tx.organization.delete({ where: { id: org.id } });

        // Logins left with no school at all go too -- except platform admins.
        const userIds = org.memberships.map((m) => m.userId);
        const orphans = await tx.user.findMany({
          where: { id: { in: userIds }, memberships: { none: {} }, isPlatformAdmin: false },
          select: { id: true, email: true },
        });
        const orphanIds = orphans.filter((u) => !isOwnerEmail(u.email)).map((u) => u.id);
        if (orphanIds.length > 0) {
          await tx.passwordResetToken.deleteMany({ where: { userId: { in: orphanIds } } });
          await tx.emailVerificationToken.deleteMany({ where: { userId: { in: orphanIds } } });
          await tx.user.deleteMany({ where: { id: { in: orphanIds } } });
        }
      });
      purged.push(org.id);
    } catch (err) {
      console.error(`[purge] Failed to purge organization ${org.id}`, err);
      failed.push({ id: org.id, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return { purged, failed };
}
