import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
// (isHighPositionRole retired — see src/lib/permissions.ts APPROVE_DELETION)
import { deletionRequestSchema } from "@/lib/validation";

type Params = { params: Promise<{ organizationId: string }> };

// Pulls a still-purgeable (< 30 days) category or child back out of the
// trash. Admin-only, same as everything else that touches the trash.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { organizationId } = await params;
    const { userId } = await requireMembership(organizationId, "APPROVE_DELETION");

    // Reuses the same {targetType, targetId} shape as a deletion request.
    const body = deletionRequestSchema.parse(await req.json());

    if (body.targetType === "CATEGORY") {
      const category = await db.category.findFirst({
        where: { id: body.targetId, organizationId, deletedAt: { not: null } },
      });
      if (!category) {
        return NextResponse.json({ error: "Not found in trash." }, { status: 404 });
      }
      await db.category.update({ where: { id: category.id }, data: { deletedAt: null } });
      await logAudit({
        organizationId,
        userId,
        action: "category.restoredFromTrash",
        entityType: "Category",
        entityId: category.id,
        metadata: { targetLabel: category.name },
      });
    } else {
      const child = await db.child.findFirst({
        where: { id: body.targetId, organizationId, deletedAt: { not: null } },
      });
      if (!child) {
        return NextResponse.json({ error: "Not found in trash." }, { status: 404 });
      }
      await db.child.update({ where: { id: child.id }, data: { deletedAt: null } });
      await logAudit({
        organizationId,
        userId,
        action: "child.restoredFromTrash",
        entityType: "Child",
        entityId: child.id,
        metadata: { targetLabel: `${child.firstName} ${child.lastName}` },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
