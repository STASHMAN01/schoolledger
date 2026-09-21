import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { handleApiError } from "@/lib/apiError";
import { trashPurgeCutoff, TRASH_RETENTION_DAYS } from "@/lib/deletion";

type Params = { params: Promise<{ organizationId: string }> };

// Every read of the trash list first tries to purge anything past its
// 30-day retention window — there's no cron job in this deployment, so
// "whoever next opens the trash page" is what drives cleanup instead.
// A category/child is only ever actually removed from the database if
// nothing else still references it (a category with children left on it,
// or a child with recorded payments, can't be hard-deleted without either
// orphaning records or destroying financial history) — if the delete is
// rejected by the database for that reason, the row is simply left
// soft-deleted (still hidden everywhere, just not physically purged) and
// tried again on the next visit.
async function purgeExpired(organizationId: string) {
  const cutoff = trashPurgeCutoff();

  const expiredCategories = await db.category.findMany({
    where: { organizationId, deletedAt: { lt: cutoff } },
    select: { id: true },
  });
  for (const { id } of expiredCategories) {
    try {
      await db.category.delete({ where: { id } });
    } catch {
      // Still referenced (e.g. a child was somehow re-linked to it) —
      // leave it soft-deleted, it stays hidden either way.
    }
  }

  const expiredChildren = await db.child.findMany({
    where: { organizationId, deletedAt: { lt: cutoff } },
    select: { id: true },
  });
  for (const { id } of expiredChildren) {
    try {
      await db.child.delete({ where: { id } });
    } catch {
      // Has payments/plan entries — deleting would either fail outright or
      // destroy financial history, so it stays soft-deleted permanently.
    }
  }
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    await requireMembership(organizationId, "APPROVE_DELETION");

    await purgeExpired(organizationId);

    const [categories, children] = await Promise.all([
      db.category.findMany({
        where: { organizationId, deletedAt: { not: null } },
        orderBy: { deletedAt: "desc" },
      }),
      db.child.findMany({
        where: { organizationId, deletedAt: { not: null } },
        orderBy: { deletedAt: "desc" },
      }),
    ]);

    const now = Date.now();
    function daysRemaining(deletedAt: Date) {
      const purgeAt = deletedAt.getTime() + TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
      return Math.max(0, Math.ceil((purgeAt - now) / (24 * 60 * 60 * 1000)));
    }

    return NextResponse.json({
      items: [
        ...categories.map((c) => ({
          targetType: "CATEGORY" as const,
          id: c.id,
          label: c.name,
          deletedAt: c.deletedAt,
          daysRemaining: daysRemaining(c.deletedAt!),
        })),
        ...children.map((c) => ({
          targetType: "CHILD" as const,
          id: c.id,
          label: `${c.firstName} ${c.lastName}`,
          deletedAt: c.deletedAt,
          daysRemaining: daysRemaining(c.deletedAt!),
        })),
      ].sort((a, b) => (a.deletedAt! < b.deletedAt! ? 1 : -1)),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
