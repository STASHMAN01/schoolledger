import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { handleApiError } from "@/lib/apiError";
import { trashDaysRemaining } from "@/lib/deletion";
import { purgeExpiredTrash } from "@/lib/trashPurge";

type Params = { params: Promise<{ organizationId: string }> };

// Opening Trash also purges anything past its 30 days (the daily cron does
// the same for every school), so the list never shows an expired record.
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    await requireMembership(organizationId, "APPROVE_DELETION");

    await purgeExpiredTrash(organizationId);

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

    const daysRemaining = (deletedAt: Date) => trashDaysRemaining(deletedAt);

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
