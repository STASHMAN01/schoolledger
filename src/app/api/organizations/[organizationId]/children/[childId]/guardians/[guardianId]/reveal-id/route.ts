import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";

type Params = {
  params: Promise<{ organizationId: string; childId: string; guardianId: string }>;
};

// Same audit-logged-reveal pattern as children/[childId]/reveal-id --
// see that route's comment.
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { organizationId, childId, guardianId } = await params;
    const { userId, role, assignedCategoryId } = await requireMembership(organizationId);

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
