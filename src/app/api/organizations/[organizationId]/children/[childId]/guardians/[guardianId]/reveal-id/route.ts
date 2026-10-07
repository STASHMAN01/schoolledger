import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";
import { rateLimit } from "@/lib/rateLimit";

// Security review #17 (7 Oct 2026): only people who manage children may
// reveal a full ID number, and at most 30 an hour each, so nobody can
// quietly collect every ID in the school.
const REVEALS_PER_HOUR = 30;

type Params = {
  params: Promise<{ organizationId: string; childId: string; guardianId: string }>;
};

// Same audit-logged-reveal pattern as children/[childId]/reveal-id --
// see that route's comment.
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId, childId, guardianId } = await params;
    const { userId, role, assignedCategoryId } = await requireMembership(organizationId, "MANAGE_CHILDREN", { allowWhenReadOnly: true });
    const quota = await rateLimit(`reveal-id:${organizationId}:${userId}`, { limit: REVEALS_PER_HOUR, windowMs: 60 * 60 * 1000 });
    if (!quota.allowed) {
      return NextResponse.json({ error: "Too many ID numbers shown in the last hour. Try again later." }, { status: 429 });
    }

    const guardian = await db.guardian.findFirst({
      where: { id: guardianId, childId, organizationId },
      include: { child: true },
    });
    if (
      !guardian ||
      (role === "TEACHER" && guardian.child.categoryId !== assignedCategoryId)
    ) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    await logAudit({
      organizationId,
      userId,
      action: "child.idNumber.revealed",
      entityType: "Guardian",
      entityId: guardianId,
      metadata: { childId, field: "idNumber" },
    });

    return NextResponse.json({ value: guardian.idNumber ?? null });
  } catch (err) {
    return handleApiError(err);
  }
}
